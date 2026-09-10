"""Three-layer usage persistence (P1, LiteLLM SpendLogs/DailySpend pattern).

Layer 1 — ``llm_usage``: per-request detail (LiteLLM SpendLogs).
Layer 2 — ``llm_usage_daily``: per-(tenant, day, api_key, model) rollup with
          a unique primary key (LiteLLM DailyUserSpend); budget checks read
          ONLY this layer, never the detail table.
Layer 3 — running totals on the owning row: ``llmgw_api_keys.spend_usd``
          (LiteLLM VerificationToken.spend-on-key; written when api_key_id
          is set, table arrives in P5 — the UPDATE is skipped until then).

All writes happen in one transaction; failures log a warning and never
propagate to the request path.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

import structlog

if TYPE_CHECKING:  # runtime import would be circular (recorder → store)
    from .recorder import UsageRecord

logger = structlog.get_logger(__name__)


class UsageStore:
    """asyncpg-backed three-layer usage writer/reader."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def record_usage(self, rec: UsageRecord) -> None:
        """Single-transaction three-layer write (soft dependency)."""
        try:
            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        """
                        INSERT INTO llm_usage
                          (request_id, ts, tenant_id, user_id, api_key_id, provider,
                           model, prompt_tokens, completion_tokens, total_tokens,
                           cache_hit, duration_ms, status, cost_usd)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                $11, $12, $13, $14)
                        """,
                        rec.request_id,
                        rec.ts,
                        rec.tenant_id,
                        rec.user_id,
                        rec.api_key_id,
                        rec.provider,
                        rec.model,
                        rec.prompt_tokens,
                        rec.completion_tokens,
                        rec.prompt_tokens + rec.completion_tokens,
                        rec.cache_hit,
                        rec.duration_ms,
                        rec.status,
                        rec.cost_usd,
                    )
                    await conn.execute(
                        """
                        INSERT INTO llm_usage_daily
                          (tenant_id, day, api_key_id, model, prompt_tokens,
                           completion_tokens, total_tokens, cost_usd,
                           api_requests, failed_requests)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (tenant_id, day, api_key_id, model)
                        DO UPDATE SET
                          prompt_tokens = llm_usage_daily.prompt_tokens + EXCLUDED.prompt_tokens,
                          completion_tokens = llm_usage_daily.completion_tokens + EXCLUDED.completion_tokens,
                          total_tokens = llm_usage_daily.total_tokens + EXCLUDED.total_tokens,
                          cost_usd = llm_usage_daily.cost_usd + EXCLUDED.cost_usd,
                          api_requests = llm_usage_daily.api_requests + EXCLUDED.api_requests,
                          failed_requests = llm_usage_daily.failed_requests + EXCLUDED.failed_requests
                        """,
                        rec.tenant_id,
                        rec.ts.date(),
                        rec.api_key_id or "",
                        rec.model,
                        rec.prompt_tokens,
                        rec.completion_tokens,
                        rec.prompt_tokens + rec.completion_tokens,
                        rec.cost_usd,
                        1 if rec.status == "success" else 0,
                        0 if rec.status == "success" else 1,
                    )
                    if rec.api_key_id:
                        # Layer 3: spend-on-key (llmgw_api_keys lands in P5;
                        # the UPDATE is skipped silently until the table exists).
                        await conn.execute(
                            """
                            UPDATE llmgw_api_keys
                               SET spend_usd = spend_usd + $2,
                                   last_active_at = now()
                             WHERE key_id = $1
                            """,
                            rec.api_key_id,
                            rec.cost_usd,
                        )
        except Exception as exc:
            logger.warning(
                "llmgw.usage.store_write_failed", error=str(exc),
                api_key_id=rec.api_key_id or "",
            )

    async def tenant_summary(self, tenant_id: str, days: int = 30) -> dict[str, Any]:
        """Aggregate summary reading the DAILY layer (budget-check shape)."""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT model,
                       SUM(total_tokens) AS tokens,
                       SUM(cost_usd)    AS cost,
                       SUM(api_requests + failed_requests) AS calls
                FROM llm_usage_daily
                WHERE tenant_id = $1 AND day >= CURRENT_DATE - $2::int
                GROUP BY model
                """,
                tenant_id,
                days,
            )
        by_model = {
            r["model"]: {
                "tokens": int(r["tokens"] or 0),
                "cost": round(float(r["cost"] or 0.0), 6),
                "calls": int(r["calls"] or 0),
            }
            for r in rows
        }
        return {
            "tenant_id": tenant_id,
            "total_tokens": sum(v["tokens"] for v in by_model.values()),
            "total_cost": round(sum(v["cost"] for v in by_model.values()), 6),
            "by_model": by_model,
        }

    async def window_spend(
        self,
        *,
        api_key_id: str | None = None,
        tenant_id: str | None = None,
        since: datetime,
    ) -> float:
        """Spend within a budget window, from the daily rollup only.

        Used by budget enforcement (tenant max / key max) — deliberately
        aggregate-only so a budget check never scans the detail table.
        """
        if api_key_id:
            sql = (
                "SELECT COALESCE(SUM(cost_usd), 0) AS s FROM llm_usage_daily "
                "WHERE api_key_id = $1 AND day >= $2"
            )
            args: tuple[Any, ...] = (api_key_id, since.date())
        else:
            sql = (
                "SELECT COALESCE(SUM(cost_usd), 0) AS s FROM llm_usage_daily "
                "WHERE tenant_id = $1 AND day >= $2"
            )
            args = (tenant_id, since.date())
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, *args)
        return round(float(row["s"] or 0.0), 6) if row else 0.0
