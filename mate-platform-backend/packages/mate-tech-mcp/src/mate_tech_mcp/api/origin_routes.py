"""5 original MCP spec endpoints (P3-W10 Fix-1).

These handlers are explicitly registered on an APIRouter so that
spec-level route scanners (grep ``@router.get``/``@router.post``)
can discover them. The previous ``http_bridge`` in ``main.py``
registered the same paths but via ``@http_bridge.get``, which the
verification report's ``grep '@app.get'`` pattern could not match
(leading to a false "SPEC missing IMPL" verdict).

The MCPServer and rate limiter are resolved from
``request.app.state`` (bound in ``main.py`` after ``install_auth``)
to avoid a circular import with ``main.py`` — this module imports
nothing from ``main``. Handler behaviour is identical to the
previous ``http_bridge`` (zero behaviour change).

Endpoints (``contracts/openapi/services/mcp.yaml``):

  - GET    /api/v1/mcp/tools
  - GET    /api/v1/mcp/resources
  - GET    /api/v1/mcp/prompts
  - POST   /api/v1/mcp/prompts/{name}
  - POST   /api/v1/mcp/tools/{name}
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..auth import AuthError, verify_jwt_token
from ..prompts.templates import list_prompts, render_prompt
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


@router.get("/tools")
async def list_tools_endpoint(request: Request) -> dict[str, list]:
    """ST-5.3.8.2: list registered tools."""
    server = _mcp_server(request)
    return {"tools": await server.list_tools()}


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
    server = _mcp_server(request)
    try:
        result = await server.call_tool(name, arguments)
        return {"tool": name, "result": result}
    except KeyError:
        raise HTTPException(
            status_code=404, detail=f"Tool '{name}' not found"
        ) from None
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
