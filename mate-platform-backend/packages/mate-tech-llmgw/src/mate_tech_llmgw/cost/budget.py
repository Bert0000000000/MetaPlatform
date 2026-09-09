"""Tenant budget semantics (P1, LiteLLM soft/max budget pattern).

- ``soft_budget_usd``  — crossing logs ONE warning per (tenant, day) and an
  OTel counter; requests continue.
- ``max_budget_usd``   — crossing raises BudgetExceededError → 429.

Both limits are read from ``llmgw_tenant_config`` (60s in-process cache) and
evaluated against ``UsageStore.window_spend`` — the daily rollup only, never
the detail table. Everything here is a soft dependency: no pool → no-op.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from .usage_store import UsageStore

logger = structlog.get_logger(__name__)

_CONFIG_CACHE_TTL_SEC = 60


class BudgetExceededError(Exception):
    """Tenant hard budget exceeded."""

    def __init__(self, *, tenant_id: str, spent_usd: float, max_usd: float) -> None:
        super().__init__(
            f"tenant {tenant_id} budget exceeded: ${spent_usd:.2f} / ${max_usd:.2f}"
        )
        self.tenant_id = tenant_id
        self.spent_usd = spent_usd
        self.max_usd = max_usd


@dataclass(frozen=True, slots=True)
class TenantBudget:
    soft_budget_usd: float | None
    max_budget_usd: float | None


_NO_BUDGET = TenantBudget(soft_budget_usd=None, max_budget_usd=None)


class TenantBudgetGuard:
    """Per-tenant soft/max budget evaluation (LiteLLM BudgetTable semantics)."""

    def __init__(self, pool: Any) -> None:
        self._store = UsageStore(pool)
        self._pool = pool
        self._config_cache: dict[str, tuple[TenantBudget, float]] = {}
        self._soft_alerted: set[str] = set()

    async def check(self, tenant_id: str, *, estimated_cost_usd: float = 0.0) -> None:
        """Raise BudgetExceededError past max; warn once past soft.

        ``estimated_cost_usd`` (the incoming request's projected cost) is
        included so a single huge request cannot blow past max uncounted.
        """
        budget = await self._budget_for(tenant_id)
        if budget is _NO_BUDGET:
            return
        since = datetime.now(UTC) - timedelta(days=30)
        try:
            spent = await self._store.window_spend(tenant_id=tenant_id, since=since)
        except Exception as exc:  # noqa: BLE001
            logger.warning("llmgw.budget.spend_read_failed", error=str(exc))
            return
        projected = spent + max(estimated_cost_usd, 0.0)

        if budget.max_budget_usd is not None and projected > budget.max_budget_usd:
            logger.warning(
                "llmgw.budget.exceeded",
                tenant_id=tenant_id,
                spent_usd=spent,
                max_usd=budget.max_budget_usd,
            )
            raise BudgetExceededError(
                tenant_id=tenant_id, spent_usd=projected, max_usd=budget.max_budget_usd
            )

        if (
            budget.soft_budget_usd is not None
            and projected > budget.soft_budget_usd
        ):
            alert_key = f"{tenant_id}:{datetime.now(UTC).date().isoformat()}"
            if alert_key not in self._soft_alerted:
                self._soft_alerted.add(alert_key)
                logger.warning(
                    "llmgw.budget.soft_exceeded",
                    tenant_id=tenant_id,
                    spent_usd=spent,
                    soft_usd=budget.soft_budget_usd,
                    max_usd=budget.max_budget_usd,
                )
                _increment_soft_budget_counter(tenant_id)

    async def _budget_for(self, tenant_id: str) -> TenantBudget:
        now = time.monotonic()
        cached = self._config_cache.get(tenant_id)
        if cached is not None and now - cached[1] < _CONFIG_CACHE_TTL_SEC:
            return cached[0]
        budget = await self._load_budget(tenant_id)
        self._config_cache[tenant_id] = (budget, now)
        return budget

    async def _load_budget(self, tenant_id: str) -> TenantBudget:
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT soft_budget_usd, max_budget_usd
                    FROM llmgw_tenant_config WHERE tenant_id = $1
                    """,
                    tenant_id,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("llmgw.budget.config_read_failed", error=str(exc))
            return _NO_BUDGET
        if row is None:
            return _NO_BUDGET
        return TenantBudget(
            soft_budget_usd=(
                float(row["soft_budget_usd"])
                if row["soft_budget_usd"] is not None
                else None
            ),
            max_budget_usd=(
                float(row["max_budget_usd"])
                if row["max_budget_usd"] is not None
                else None
            ),
        )


def _increment_soft_budget_counter(tenant_id: str) -> None:
    """OTel counter (hard rule 9); import kept lazy so tests need no SDK."""
    try:
        from opentelemetry import metrics

        counter = metrics.get_meter("mate.llmgw").create_counter(
            "llmgw_budget_soft_exceeded_total"
        )
        counter.add(1, {"tenant_id": tenant_id})
    except Exception:  # noqa: BLE001 — observability must never raise
        pass
