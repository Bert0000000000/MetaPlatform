"""mate_tech_metrics.clients — outbound client reserved for real metrics engine integration.

P2-W7 ships an in-memory stub repository; real metrics engine calls
(Apache Doris / ClickHouse / Druid) land in a later batch using
`mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`
(ADR-0014 step 4). The client shape is locked here to avoid a
contract churn when that lands.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncMetricsClient:
    """Reserved outbound client for the metrics control plane.

    P2-W7: no methods are implemented yet. A later batch adds
    `compute_metric` / `get_lineage` / `get_values` style calls
    that proxy to the underlying OLAP engine.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
