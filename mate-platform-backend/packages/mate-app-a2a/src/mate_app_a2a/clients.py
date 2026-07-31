"""mate_app_a2a.clients — outbound client stub.

The A2A center delegates tasks to registered agents (internal) and
federated agents (external). In P2-W3 the actual transport is stubbed;
the client class is reserved for the production wiring that will
proxy delegation requests to downstream A2A-speaking services.

Production wiring uses `mate_clients.security.BearerAuth` +
`OutgoingAuthMiddleware` (ADR-0014 step 4).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncA2AClient:
    """Reserved outbound client for A2A delegation.

    P2-W3: no methods are implemented yet. The production wiring
    adds `delegate` / `discover_external` style calls that proxy
    to A2A-speaking agent endpoints once the transport layer lands.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
