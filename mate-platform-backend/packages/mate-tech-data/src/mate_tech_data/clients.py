"""mate_tech_data.clients — outbound client reserved for real CDC engine integration.

P2-W6 ships an in-memory stub repository; real CDC engine calls
(Debezium / Flink / Airbyte) land in a later batch using
`mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`
(ADR-0014 step 4). The client shape is locked here to avoid a
contract churn when that lands.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncDataClient:
    """Reserved outbound client for the data platform control plane.

    P2-W6: no methods are implemented yet. A later batch adds
    `start_cdc_task` / `discover_source_schema` / `test_connection`
    style calls that proxy to the underlying CDC engine.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
