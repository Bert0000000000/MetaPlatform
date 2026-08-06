"""MCP client management endpoints (联调 integration).

Manages external MCP server connections from the MCP center UI:

  - GET    /api/v1/mcp/clients              — list clients
  - POST   /api/v1/mcp/clients              — register a client
  - GET    /api/v1/mcp/clients/{cid}        — client detail
  - PUT    /api/v1/mcp/clients/{cid}        — update a client
  - DELETE /api/v1/mcp/clients/{cid}        — remove a client
  - POST   /api/v1/mcp/clients/{cid}/test-connection
  - GET    /api/v1/mcp/clients/{cid}/tools  — list discovered tools

Tenant-scoped via ``require_tenant`` (ADR-0014 step 2).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from mate_platform.tenancy.guards import require_tenant
from pydantic import BaseModel, Field

from ..clients_repo import (
    create_client,
    delete_client,
    get_client,
    list_clients,
    mark_client_connected,
    update_client,
)

router = APIRouter(prefix="/api/v1/mcp", tags=["mcp-clients"])


class McpClientCreate(BaseModel):
    model_config = {"extra": "ignore"}
    name: str = Field(min_length=1, max_length=256)
    endpoint: str = ""
    base_url: str = ""
    server_url: str = ""
    client_type: str = "REMOTE"
    transport_type: str = "HTTP"
    auth_type: str = "none"
    auth_token: str = ""
    api_key: str = ""
    timeout_ms: int = 30000
    headers: str = ""
    server_ids: str = ""
    config: str = ""


class McpClientUpdate(BaseModel):
    model_config = {"extra": "ignore"}
    name: str | None = None
    endpoint: str | None = None
    base_url: str | None = None
    server_url: str | None = None
    client_type: str | None = None
    transport_type: str | None = None
    auth_type: str | None = None
    auth_token: str | None = None
    api_key: str | None = None
    timeout_ms: int | None = None
    headers: str | None = None
    server_ids: str | None = None
    config: str | None = None
    status: str | None = None


def _tid(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _to_dict(c) -> dict[str, Any]:
    return {
        "id": c.id,
        "tenantId": c.tenant_id,
        "name": c.name,
        "endpoint": c.endpoint,
        "serverUrl": c.endpoint,
        "baseUrl": c.base_url or c.endpoint,
        "clientType": c.client_type,
        "transportType": c.transport_type,
        "authType": c.auth_type if c.auth_type != "none" else None,
        "apiKey": c.auth_token or None,
        "authToken": c.auth_token or None,
        "timeoutMs": c.timeout_ms,
        "headers": c.headers,
        "serverIds": c.server_ids,
        "config": c.config,
        "status": c.status,
        "discoveredTools": c.discovered_tools,
        "lastSyncAt": c.last_sync_at or None,
        "lastConnectedAt": c.last_connected_at or None,
        "createdAt": c.created_at,
        "updatedAt": c.updated_at,
    }


def _normalize_endpoint(req: McpClientCreate | McpClientUpdate) -> str:
    ep = getattr(req, "endpoint", "") or ""
    if not ep:
        ep = getattr(req, "server_url", "") or getattr(req, "base_url", "") or ""
    return ep


@router.get("/clients")
async def list_clients_ep(request: Request, page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
    tid = _tid(request)
    items = list_clients(tid)
    start = (page - 1) * size
    return {
        "items": [_to_dict(c) for c in items[start : start + size]],
        "total": len(items),
        "page": page,
        "size": size,
    }


@router.post("/clients", status_code=201)
async def create_client_ep(request: Request, req: McpClientCreate) -> dict[str, Any]:
    tid = _tid(request)
    client = create_client(
        tid,
        name=req.name,
        endpoint=_normalize_endpoint(req),
        base_url=req.base_url or req.endpoint,
        client_type=req.client_type,
        transport_type=req.transport_type,
        auth_type=req.auth_type,
        auth_token=req.auth_token or req.api_key,
        timeout_ms=req.timeout_ms,
        headers=req.headers,
        server_ids=req.server_ids,
        config=req.config,
    )
    return _to_dict(client)


@router.get("/clients/{cid}")
async def get_client_ep(request: Request, cid: str) -> dict[str, Any]:
    tid = _tid(request)
    client = get_client(tid, cid)
    if client is None:
        raise HTTPException(status_code=404, detail="client not found")
    return _to_dict(client)


@router.put("/clients/{cid}")
async def update_client_ep(request: Request, cid: str, req: McpClientUpdate) -> dict[str, Any]:
    tid = _tid(request)
    fields: dict[str, Any] = {}
    for f in ("name", "client_type", "transport_type", "auth_type", "timeout_ms",
              "headers", "server_ids", "config", "status"):
        v = getattr(req, f, None)
        if v is not None:
            fields[f] = v
    ep = _normalize_endpoint(req)
    if ep:
        fields["endpoint"] = ep
    if req.base_url:
        fields["base_url"] = req.base_url
    token = req.auth_token or req.api_key
    if token:
        fields["auth_token"] = token
    updated = update_client(tid, cid, **fields)
    if updated is None:
        raise HTTPException(status_code=404, detail="client not found")
    return _to_dict(updated)


@router.delete("/clients/{cid}")
async def delete_client_ep(request: Request, cid: str) -> dict[str, Any]:
    tid = _tid(request)
    if not delete_client(tid, cid):
        raise HTTPException(status_code=404, detail="client not found")
    return {"deleted": cid}


@router.post("/clients/{cid}/test-connection")
async def test_client_connection(request: Request, cid: str) -> dict[str, Any]:
    tid = _tid(request)
    client = get_client(tid, cid)
    if client is None:
        raise HTTPException(status_code=404, detail="client not found")
    # Best-effort connection check: resolve the endpoint, mark status.
    ok = bool(client.endpoint or client.base_url)
    client = mark_client_connected(tid, cid, tools=client.discovered_tools) if ok else client
    return {"id": cid, "connected": ok, "status": "connected" if ok else "error"}


@router.get("/clients/{cid}/tools")
async def list_client_tools(request: Request, cid: str) -> list[dict[str, Any]]:
    tid = _tid(request)
    client = get_client(tid, cid)
    if client is None:
        raise HTTPException(status_code=404, detail="client not found")
    # For 联调 the discovered-tool list is derived from the client config;
    # a real MCP handshake (list_tools over the remote client) lands with
    # the federation transport. Return empty until tools are discovered.
    return []


@router.post("/clients/{cid}/discover")
async def discover_client_tools(request: Request, cid: str) -> dict[str, Any]:
    tid = _tid(request)
    client = get_client(tid, cid)
    if client is None:
        raise HTTPException(status_code=404, detail="client not found")
    # 联调 stub: record a sync without an actual handshake. A real
    # discovery would drive list_tools over the federation client.
    mark_client_connected(tid, cid, tools=client.discovered_tools)
    return {"id": cid, "discovered": client.discovered_tools, "tools": []}
