"""W2: forwarding execution for dynamically-registered MCP tools.

A digital-employee role or external worker registers its capability as
an MCP tool with a forwarding ``endpoint``. When the center's
``POST /api/v1/mcp/tools/{name}`` is invoked for such a tool, the call
is forwarded to ``{endpoint}/api/v1/mcp/tools/{name}`` — the same
MCP-to-MCP surface the federation feature uses (reusing
``ExternalMcpClient``, so no bare httpx in this service).
"""
from __future__ import annotations

from typing import Any

import structlog

from ..federation import ExternalMcpClient, FederatedServer

logger = structlog.get_logger(__name__)


class DynamicToolInvoker:
    """Forward a tool call to a dynamically-registered tool's endpoint."""

    def __init__(self, client: ExternalMcpClient | None = None) -> None:
        self._client = client or ExternalMcpClient(timeout=10.0)

    async def invoke(
        self,
        *,
        tenant_id: str,
        name: str,
        endpoint: str,
        arguments: dict[str, Any],
    ) -> Any:
        """Call ``{endpoint}/api/v1/mcp/tools/{name}`` with ``arguments``."""
        server = FederatedServer(
            id=f"dynamic-{name}",
            tenant_id=tenant_id,
            name=name,
            transport_url=endpoint.rstrip("/"),
            auth_token_ref="",
            status="active",
            tools=(name,),
        )
        logger.info(
            "mcp.dynamic.invoke",
            tool=name,
            endpoint=endpoint,
            tenant_id=tenant_id,
        )
        return await self._client.call_tool(server, name, arguments)

    async def aclose(self) -> None:
        await self._client.aclose()


# Module-level singleton + DI seam (mirrors the federation pattern).
_default_invoker: DynamicToolInvoker | None = None


def get_dynamic_invoker() -> DynamicToolInvoker:
    global _default_invoker
    if _default_invoker is None:
        _default_invoker = DynamicToolInvoker()
    return _default_invoker


def set_dynamic_invoker(invoker: DynamicToolInvoker | None) -> None:
    global _default_invoker
    _default_invoker = invoker
