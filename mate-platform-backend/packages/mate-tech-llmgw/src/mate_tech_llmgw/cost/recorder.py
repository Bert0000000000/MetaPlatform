"""Cost metering (ST-5.5.5.1).

每个请求记录 token 用量 + 单价 → 写入 PG `llm_usage` 表(asyncpg)。

Usage:
    async with CostRecorder(pg_pool) as rec:
        await rec.record(model="gpt-4o", usage={"prompt_tokens": 100, "completion_tokens": 50})
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# 单价表(USD / 1k tokens)— ST-5.5.5 DoD
PRICING: dict[str, dict[str, float]] = {
    "gpt-4o": {"prompt": 0.005, "completion": 0.015},
    "gpt-4o-mini": {"prompt": 0.00015, "completion": 0.0006},
    "gpt-4-turbo": {"prompt": 0.01, "completion": 0.03},
    "gpt-3.5-turbo": {"prompt": 0.0005, "completion": 0.0015},
    "claude-3-5-sonnet-20241022": {"prompt": 0.003, "completion": 0.015},
    "claude-3-opus-20240229": {"prompt": 0.015, "completion": 0.075},
    "claude-3-haiku-20240307": {"prompt": 0.00025, "completion": 0.00125},
}


@dataclass(frozen=True, slots=True)
class UsageRecord:
    """单次调用的成本记录."""

    model: str
    tenant_id: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    ts: datetime


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """根据 PRICING 表计算成本(USD)."""
    price = PRICING.get(model)
    if price is None:
        return 0.0
    cost = (
        prompt_tokens / 1000.0 * price["prompt"]
        + completion_tokens / 1000.0 * price["completion"]
    )
    return round(cost, 6)


class CostRecorder:
    """AsyncPG 包装的 cost 记录器."""

    def __init__(self, pool: Any | None = None, dsn: str | None = None) -> None:
        self._pool = pool
        self._dsn = dsn or os.getenv("PG_DSN", "postgresql://mate:mate@localhost:5432/mate")

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
    ) -> UsageRecord:
        """记录一次调用的成本.

        Args:
            model: LLM 模型名
            tenant_id: 租户 id
            usage: {prompt_tokens, completion_tokens, total_tokens}

        Returns:
            UsageRecord 实例
        """
        pt = int(usage.get("prompt_tokens", 0))
        ct = int(usage.get("completion_tokens", 0))
        cost = estimate_cost(model, pt, ct)
        record = UsageRecord(
            model=model,
            tenant_id=tenant_id,
            prompt_tokens=pt,
            completion_tokens=ct,
            cost_usd=cost,
            ts=datetime.now(UTC),
        )
        # 写 PG(如果 pool 已配置)
        if self._pool is not None:
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
        )
        return record