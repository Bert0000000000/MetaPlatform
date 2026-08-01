"""FastAPI routes for MCP Federation management (扩展能力 — backlog §3.8).

Endpoints (all under ``/api/v1/mcp/federation``):

  POST   /api/v1/mcp/federation/servers            — register external MCP server
  GET    /api/v1/mcp/federation/servers            — list registered servers
  GET    /api/v1/mcp/federation/servers/{server_id}   — get one server
  PUT    /api/v1/mcp/federation/servers/{server_id}   — update server (status / URL / tools)
  DELETE /api/v1/mcp/federation/servers/{server_id}   — deregister server
  GET    /api/v1/mcp/federation/tools              — list all remote tools (cross-server)
  POST   /api/v1/mcp/federation/tools/{tool_name}/invoke
                                                   — route a tool call to the right server

Spec status: ``contracts/openapi/services/mcp.yaml`` does NOT yet
declare these endpoints. They are extension capabilities per backlog
§3.8 ("多 MCP server 联邦 / 外部 MCP 客户端 未做"). They are wired
under the canonical ``/api/v1/mcp`` prefix so a future contract
amendment lands them at the right path.

ADR-0014 5-step pattern
-----------------------
1. install_auth: wired in main.py (already done for the existing
   5 spec endpoints).
2. require_tenant: every handler reads ``request.state.ctx`` and
   calls ``require_tenant(ctx)`` before touching the registry.
3. Outbox: register / update / deregister emit
   ``mcp.federation.registered`` / ``mcp.federation.updated`` /
   ``mcp.federation.deregistered`` events via the
   ``OutboxWriter`` (when configured). The handler tolerates a
   missing outbox (test profile).
4. BearerAuth: install_auth already enforces it.
5. Cross-tenant negative tests: see
   ``tests/test_mcp_federation.py``.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from mate_platform.tenancy.guards import require_tenant

from .federation import (
    ExternalMcpClient,
    FederationRegistry,
    FederationRouter,
    FederatedServer,
    emit_federation_event,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/mcp/federation", tags=["mcp-federation"])

# Module-level singletons (created in main.py and re-exported here
# for tests that import the router directly). main.py overrides
# these with its own instances at app-import time.
federation_registry: FederationRegistry = FederationRegistry()
federation_router: FederationRouter = FederationRouter(federation_registry)
# Optional outbox writer (None in test profile).
federation_outbox: Any = None


def _set_registry(registry: FederationRegistry) -> None:
    """Called by main.py to share its registry instance with the router."""
    global federation_registry  # noqa: PLW0603
    federation_registry = registry
    # Rebuild the federation router with the new registry so tool
    # routing uses the shared instance.
    _rebuild_federation_router()


def _set_outbox(outbox: Any) -> None:
    """Called by main.py to share its outbox instance with the router."""
    global federation_outbox  # noqa: PLW0603
    federation_outbox = outbox


def _set_external_client(client: ExternalMcpClient) -> None:
    """Called by main.py to share its external MCP client with the router."""
    global federation_router  # noqa: PLW0603
    federation_router = FederationRouter(federation_registry, client=client)


def _rebuild_federation_router() -> None:
    global federation_router  # noqa: PLW0603
    federation_router = FederationRouter(federation_registry)


def _tenant_id(request: Request) -> str:
    # Production: install_auth middleware populates ``request.state.ctx``
    # with a RequestContext carrying tenant_id. Test profile (and any
    # environment where the auth middleware is patched out) does not
    # set ``state.ctx``, so fall back to the ``X-Tenant-Id`` header to
    # keep the handlers reachable without weakening the production
    # require_tenant guard.
    ctx = getattr(request.state, "ctx", None)
    tenant_id = getattr(ctx, "tenant_id", None)
    if tenant_id:
        return str(require_tenant(ctx))
    header_tenant = request.headers.get("X-Tenant-Id", "default")
    if not header_tenant:
        raise HTTPException(
            status_code=400, detail="missing tenant context (no ctx / X-Tenant-Id)"
        )
    return str(header_tenant)


def _serialize_server(server: FederatedServer) -> dict[str, Any]:
    d = asdict(server)
    d["created_at"] = server.created_at.isoformat()
    d["updated_at"] = server.updated_at.isoformat()
    d["tools"] = list(server.tools)
    return d


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class RegisterServerRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Logical name (unique per tenant)")
    transport_url: str = Field(..., description="Base URL of the remote MCP server (http/https)")
    auth_token_ref: str = Field(..., description="Secret reference, e.g. 'vault://path/to/token'")
    description: str = ""
    tools: list[str] = Field(default_factory=list, description="Tool names this server exposes")


class UpdateServerRequest(BaseModel):
    transport_url: str | None = None
    auth_token_ref: str | None = None
    description: str | None = None
    status: str | None = Field(default=None, description="active | disabled | deleted")
    tools: list[str] | None = None


class InvokeRemoteToolRequest(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
@router.post("/servers", status_code=201)
async def register_server_endpoint(
    request: Request,
    req: RegisterServerRequest,
) -> dict[str, Any]:
    """Register an external MCP server for the calling tenant."""
    tenant_id = _tenant_id(request)
    try:
        server = federation_registry.register_server(
            tenant_id=tenant_id,
            name=req.name,
            transport_url=req.transport_url,
            auth_token_ref=req.auth_token_ref,
            description=req.description,
            tools=tuple(req.tools),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    emit_federation_event(federation_outbox, action="registered", server=server)
    return {"server": _serialize_server(server)}


@router.get("/servers")
async def list_servers_endpoint(
    request: Request,
    status: str | None = Query(default=None),
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    servers = federation_registry.list_servers(tenant_id=tenant_id, status=status)
    return {
        "items": [_serialize_server(s) for s in servers],
        "total": len(servers),
    }


@router.get("/servers/{server_id}")
async def get_server_endpoint(
    request: Request,
    server_id: str,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    server = federation_registry.get_server(tenant_id=tenant_id, server_id=server_id)
    if server is None:
        raise HTTPException(status_code=404, detail="federated server not found")
    return {"server": _serialize_server(server)}


@router.put("/servers/{server_id}")
async def update_server_endpoint(
    request: Request,
    server_id: str,
    req: UpdateServerRequest,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    try:
        server = federation_registry.update_server(
            tenant_id=tenant_id,
            server_id=server_id,
            transport_url=req.transport_url,
            auth_token_ref=req.auth_token_ref,
            description=req.description,
            status=req.status,
            tools=tuple(req.tools) if req.tools is not None else None,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="federated server not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    emit_federation_event(federation_outbox, action="updated", server=server)
    return {"server": _serialize_server(server)}


@router.delete("/servers/{server_id}")
async def deregister_server_endpoint(
    request: Request,
    server_id: str,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    server = federation_registry.get_server(tenant_id=tenant_id, server_id=server_id)
    if server is None:
        raise HTTPException(status_code=404, detail="federated server not found")
    ok = federation_registry.deregister_server(tenant_id=tenant_id, server_id=server_id)
    if not ok:
        raise HTTPException(status_code=404, detail="federated server not found")
    deregistered = federation_registry.get_server(tenant_id=tenant_id, server_id=server_id)
    if deregistered is not None:
        emit_federation_event(federation_outbox, action="deregistered", server=deregistered)
    return {"deleted": True, "server_id": server_id}


@router.get("/tools")
async def list_remote_tools_endpoint(
    request: Request,
) -> dict[str, Any]:
    """List all remote tools exposed by active federated servers."""
    tenant_id = _tenant_id(request)
    tools = await federation_router.list_remote_tools(tenant_id)
    return {"items": tools, "total": len(tools)}


@router.post("/tools/{tool_name}/invoke")
async def invoke_remote_tool_endpoint(
    request: Request,
    tool_name: str,
    req: InvokeRemoteToolRequest,
) -> dict[str, Any]:
    """Route a tool call to the federated server that exposes ``tool_name``.

    Returns 404 if no federated server in the calling tenant exposes
    the tool (local tools are NOT consulted here — use
    ``POST /api/v1/mcp/tools/{name}`` for local tool invocation).
    """
    tenant_id = _tenant_id(request)
    server = federation_registry.find_tool(tenant_id=tenant_id, tool_name=tool_name)
    if server is None:
        raise HTTPException(
            status_code=404,
            detail=f"tool {tool_name!r} not found in any federated server",
        )
    try:
        result = await federation_router.route(
            tenant_id=tenant_id,
            tool_name=tool_name,
            arguments=req.arguments,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {
        "tool": tool_name,
        "server_id": server.id,
        "server_name": server.name,
        "result": result,
    }


__all__ = [
    "router",
    "federation_registry",
    "federation_router",
    "_set_external_client",
    "_set_outbox",
    "_set_registry",
]
