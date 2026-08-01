"""mate_tech_metrics.clients — outbound client for real metrics engine integration.

The ``AsyncMetricsClient`` delegates to the ``DbtMetricsEngine``
adapter which runs dbt commands (``dbt run``, ``dbt list``,
``dbt run-operation``) via ``asyncio.subprocess``.

The engine reads its configuration from environment variables
(ADR-0014 step 4). The client shape (``base_url`` +
``timeout_seconds``) is preserved from the P2-W7 reserved interface;
new engine methods are additive.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from .services.dbt_engine import DbtMetricsEngine, DbtMetricsError, DbtResult


@dataclass
class AsyncMetricsClient:
    """Outbound client for the metrics control plane.

    The client owns a ``DbtMetricsEngine`` adapter and delegates
    ``compute_metric`` / ``get_lineage`` / ``get_values`` calls to it.

    The engine is lazily initialized from environment variables on
    construction if not explicitly provided (dependency injection
    for tests).
    """

    base_url: str
    timeout_seconds: float = 600.0
    dbt_engine: DbtMetricsEngine | None = None

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
        if self.dbt_engine is None:
            self.dbt_engine = DbtMetricsEngine.from_env(
                timeout_seconds=self.timeout_seconds,
            )

    # -----------------------------------------------------------------
    # Metric operations
    # -----------------------------------------------------------------
    async def compute_metric(
        self,
        metric_id: str,
        *,
        expression: str | None = None,
        select: str | None = None,
        full_refresh: bool = False,
        vars: dict[str, Any] | None = None,
    ) -> DbtResult:
        """Trigger a dbt run to compute the metric's underlying models."""
        assert self.dbt_engine is not None
        return await self.dbt_engine.compute_metric(
            metric_id,
            expression=expression,
            select=select,
            full_refresh=full_refresh,
            vars=vars,
        )

    async def get_lineage(
        self, metric_id: str, *, select: str | None = None,
    ) -> DbtResult:
        """Get the metric lineage via ``dbt list``."""
        assert self.dbt_engine is not None
        return await self.dbt_engine.get_lineage(metric_id, select=select)

    async def get_values(
        self,
        metric_id: str,
        *,
        expression: str,
        limit: int = 100,
    ) -> DbtResult:
        """Get the metric values via ``dbt run-operation``."""
        assert self.dbt_engine is not None
        return await self.dbt_engine.get_values(
            metric_id, expression=expression, limit=limit,
        )

    async def test_metric(
        self, metric_id: str, *, select: str | None = None,
    ) -> DbtResult:
        """Run dbt tests for the metric's models."""
        assert self.dbt_engine is not None
        return await self.dbt_engine.test_metric(metric_id, select=select)
