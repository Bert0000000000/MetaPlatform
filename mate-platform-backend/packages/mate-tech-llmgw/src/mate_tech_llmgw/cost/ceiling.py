"""Monthly token bucket + cost abuse detection (ADR-0018 §2.4).

Per-tenant 月度 token 上限：超限抛 QuotaExceededError，middleware
转 429 + Retry-After（持久化到 PG `llmgw_tenant_quota`，表不存在
时降级为 in-memory）。

Per-user 单日 cost 上限：超限返回 UserDailyCapExceeded，调用方
应强制走 stub provider（mate_tech_llmgw/llm/stub）。

Denial-of-wallet detector：单用户在 1h 窗口内 cost ≥ threshold_x
× 历史中位数 → CostAnomaly 信号。
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Iterable

import structlog

from .recorder import UsageRecord

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class MonthlyQuotaConfig:
    """月度 token quota 配置."""

    monthly_token_limit: int = 100_000_000  # 100M tokens / tenant / month
    retry_after_sec: int = 86_400            # 24h，月度重置粒度


@dataclass(frozen=True, slots=True)
class UserDailyCapConfig:
    """per-user 单日 cost 配置."""

    daily_cost_limit_usd: float = 5.0
    retry_after_sec: int = 3_600


@dataclass(slots=True)
class _MonthlyState:
    """per-tenant 月度累计 token 数 + 周期起点."""

    month_epoch: int
    tokens_used: int = 0
    cost_used_usd: float = 0.0


@dataclass(frozen=True, slots=True)
class CostAnomaly:
    """denial-of-wallet 告警."""

    user_id: str
    tenant_id: str
    window_sec: int
    burst_cost_usd: float
    baseline_median_usd: float
    multiplier: float
    detected_at: datetime


class MonthlyTokenBucket:
    """in-memory / PG-backed monthly token bucket.

    Persistence 是软依赖：未注入 pool 时只跑 in-memory（用于 dev
    与单元测试；生产应注入 asyncpg.Pool）。
    """

    def __init__(
        self,
        pool: Any | None = None,
        config: MonthlyQuotaConfig | None = None,
    ) -> None:
        self._pool = pool
        self._config = config or MonthlyQuotaConfig()
        self._state: dict[str, _MonthlyState] = {}

    @staticmethod
    def _current_month_epoch(now: float | None = None) -> int:
        t = now if now is not None else time.time()
        # 30-day sliding bucket: epoch // 30d
        return int(t // (30 * 86_400))

    async def check_and_record(
        self,
        *,
        tenant_id: str,
        estimated_tokens: int,
        estimated_cost_usd: float = 0.0,
    ) -> None:
        """超额抛 QuotaExceededError；正常扣减并持久化."""
        from ..quota.bucket import QuotaExceededError

        month = self._current_month_epoch()
        state = self._state.get(tenant_id)
        if state is None or state.month_epoch != month:
            state = _MonthlyState(month_epoch=month)
            self._state[tenant_id] = state

        new_tokens = state.tokens_used + max(estimated_tokens, 0)
        if new_tokens > self._config.monthly_token_limit:
            logger.warning(
                "llmgw.quota.exceeded.monthly",
                tenant=tenant_id,
                used=state.tokens_used,
                limit=self._config.monthly_token_limit,
            )
            raise QuotaExceededError(
                key=f"month:{tenant_id}:{month}",
                retry_after=self._config.retry_after_sec,
            )
        state.tokens_used = new_tokens
        state.cost_used_usd = round(state.cost_used_usd + estimated_cost_usd, 6)

        await self._persist(tenant_id, state)

    async def _persist(self, tenant_id: str, state: _MonthlyState) -> None:
        if self._pool is None:
            return
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO llmgw_tenant_quota
                      (tenant_id, month_epoch, tokens_used, cost_used_usd, updated_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (tenant_id, month_epoch) DO UPDATE
                      SET tokens_used = EXCLUDED.tokens_used,
                          cost_used_usd = EXCLUDED.cost_used_usd,
                          updated_at = EXCLUDED.updated_at
                    """,
                    tenant_id,
                    state.month_epoch,
                    state.tokens_used,
                    state.cost_used_usd,
                    datetime.now(UTC),
                )
        except Exception as e:  # pragma: no cover - PG 未就绪
            logger.warning("llmgw.monthly_quota.pg_persist_failed", error=str(e))

    def status(self, tenant_id: str) -> dict[str, Any]:
        state = self._state.get(tenant_id)
        if state is None:
            return {
                "tenant_id": tenant_id,
                "month_epoch": self._current_month_epoch(),
                "tokens_used": 0,
                "tokens_limit": self._config.monthly_token_limit,
                "cost_used_usd": 0.0,
            }
        return {
            "tenant_id": tenant_id,
            "month_epoch": state.month_epoch,
            "tokens_used": state.tokens_used,
            "tokens_limit": self._config.monthly_token_limit,
            "cost_used_usd": state.cost_used_usd,
        }


@dataclass(slots=True)
class _UserDailyState:
    day_epoch: int
    cost_used_usd: float = 0.0


class UserDailyCap:
    """per-user 单日 cost 上限."""

    def __init__(self, config: UserDailyCapConfig | None = None) -> None:
        self._config = config or UserDailyCapConfig()
        self._state: dict[tuple[str, str], _UserDailyState] = {}

    @staticmethod
    def _current_day_epoch(now: float | None = None) -> int:
        t = now if now is not None else time.time()
        return int(t // 86_400)

    def check_and_record(
        self,
        *,
        tenant_id: str,
        user_id: str,
        cost_usd: float,
    ) -> None:
        """超限抛 UserDailyCapExceeded；正常扣减."""
        day = self._current_day_epoch()
        key = (tenant_id, user_id)
        state = self._state.get(key)
        if state is None or state.day_epoch != day:
            state = _UserDailyState(day_epoch=day)
            self._state[key] = state
        new_cost = round(state.cost_used_usd + max(cost_usd, 0.0), 6)
        if new_cost > self._config.daily_cost_limit_usd:
            logger.warning(
                "llmgw.user_daily_cap.exceeded",
                tenant=tenant_id,
                user=user_id,
                used=state.cost_used_usd,
                limit=self._config.daily_cost_limit_usd,
            )
            raise UserDailyCapExceeded(
                user_id=user_id,
                retry_after=self._config.retry_after_sec,
            )
        state.cost_used_usd = new_cost


class UserDailyCapExceeded(Exception):
    """per-user 单日 cost 超限."""

    def __init__(self, *, user_id: str, retry_after: int) -> None:
        super().__init__(f"user {user_id} daily cap exceeded; retry after {retry_after}s")
        self.user_id = user_id
        self.retry_after = retry_after


# ---------------------------------------------------------------------------
# Denial-of-wallet detector
# ---------------------------------------------------------------------------
def detect_burst(
    records: Iterable[UsageRecord] | list[UsageRecord],
    *,
    user_id: str,
    window_sec: int = 3600,
    threshold_x: float = 10.0,
) -> bool:
    """单用户在 window_sec 内 cost ≥ threshold_x × 历史中位数 → True.

    算法：取 (now - window_sec) 之前的 records 作 baseline（median），
    (now - window_sec) 之后的 records 作 burst（sum），若 burst >
    threshold_x × baseline_median 则 True。
    """
    bucket = list(records)
    if not bucket:
        return False
    now_ts = time.time()
    burst_cost = 0.0
    burst_tokens = 0
    baseline_costs: list[float] = []
    for r in bucket:
        ts = r.ts.timestamp()
        cost = float(r.cost_usd)
        if ts >= now_ts - window_sec:
            burst_cost += cost
            burst_tokens += r.prompt_tokens + r.completion_tokens
        else:
            baseline_costs.append(cost)
    if not baseline_costs:
        return False
    baseline_costs.sort()
    mid = len(baseline_costs) // 2
    if len(baseline_costs) % 2 == 0:
        median = (baseline_costs[mid - 1] + baseline_costs[mid]) / 2.0
    else:
        median = baseline_costs[mid]
    if median <= 0:
        # baseline 全 0 时，任何 burst > 0 即视为异常
        return burst_cost > 0
    return burst_cost >= threshold_x * median


def scan_for_anomalies(
    records: Iterable[UsageRecord],
    *,
    window_sec: int = 3600,
    threshold_x: float = 10.0,
) -> list[CostAnomaly]:
    """扫描所有 (tenant_id, user_id) 组合，返回告警列表."""
    by_user: dict[tuple[str, str], list[UsageRecord]] = {}
    for r in records:
        key = (r.tenant_id, getattr(r, "user_id", "anonymous"))
        by_user.setdefault(key, []).append(r)
    out: list[CostAnomaly] = []
    for (tenant_id, user_id), group in by_user.items():
        if not detect_burst(
            group, user_id=user_id, window_sec=window_sec, threshold_x=threshold_x
        ):
            continue
        baseline = [
            float(r.cost_usd)
            for r in group
            if r.ts.timestamp() < time.time() - window_sec
        ]
        baseline.sort()
        if not baseline:
            continue
        mid = len(baseline) // 2
        if len(baseline) % 2 == 0:
            median = (baseline[mid - 1] + baseline[mid]) / 2.0
        else:
            median = baseline[mid]
        burst_cost = sum(
            float(r.cost_usd)
            for r in group
            if r.ts.timestamp() >= time.time() - window_sec
        )
        out.append(
            CostAnomaly(
                user_id=user_id,
                tenant_id=tenant_id,
                window_sec=window_sec,
                burst_cost_usd=round(burst_cost, 6),
                baseline_median_usd=round(median, 6),
                multiplier=round(burst_cost / median, 2) if median > 0 else 0.0,
                detected_at=datetime.now(UTC),
            )
        )
    return out