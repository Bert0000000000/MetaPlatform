"""mate_clients.mcp.tools — MCP tool invocation ACL client (W3).

The orchestrator dispatches a task step to an MCP worker by calling
``mate-tech-mcp`` ``POST /api/v1/mcp/tools/{name}``. This client wraps
that call with the ACL transport (hard-rule #4), so the digital
employee's capability (registered in the center's dynamic registry) is
invoked with the correct tenant context.
"""
from __future__ import annotations

from typing import Any

import httpx

from mate_clients.security import OutgoingAuthMiddleware


class McpToolsClient:
    """HTTP client for the MCP service-center tool surface."""

    DEFAULT_URL = "http://localhost:8081"

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

    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
        """Invoke an MCP tool at the center; returns the ``result`` body."""
        url = f"{self.base_url}/api/v1/mcp/tools/{name}"
        r = await self._client.post(url, json={"arguments": arguments})
        r.raise_for_status()
        return r.json().get("result", r.json())

    async def list_tools(self) -> list[dict[str, Any]]:
        """List tools visible to the tenant at the center."""
        r = await self._client.get(f"{self.base_url}/api/v1/mcp/tools")
        r.raise_for_status()
        return r.json().get("tools", [])

    async def aclose(self) -> None:
        await self._client.aclose()
