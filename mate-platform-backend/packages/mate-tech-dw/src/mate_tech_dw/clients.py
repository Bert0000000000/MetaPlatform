"""mate_tech_dw.clients — outbound client for cross-service aggregation.

The dw domain is a read-only aggregator over mate-app-kb /
mate-tech-rag / mate-tech-agent. P2-W3 ships an in-memory stub
repository; real cross-service calls land in P2-W5 (TD-6) using
`mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`
(ADR-0014 step 4). The client shape is locked here to avoid a
contract churn when that lands.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncDwClient:
    """Reserved outbound client for dw aggregation.

    P2-W3: no methods are implemented yet. P2-W5 adds
    `list_kb_documents` / `list_agent_traces` / `list_models`
    style calls that proxy to the underlying services once
    they are backed by persistent stores.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
