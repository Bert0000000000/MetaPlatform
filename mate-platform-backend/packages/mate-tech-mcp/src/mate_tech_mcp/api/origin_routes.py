"""5 original MCP spec endpoints + W2 dynamic tool registry.

The 5 spec endpoints (``contracts/openapi/services/mcp.yaml``):

  - GET    /api/v1/mcp/tools
  - GET    /api/v1/mcp/resources
  - GET    /api/v1/mcp/prompts
  - POST   /api/v1/mcp/prompts/{name}
  - POST   /api/v1/mcp/tools/{name}

W2 adds a runtime (dynamic) tool registry so digital-employee roles /
external workers can register their capabilities as MCP tools with a
forwarding endpoint. The registry is tenant-scoped and merges into the
``GET /tools`` list; ``POST /tools/{name}`` resolves a call via
local handler → dynamic forwarding → federation → 404.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..auth import AuthError, verify_jwt_token
from ..federation_routes import federation_router
from ..prompts.templates import list_prompts, render_prompt
from ..repositories import (
    get_tool_by_name,
    list_dynamic_tools,
    register_tool,
    unregister_tool,
    update_tool,
)
from ..tools.forwarding import get_dynamic_invoker
from ..tools.rate_limit import RateLimitExceeded

router = APIRouter(prefix="/api/v1/mcp", tags=["mcp"])


def _mcp_server(request: Request) -> Any:
    """Resolve the MCPServer from app.state (bound at startup)."""
    try:
        return request.app.state.mcp_server
    except AttributeError as exc:  # pragma: no cover - defensive
        raise RuntimeError("mcp_server not bound to app.state") from exc


def _rate_limiter(request: Request) -> Any:
    """Resolve the ToolRateLimiter from app.state (bound at startup)."""
    try:
        return request.app.state.rate_limiter
    except AttributeError as exc:  # pragma: no cover - defensive
        raise RuntimeError("rate_limiter not bound to app.state") from exc


def _emit_tool_event(
    request: Request,
    event_type: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event for a tool registry mutation (ADR-0014 step 3)."""
    writer = getattr(request.app.state, "outbox_writer", None)
    if writer is None:
        return
    from mate_platform.messaging.events import Event
    from mate_platform.tenancy.context import TenantId

    writer.append(
        Event.create(
            type=event_type,
            tenant_id=TenantId(tenant_id),
            aggregate_id=str(payload.get("name", "")),
            payload=payload,
            trace_id=_trace_id(request),
        )
    )


def _trace_id(request: Request) -> str:
    """Best-effort trace id from request.state.ctx (absent in tests)."""
    ctx = getattr(request.state, "ctx", None)
    return getattr(ctx, "trace_id", "") if ctx is not None else ""


async def _require_bearer(request: Request) -> dict[str, Any]:
    """Validate the ``Authorization: Bearer <JWT>`` header; return claims.

    Raises 401 on missing/malformed token (SEC-IAM-01 dev-profile inline
    check; production additionally enforces via ``install_auth`` middleware).
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth[len("Bearer ") :]
    try:
        return await verify_jwt_token(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e


async def _tenant_id(request: Request) -> str:
    """Resolve the tenant id: install_auth ctx first, else JWT claims.

    Anonymous callers fall back to the ``default`` tenant (list
    endpoints stay reachable for liveness; production auth is enforced
    by the ``install_auth`` middleware before handlers run).
    """
    ctx = getattr(request.state, "ctx", None)
    tid = getattr(ctx, "tenant_id", None)
    if tid:
        return str(tid)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            claims = await verify_jwt_token(auth[len("Bearer ") :])
            return str(claims.get("tenant_id", "default"))
        except AuthError:
            pass
    return "default"


@router.get("/tools")
async def list_tools_endpoint(request: Request) -> dict[str, list]:
    """ST-5.3.8.2: list registered tools (static + tenant dynamic)."""
    server = _mcp_server(request)
    static = await server.list_tools()
    dynamic = [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema,
        }
        for t in list_dynamic_tools(await _tenant_id(request))
        if t.enabled
    ]
    known = {t.get("name") for t in static}
    dynamic = [t for t in dynamic if t["name"] not in known]
    return {"tools": [*static, *dynamic]}


class RegisterToolRequest(BaseModel):
    """Body for POST /api/v1/mcp/tools (W2 dynamic registration)."""

    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="")
    input_schema: dict[str, Any] = Field(default_factory=lambda: {"type": "object"})
    endpoint: str = Field(min_length=1, description="forwarding target URL")


class UpdateToolRequest(BaseModel):
    """Body for PUT /api/v1/mcp/tools/{name} (W2)."""

    description: str | None = None
    input_schema: dict[str, Any] | None = None
    endpoint: str | None = None
    enabled: bool | None = None


@router.post("/tools", status_code=201)
async def register_tool_endpoint(
    request: Request,
    body: RegisterToolRequest,
) -> dict[str, Any]:
    """Register a dynamic tool (W2): capability with a forwarding endpoint."""
    tid = await _tenant_id(request)
    tool = register_tool(
        tid,
        body.name,
        description=body.description,
        input_schema=body.input_schema,
        endpoint=body.endpoint,
    )
    _emit_tool_event(request, "mcp.tool.registered", {
        "name": tool.name,
        "endpoint": tool.endpoint,
        "enabled": tool.enabled,
    }, tid)
    return {
        "name": tool.name,
        "description": tool.description,
        "input_schema": tool.input_schema,
        "endpoint": tool.endpoint,
        "enabled": tool.enabled,
    }


@router.put("/tools/{name}")
async def update_tool_endpoint(
    name: str,
    request: Request,
    body: UpdateToolRequest,
) -> dict[str, Any]:
    """Update a dynamic tool (W2): endpoint / description / enabled."""
    tid = await _tenant_id(request)
    tool = update_tool(
        tid,
        name,
        description=body.description,
        input_schema=body.input_schema,
        endpoint=body.endpoint,
        enabled=body.enabled,
    )
    if tool is None:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
    _emit_tool_event(request, "mcp.tool.updated", {
        "name": tool.name,
        "endpoint": tool.endpoint,
        "enabled": tool.enabled,
    }, tid)
    return {
        "name": tool.name,
        "description": tool.description,
        "input_schema": tool.input_schema,
        "endpoint": tool.endpoint,
        "enabled": tool.enabled,
    }


@router.delete("/tools/{name}")
async def delete_tool_endpoint(name: str, request: Request) -> dict[str, str]:
    """Unregister a dynamic tool (W2)."""
    tid = await _tenant_id(request)
    ok = unregister_tool(tid, name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
    _emit_tool_event(request, "mcp.tool.unregistered", {"name": name}, tid)
    return {"deleted": name}


@router.get("/resources")
async def list_resources_endpoint(request: Request) -> dict[str, list]:
    """ST-5.3.8.2: list registered resources."""
    server = _mcp_server(request)
    return {"resources": await server.list_resources()}


@router.get("/prompts")
async def list_prompts_endpoint() -> dict[str, list]:
    """ST-5.3.4: list prompt templates."""
    return {"prompts": list_prompts()}


@router.post("/prompts/{name}")
async def render_prompt_endpoint(
    name: str,
    payload: dict,
    request: Request,
) -> dict[str, str]:
    """ST-5.3.4: render a prompt template.

    Requires ``Authorization: Bearer <JWT>``.
    """
    await _require_bearer(request)
    try:
        rendered = render_prompt(name, **payload)
    except KeyError:
        raise HTTPException(
            status_code=404, detail=f"Prompt '{name}' not found"
        ) from None
    return {"name": name, "rendered": rendered}


@router.post("/tools/{name}")
async def call_tool_endpoint(
    name: str,
    payload: dict,
    request: Request,
) -> dict[str, object]:
    """ST-5.3.8.1: invoke a tool over HTTP.

    Body: ``{"arguments": {"query": "...", "top_k": 5}}``
    Headers: ``Authorization: Bearer <JWT>``, ``X-Tenant-Id: <tenant>``

    Resolution order (W2): local handler → tenant dynamic tool
    (forwarding endpoint) → federated remote server → 404.
    """
    claims = await _require_bearer(request)
    tenant_id = claims.get("tenant_id", "default")

    limiter = _rate_limiter(request)
    try:
        await limiter.check(tenant_id=tenant_id, tool_name=name)
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=429,
            detail=str(e),
            headers={"Retry-After": str(e.retry_after)},
        ) from e

    arguments = payload.get("arguments", {})
    if not isinstance(arguments, dict):
        raise HTTPException(status_code=422, detail="arguments must be an object")

    server = _mcp_server(request)
    try:
        result = await server.call_tool(name, arguments)
        return {"tool": name, "result": result, "source": "local"}
    except KeyError:
        pass  # not a local handler — try dynamic / federation below

    # W2: tenant dynamic tool (forwarding endpoint).
    dynamic = get_tool_by_name(tenant_id, name)
    if dynamic is not None and dynamic.enabled and dynamic.endpoint:
        invoker = getattr(request.app.state, "dynamic_invoker", None) or get_dynamic_invoker()
        try:
            result = await invoker.invoke(
                tenant_id=tenant_id,
                name=name,
                endpoint=dynamic.endpoint,
                arguments=arguments,
            )
            return {"tool": name, "result": result, "source": "dynamic"}
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e

    # W2: federation fallback (cross-server routing).
    try:
        remote = await federation_router.route(
            tenant_id=tenant_id,
            tool_name=name,
            arguments=arguments,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    if remote is not None:
        return {"tool": name, "result": remote, "source": "federation"}

    raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
