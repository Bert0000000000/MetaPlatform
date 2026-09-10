"""Cost metering (ST-5.5.5.1, P1 pricing close-out 2026-09-09).

每个请求记录 token 用量 + 单价 → 三层持久化（明细 / 日聚合 / key 行累计，
LiteLLM SpendLogs / DailyUserSpend / spend-on-key 模式）。

单价来源：``cost/pricing.py`` 的 vendored 价格库（LiteLLM MIT 数据子集 +
arkcli 核实的 ARK 价），env 可覆盖；``estimate_cost`` 保持函数签名不变。

Usage:
    async with CostRecorder(pg_pool) as rec:
        await rec.record(model="gpt-4o", usage={"prompt_tokens": 100, "completion_tokens": 50})
"""

from __future__ import annotations

import os
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from .pricing import get_pricing
from .usage_store import UsageStore

logger = structlog.get_logger(__name__)


# Backwards-compatible view over the vendored table: {model: per-1k USD}.
# Kept because cost/__init__ re-exports it; new code should use pricing.py.
def _build_pricing_view() -> dict[str, dict[str, float]]:
    table = get_pricing()
    out: dict[str, dict[str, float]] = {}
    for key in table.catalog_keys():
        price = table.get(key)
        if price is not None:
            out[key] = {
                "prompt": price.input_per_token * 1000.0,
                "completion": price.output_per_token * 1000.0,
            }
    return out


PRICING: dict[str, dict[str, float]] = _build_pricing_view()


@dataclass(frozen=True, slots=True)
class UsageRecord:
    """单次调用的成本记录."""

    model: str
    tenant_id: str
    user_id: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    ts: datetime
    # P1 metadata (defaults keep the legacy constructor shape valid).
    api_key_id: str = ""
    provider: str = ""
    request_id: str = ""
    duration_ms: int = 0
    cache_hit: bool = False
    status: str = "success"


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """根据 vendored 价格库计算成本(USD per-token)."""
    price = get_pricing().get(model)
    if price is None:
        return 0.0
    return round(price.cost(prompt_tokens, completion_tokens), 6)


def estimate_cost_cached(
    model: str,
    cached_prompt_tokens: int,
    prompt_tokens: int,
    completion_tokens: int,
) -> float:
    """Cache-hit aware cost (cache-read tokens billed at the lower rate)."""
    price = get_pricing().get(model)
    if price is None:
        return 0.0
    return round(price.cost_cached(cached_prompt_tokens, prompt_tokens, completion_tokens), 6)


class CostRecorder:
    """AsyncPG 包装的 cost 记录器（三层持久化）."""

    def __init__(self, pool: Any | None = None, dsn: str | None = None) -> None:
        self._pool = pool
        self._dsn = dsn or os.getenv("PG_DSN", "postgresql://mate:mate@localhost:5432/mate")
        # Bounded in-memory fallback (dev / PG-less): replaces the unbounded
        # list so a long-running process cannot grow without limit.
        self._records: deque[UsageRecord] = deque(maxlen=10_000)
        self._store = UsageStore(pool) if pool is not None else None

    @property
    def pool(self) -> Any | None:
        """The asyncpg connection pool (if configured)."""
        return self._pool

    @property
    def dsn(self) -> str:
        """The configured Postgres DSN."""
        return self._dsn

    async def record(
        self,
        *,
        model: str,
        tenant_id: str,
        usage: dict[str, int],
        user_id: str = "anonymous",
        api_key_id: str | None = None,
        provider: str = "",
        request_id: str = "",
        duration_ms: int = 0,
        cache_hit: bool = False,
        status: str = "success",
    ) -> UsageRecord:
        """记录一次调用的成本（三层写入）.

        Args:
            model: LLM 模型名
            tenant_id: 租户 id
            usage: {prompt_tokens, completion_tokens, total_tokens}
            user_id: 用户 id(用于 per-user daily cap + denial-of-wallet)
            api_key_id: 消费方 virtual key id（P5；空 = JWT 用户流量）
            provider: provider 名（openai/doubao/...）
            request_id: 请求追踪 id
            duration_ms: provider 调用耗时
            cache_hit: 是否网关缓存命中（cache-read 计价）
            status: success | error | fallback

        Returns:
            UsageRecord 实例
        """
        pt = int(usage.get("prompt_tokens", 0))
        ct = int(usage.get("completion_tokens", 0))
        if cache_hit:
            cost = estimate_cost_cached(model, pt, pt, ct)
        else:
            cost = estimate_cost(model, pt, ct)
        record = UsageRecord(
            model=model,
            tenant_id=tenant_id,
            user_id=user_id,
            prompt_tokens=pt,
            completion_tokens=ct,
            cost_usd=cost,
            ts=datetime.now(UTC),
            api_key_id=api_key_id or "",
            provider=provider,
            request_id=request_id,
            duration_ms=duration_ms,
            cache_hit=cache_hit,
            status=status,
        )
        self._records.append(record)

        if self._store is not None:
            await self._store.record_usage(record)
        elif self._pool is not None:
            # Legacy single-layer path (kept for pools without the store —
            # e.g. foreign pools injected by tests).
            try:
                async with self._pool.acquire() as conn:
                    await conn.execute(
                        """
                        INSERT INTO llm_usage
                          (model, tenant_id, prompt_tokens, completion_tokens, cost_usd, ts)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        record.model,
                        record.tenant_id,
                        record.prompt_tokens,
                        record.completion_tokens,
                        record.cost_usd,
                        record.ts,
                    )
            except Exception as e:
                logger.warning("cost.pg_insert_failed", error=str(e))

        logger.info(
            "cost.recorded",
            model=model,
            tenant=tenant_id,
            pt=pt,
            ct=ct,
            cost_usd=cost,
            cache_hit=cache_hit,
        )
        return record

    async def summary(self, tenant_id: str, days: int = 30) -> dict[str, Any]:
        """返回某租户的成本用量摘要.

        PG pool 可用时优先读日聚合表（预算判定同源，重启不丢）；否则
        回退 bounded 内存记录。输出 shape 两条路径一致。
        """
        if self._store is not None:
            try:
                return await self._store.tenant_summary(tenant_id, days)
            except Exception as e:
                logger.warning("cost.pg_summary_failed", error=str(e))
        if self._pool is not None:
            try:
                return await self._summary_from_pg(tenant_id, days)
            except Exception as e:
                logger.warning("cost.pg_summary_failed", error=str(e))
        return self._summary_from_memory(tenant_id)

    async def _summary_from_pg(self, tenant_id: str, days: int) -> dict[str, Any]:
        since = datetime.now(UTC) - timedelta(days=days)
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT model,
                       SUM(prompt_tokens + completion_tokens) AS tokens,
                       SUM(cost_usd) AS cost,
                       COUNT(*) AS calls
                FROM llm_usage
                WHERE tenant_id = $1 AND ts >= $2
                GROUP BY model
                """,
                tenant_id,
                since,
            )
        by_model: dict[str, dict[str, Any]] = {}
        total_tokens = 0
        total_cost = 0.0
        for row in rows:
            tokens = int(row["tokens"] or 0)
            cost = round(float(row["cost"] or 0.0), 6)
            by_model[row["model"]] = {"tokens": tokens, "cost": cost, "calls": int(row["calls"])}
            total_tokens += tokens
            total_cost += cost
        return {
            "tenant_id": tenant_id,
            "total_tokens": total_tokens,
            "total_cost": round(total_cost, 6),
            "by_model": by_model,
        }

    def _summary_from_memory(self, tenant_id: str) -> dict[str, Any]:
        tenant_records = [r for r in self._records if r.tenant_id == tenant_id]
        total_tokens = sum(r.prompt_tokens + r.completion_tokens for r in tenant_records)
        total_cost = sum(r.cost_usd for r in tenant_records)
        by_model: dict[str, dict[str, Any]] = {}
        for r in tenant_records:
            entry = by_model.setdefault(r.model, {"tokens": 0, "cost": 0.0, "calls": 0})
            entry["tokens"] += r.prompt_tokens + r.completion_tokens
            entry["cost"] = round(entry["cost"] + r.cost_usd, 6)
            entry["calls"] += 1
        return {
            "tenant_id": tenant_id,
            "total_tokens": total_tokens,
            "total_cost": round(total_cost, 6),
            "by_model": by_model,
        }
