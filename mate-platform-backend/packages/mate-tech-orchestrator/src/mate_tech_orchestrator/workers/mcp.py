"""mate_tech_orchestrator.workers.mcp — MCP-center worker adapter.

Dispatches a task step to the MCP service center's tool surface
(``POST /api/v1/mcp/tools/{name}``) via the ACL ``McpToolsClient``.
The tool is the digital-employee role's capability registered in the
center's dynamic registry (W2).

Production calls carry a service identity (client_credentials) so the
center's ``install_auth`` accepts them; dev/test fall back to
unauthenticated calls when no ``SERVICE_CLIENT_SECRET`` is configured.
"""
from __future__ import annotations

import os
from typing import Any

from mate_clients.mcp.tools import McpToolsClient

from .identity import build_service_identity


class McpWorker:
    """Invoke MCP tools at the service center for a tenant."""

    DEFAULT_URL = os.getenv("MCP_URL", "http://localhost:8081")

    def __init__(self, client: McpToolsClient | None = None) -> None:
        self._client = client or McpToolsClient(
            base_url=self.DEFAULT_URL,
            auth=build_service_identity(),
        )

    async def invoke(
        self,
        *,
        tenant_id: str,
        ref: str,
        arguments: dict[str, Any],
    ) -> Any:
        """Call the MCP tool ``ref`` with ``arguments`` for ``tenant_id``."""
        self._client.set_tenant(tenant_id)
        return await self._client.call_tool(name=ref, arguments=arguments)

    async def aclose(self) -> None:
        await self._client.aclose()


_default_worker: McpWorker | None = None


def get_mcp_worker() -> McpWorker:
    global _default_worker
    if _default_worker is None:
        _default_worker = McpWorker()
    return _default_worker


def set_mcp_worker(worker: McpWorker | None) -> None:
    global _default_worker
    _default_worker = worker
