"""mate_tech_etl.clients — outbound client reserved for real ETL engine integration.

P2-W7 ships an in-memory stub repository; real ETL engine calls
(Spark / Flink / Airflow / DataWorks) land in a later batch using
`mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`
(ADR-0014 step 4). The client shape is locked here to avoid a
contract churn when that lands.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncEtlClient:
    """Reserved outbound client for the ETL task control plane.

    P2-W7: no methods are implemented yet. A later batch adds
    `run_task` / `stop_task` / `get_status` style calls that proxy
    to the underlying ETL engine.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
