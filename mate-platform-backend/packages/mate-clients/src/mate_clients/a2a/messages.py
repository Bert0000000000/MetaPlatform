"""mate_clients.a2a.messages — A2A message ACL client (W3).

The orchestrator dispatches a task step to an A2A worker by posting a
W3C A2A message to ``mate-app-a2a`` ``POST /api/v1/a2a/messages``
(task-based) and polling ``GET /api/v1/a2a/tasks/{task_id}``. The
envelope field names are the W3C wire names (camelCase).
"""
from __future__ import annotations

from typing import Any

import httpx

from mate_clients.security import OutgoingAuthMiddleware


class A2AMessagesClient:
    """HTTP client for the A2A service-center message/task surface."""

    DEFAULT_URL = "http://localhost:8502"

    def __init__(
        self,
        base_url: str | None = None,
        *,
        timeout: float = 30.0,
        auth: Any = None,  # token provider: BearerAuth | ServiceIdentity (.token())
        tenant_id: str = "",
    ) -> None:
        self.base_url = (base_url or self.DEFAULT_URL).rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)
        if auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)
        self._auth = auth
        self._tenant_id = tenant_id

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    async def post_message(self, *, envelope: dict[str, Any]) -> dict[str, Any]:
        """Send a W3C A2A message; returns the created A2A Task."""
        r = await self._client.post(f"{self.base_url}/api/v1/a2a/messages", json=envelope)
        r.raise_for_status()
        return r.json()

    async def get_task(self, *, task_id: str) -> dict[str, Any]:
        """Read an A2A task by id."""
        r = await self._client.get(f"{self.base_url}/api/v1/a2a/tasks/{task_id}")
        r.raise_for_status()
        return r.json()

    async def aclose(self) -> None:
        await self._client.aclose()
