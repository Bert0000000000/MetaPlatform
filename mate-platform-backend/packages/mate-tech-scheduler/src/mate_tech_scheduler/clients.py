"""mate_tech_scheduler.clients — outbound client reserved for real scheduler engine integration.

P2-W7 ships an in-memory stub repository; real scheduler engine calls
(Airflow / DolphinScheduler / Dagster) land in a later batch using
`mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`
(ADR-0014 step 4). The client shape is locked here to avoid a
contract churn when that lands.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncSchedulerClient:
    """Reserved outbound client for the DAG scheduling control plane.

    P2-W7: no methods are implemented yet. A later batch adds
    `pause_task` / `trigger_task` / `get_dag` style calls that proxy
    to the underlying scheduler engine.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
