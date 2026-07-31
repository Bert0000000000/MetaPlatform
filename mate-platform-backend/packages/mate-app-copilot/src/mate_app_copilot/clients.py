"""mate_app_copilot.clients — outbound client with BearerAuth.

Provides typed client wrappers for copilot → llmgw / kb / ontology /
a2a cross-service calls. Each client injects `Authorization: Bearer`
+ `X-Tenant-Id` via `OutgoingAuthMiddleware`.

In P2-W3 the clients are wired but not yet called from handlers
(handlers still use in-memory stubs). The wiring will be switched on
incrementally in P2-W4/W5.
"""
from __future__ import annotations

from dataclasses import dataclass

from mate_clients.security.bearer import BearerAuth
from mate_clients.security.outgoing import OutgoingAuthMiddleware


@dataclass(frozen=True)
class AsyncCopilotClient:
    """Base config for copilot outbound calls.

    Holds the shared BearerAuth instance and service base URLs.
    Individual service clients (llmgw, kb, ont, a2a) are created
    on demand via the factory methods below.
    """
    base_url: str
    auth: BearerAuth
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")

    def _middleware(self, tenant_id: str) -> OutgoingAuthMiddleware:
        """Build an httpx auth middleware for a specific tenant."""
        return OutgoingAuthMiddleware(self.auth, tenant_id=tenant_id)

    def llmgw_url(self) -> str:
        return f"{self.base_url}/api/v1/llmgw"

    def kb_url(self) -> str:
        return f"{self.base_url}/api/v1/kb"

    def ont_url(self) -> str:
        return f"{self.base_url}/api/v1/ont"

    def a2a_url(self) -> str:
        return f"{self.base_url}/api/v1/a2a"
