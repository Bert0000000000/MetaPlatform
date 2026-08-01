"""mate_app_wfe.clients — outbound client for the Flowable engine.

P2-W5 ships an in-memory BPMN structural validator; real Flowable
8.0 engine calls (POST /process-engine/runtime/process-instances
etc.) land in P2-W6 using `mate_clients.security.BearerAuth` +
`OutgoingAuthMiddleware` (ADR-0014 step 4). The client shape is
locked here to avoid a contract churn when that lands.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncFlowableClient:
    """Reserved outbound client for the Flowable 8.0 engine.

    P2-W5: no methods are implemented yet. P2-W6 adds
    `test_flow(bpmn_xml)` / `validate_flow(bpmn_xml)` calls that
    proxy to the Flowable REST API once it is wired into
    docker-compose.
    """

    base_url: str
    timeout_seconds: float = 10.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
