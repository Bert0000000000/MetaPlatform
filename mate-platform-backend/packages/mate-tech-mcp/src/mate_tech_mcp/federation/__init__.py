"""MCP Federation — multi-server registry + external MCP client (扩展能力 — backlog §3.8).

The mcp spec only declares 5 local endpoints (tools/resources/prompts
list + prompt render + tool call). ``多 MCP server 联邦 / 外部 MCP
客户端`` is a declared gap. This package adds:

* ``FederatedServer`` — a tenant-scoped registration of an external
  MCP server (name + transport URL + auth token ref + status).
* ``ExternalMcpClient`` — a thin HTTP client that calls a remote
  MCP server's ``/api/v1/mcp/tools`` (list) and
  ``/api/v1/mcp/tools/{name}`` (invoke) endpoints. Supports bearer auth.
* ``FederationRegistry`` — in-memory tenant-scoped registry. Each
  tenant can register multiple external servers; the registry
  indexes tools by name for cross-server routing.
* ``FederationRouter`` — given a tool name, find which federated
  server exposes it and route the call. Falls back to local tools
  (handled by ``MCPServer``) when no federation match exists.

v3.2 W1 (federation 真实化) adds, in submodules:
* ``McpRemoteClient`` — real HTTP remote client (discover / invoke /
  health) with explicit ``AuthError`` / ``RemoteUnavailableError`` /
  ``RemoteError`` failure modes.
* ``HealthChecker`` — 60s heartbeat that flips dead servers to
  ``disabled``.
* ``FederationDLQ`` — tenant-scoped dead-letter queue with replay.

Production replaces the in-memory registry with the SQL store (out
of scope per task constraint "不修改持久化层"); the API surface is
identical so the swap is mechanical.

The registry is tenant-scoped: every method takes ``tenant_id`` from
the request context (never from the body / path) and refuses
cross-tenant reads (SEC-TENANT-01 hard rule 3).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

from mate_platform.messaging import Event, OutboxWriter

logger = structlog.get_logger(__name__)

ServerStatus = str  # "active" | "disabled" | "deleted"


@dataclass(frozen=True)
class FederatedServer:
    """Registration of an external MCP server."""

    id: str
    tenant_id: str
    name: str
    transport_url: str  # base URL, e.g. http://remote-mcp:8081
    auth_token_ref: str  # reference to a secret (e.g. "vault://path/to/token")
    status: ServerStatus = "active"
    description: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    # Cached tool list (refreshed by ``refresh_tools``).
    tools: tuple[str, ...] = field(default_factory=tuple)


class FederationRegistry:
    """In-memory tenant-scoped registry of federated MCP servers.

    The registry indexes tools by name for cross-server routing: a
    tool name like ``remote.search`` is mapped to the federated
    server that exposes it. Tool name collisions across servers in
    the same tenant raise on registration (deterministic routing).
    """

    def __init__(self) -> None:
        self._servers: dict[str, dict[str, FederatedServer]] = {}
        self._counter: int = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"fed-{self._counter:08d}"

    # ----- writes -----
    def register_server(
        self,
        *,
        tenant_id: str,
        name: str,
        transport_url: str,
        auth_token_ref: str,
        description: str = "",
        tools: tuple[str, ...] = (),
    ) -> FederatedServer:
        if not tenant_id:
            raise ValueError("tenant_id required")
        if not name or not name.strip():
            raise ValueError("name required")
        if not transport_url.startswith(("http://", "https://")):
            raise ValueError("transport_url must be http(s)://...")
        if not auth_token_ref:
            raise ValueError("auth_token_ref required")
        bucket = self._servers.setdefault(tenant_id, {})
        # Reject duplicate names within the same tenant.
        for existing in bucket.values():
            if existing.name == name and existing.status != "deleted":
                raise ValueError(
                    f"federated server with name {name!r} already exists in this tenant"
                )
        # Reject tool name collisions with other active servers in the tenant.
        existing_tools: set[str] = set()
        for srv in bucket.values():
            if srv.status == "active":
                existing_tools.update(srv.tools)
        collisions = set(tools) & existing_tools
        if collisions:
            raise ValueError(
                f"tool name collision: {sorted(collisions)} already registered"
            )
        server_id = self._next_id()
        srv = FederatedServer(
            id=server_id,
            tenant_id=tenant_id,
            name=name.strip(),
            transport_url=transport_url.rstrip("/"),
            auth_token_ref=auth_token_ref,
            description=description,
            tools=tuple(tools),
        )
        bucket[server_id] = srv
        logger.info(
            "federation.server.registered",
            server_id=server_id,
            tenant_id=tenant_id,
            name=name,
            tools=len(tools),
        )
        return srv

    def update_server(
        self,
        *,
        tenant_id: str,
        server_id: str,
        transport_url: str | None = None,
        auth_token_ref: str | None = None,
        description: str | None = None,
        status: ServerStatus | None = None,
        tools: tuple[str, ...] | None = None,
    ) -> FederatedServer:
        bucket = self._servers.get(tenant_id, {})
        existing = bucket.get(server_id)
        if existing is None:
            raise KeyError(server_id)
        new_url = transport_url if transport_url is not None else existing.transport_url
        new_token = auth_token_ref if auth_token_ref is not None else existing.auth_token_ref
        new_desc = description if description is not None else existing.description
        new_status = status if status is not None else existing.status
        new_tools = tuple(tools) if tools is not None else existing.tools
        if not new_url.startswith(("http://", "https://")):
            raise ValueError("transport_url must be http(s)://...")
        if new_status not in ("active", "disabled", "deleted"):
            raise ValueError(f"invalid status {new_status!r}")
        # Reject tool name collisions with other active servers.
        if new_tools != existing.tools and new_status == "active":
            existing_tools: set[str] = set()
            for srv in bucket.values():
                if srv.id == server_id:
                    continue
                if srv.status == "active":
                    existing_tools.update(srv.tools)
            collisions = set(new_tools) & existing_tools
            if collisions:
                raise ValueError(
                    f"tool name collision: {sorted(collisions)} already registered"
                )
        updated = FederatedServer(
            id=existing.id,
            tenant_id=existing.tenant_id,
            name=existing.name,
            transport_url=new_url.rstrip("/"),
            auth_token_ref=new_token,
            status=new_status,
            description=new_desc,
            tools=new_tools,
            created_at=existing.created_at,
            updated_at=datetime.now(UTC),
        )
        bucket[server_id] = updated
        logger.info(
            "federation.server.updated",
            server_id=server_id,
            tenant_id=tenant_id,
            status=new_status,
        )
        return updated

    def deregister_server(self, *, tenant_id: str, server_id: str) -> bool:
        bucket = self._servers.get(tenant_id, {})
        existing = bucket.get(server_id)
        if existing is None:
            return False
        bucket[server_id] = FederatedServer(
            id=existing.id,
            tenant_id=existing.tenant_id,
            name=existing.name,
            transport_url=existing.transport_url,
            auth_token_ref=existing.auth_token_ref,
            status="deleted",
            description=existing.description,
            tools=existing.tools,
            created_at=existing.created_at,
            updated_at=datetime.now(UTC),
        )
        logger.info(
            "federation.server.deregistered",
            server_id=server_id,
            tenant_id=tenant_id,
        )
        return True

    # ----- reads -----
    def list_servers(
        self,
        *,
        tenant_id: str,
        status: ServerStatus | None = None,
    ) -> list[FederatedServer]:
        bucket = self._servers.get(tenant_id, {})
        rows = list(bucket.values())
        if status:
            rows = [s for s in rows if s.status == status]
        return sorted(rows, key=lambda s: (s.status, s.name, s.created_at))

    def get_server(self, *, tenant_id: str, server_id: str) -> FederatedServer | None:
        return self._servers.get(tenant_id, {}).get(server_id)

    def get_server_by_name(
        self, *, tenant_id: str, name: str
    ) -> FederatedServer | None:
        for srv in self._servers.get(tenant_id, {}).values():
            if srv.name == name and srv.status != "deleted":
                return srv
        return None

    def find_tool(self, *, tenant_id: str, tool_name: str) -> FederatedServer | None:
        """Return the active server that exposes ``tool_name``."""
        for srv in self._servers.get(tenant_id, {}).values():
            if srv.status != "active":
                continue
            if tool_name in srv.tools:
                return srv
        return None

    def list_remote_tools(self, *, tenant_id: str) -> list[dict[str, str]]:
        """Return ``[{name, server_id, server_name}]`` for all active tools."""
        rows: list[dict[str, str]] = []
        for srv in self._servers.get(tenant_id, {}).values():
            if srv.status != "active":
                continue
            for t in srv.tools:
                rows.append(
                    {
                        "name": t,
                        "server_id": srv.id,
                        "server_name": srv.name,
                    }
                )
        return sorted(rows, key=lambda r: r["name"])

    def reset(self) -> None:
        """Drop all data. Used by tests."""
        self._servers.clear()
        self._counter = 0


# ---------------------------------------------------------------------------
# External MCP client — calls a remote MCP server over HTTP
# ---------------------------------------------------------------------------
class ExternalMcpClient:
    """HTTP client for a remote MCP server.

    The remote server is expected to expose the same 5-endpoint
    surface as the local one (``/api/v1/mcp/tools``,
    ``/api/v1/mcp/tools/{name}``, etc.). The client supports bearer
    auth via a callable token resolver (so the actual secret never
    lives in memory long-term).
    """

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        client: httpx.AsyncClient | None = None,
        token_resolver: Any = None,
    ) -> None:
        self._timeout = timeout
        self._client = client
        self._token_resolver = token_resolver

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    def _headers(self, server: FederatedServer) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._token_resolver is not None:
            token = self._token_resolver(server.auth_token_ref)
            if token:
                headers["Authorization"] = f"Bearer {token}"
        return headers

    async def list_tools(self, server: FederatedServer) -> list[dict[str, Any]]:
        client = await self._ensure_client()
        url = f"{server.transport_url}/api/v1/mcp/tools"
        try:
            resp = await client.get(url, headers=self._headers(server))
            resp.raise_for_status()
            data = resp.json()
            return data.get("tools", [])
        except httpx.HTTPError as e:
            logger.error(
                "federation.list_tools.http_error",
                server_id=server.id,
                error=str(e),
            )
            raise RuntimeError(f"remote MCP server {server.name!r} unreachable: {e}") from e

    async def call_tool(
        self,
        server: FederatedServer,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> Any:
        client = await self._ensure_client()
        url = f"{server.transport_url}/api/v1/mcp/tools/{tool_name}"
        try:
            resp = await client.post(
                url,
                json={"arguments": arguments},
                headers=self._headers(server),
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("result", data)
        except httpx.HTTPError as e:
            logger.error(
                "federation.call_tool.http_error",
                server_id=server.id,
                tool=tool_name,
                error=str(e),
            )
            raise RuntimeError(
                f"remote tool {tool_name!r} on {server.name!r} failed: {e}"
            ) from e

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# ---------------------------------------------------------------------------
# Federation router — cross-server tool routing
# ---------------------------------------------------------------------------
class FederationRouter:
    """Route a tool call to the right federated server.

    Order of precedence:
      1. If the tool name is registered to a federated server in the
         calling tenant, route to that server.
      2. Otherwise, return ``None`` (caller falls back to local
         ``MCPServer.call_tool``).
    """

    def __init__(
        self,
        registry: FederationRegistry,
        client: ExternalMcpClient | None = None,
    ) -> None:
        self._registry = registry
        self._client = client or ExternalMcpClient()

    async def route(
        self,
        *,
        tenant_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> Any | None:
        """Route a tool call; returns ``None`` if no federation match."""
        server = self._registry.find_tool(tenant_id=tenant_id, tool_name=tool_name)
        if server is None:
            return None
        return await self._client.call_tool(server, tool_name, arguments)

    async def list_remote_tools(self, tenant_id: str) -> list[dict[str, str]]:
        return self._registry.list_remote_tools(tenant_id=tenant_id)

    async def aclose(self) -> None:
        await self._client.aclose()


# ---------------------------------------------------------------------------
# Outbox emission helpers
# ---------------------------------------------------------------------------
def emit_federation_event(
    outbox: OutboxWriter | None,
    *,
    action: str,
    server: FederatedServer,
    trace_id: str = "",
) -> None:
    """Append an outbox event for a federation mutation.

    The outbox is optional: when ``None`` (test profile) the call is
    a no-op so handlers can be exercised without a PG transaction.
    """
    if outbox is None:
        return
    event = Event.create(
        type=f"mcp.federation.{action}",
        tenant_id=server.tenant_id,
        aggregate_id=server.id,
        payload={
            "server_id": server.id,
            "name": server.name,
            "transport_url": server.transport_url,
            "status": server.status,
            "tools": list(server.tools),
        },
        trace_id=trace_id,
    )
    outbox.append(event)


# ---------------------------------------------------------------------------
# v3.2 W1: real federation components (re-exported from submodules)
# ---------------------------------------------------------------------------
from .dlq import FederationDLQ, FederationDLQEntry  # noqa: E402
from .heartbeat import HealthChecker  # noqa: E402
from .mcp_remote_client import (  # noqa: E402
    AuthError,
    FederationClientError,
    McpRemoteClient,
    RemoteError,
    RemoteUnavailableError,
)

__all__ = [
    "AuthError",
    "ExternalMcpClient",
    "FederationClientError",
    "FederationDLQ",
    "FederationDLQEntry",
    "FederationRegistry",
    "FederationRouter",
    "FederatedServer",
    "HealthChecker",
    "McpRemoteClient",
    "RemoteError",
    "RemoteUnavailableError",
    "ServerStatus",
    "emit_federation_event",
]
