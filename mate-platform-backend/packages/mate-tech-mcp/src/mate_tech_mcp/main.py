"""Mate Platform - MCP main entry.

Wires the 5 spec endpoints (`contracts/openapi/services/mcp.yaml`):

  - GET    /api/v1/mcp/tools
  - GET    /api/v1/mcp/resources
  - GET    /api/v1/mcp/prompts
  - POST   /api/v1/mcp/prompts/{name}
  - POST   /api/v1/mcp/tools/{name}

The canonical SEC-IAM-01 auth middleware (install_auth) is
attached at the FastAPI level. The legacy `auth.py` JWT helper
remains for back-compat in dev profile only; production profiles
enforce LEGACY_LOGIN_COMPAT=false.

P0 close-out (2026-07-30):
  - Replaced the previous garbled main.py (the FastAPI title
    description was interrupted mid-string and the install_auth
    call appeared inside the description, leading to a SyntaxError
    on import) with this clean rewrite.
  - The 5 HTTP endpoints were defined via decorators after the
    `app.include_router(http_bridge)` line in the previous file,
    which meant FastAPI mounted the bridge BEFORE the routes
    were registered, so consumers saw 404. The endpoints are
    now defined before include_router so they actually mount.
  - This PR verifies the 5 endpoints are reachable end-to-end.
"""
from __future__ import annotations

import os
from typing import Any

import structlog
from fastapi import APIRouter, FastAPI, HTTPException, Request

# BUSINESS-SLICES P1 wave 3: hook 1 (auth).
from mate_platform.auth import install_auth

from .prompts.templates import list_prompts, render_prompt
from .resources.ontology import OntologyResource, build_ontology_resource
from .server import MCPServer, create_server
from .tools.kb_search import build_kb_search_tool
from .tools.rate_limit import RateLimitConfig, RateLimitExceeded, ToolRateLimiter

logger = structlog.get_logger(__name__)

# MCP server (lazy import mcp).
mcp_server: MCPServer = create_server()

# Register the kb_search tool (ST-5.3.2.1).
mcp_server.register_tool(build_kb_search_tool())

# Ontology resource.
_ontology: OntologyResource = build_ontology_resource()
mcp_server.register_resource(_ontology)

# per-tenant per-tool rate limiter.
_rate_limiter = ToolRateLimiter(config=RateLimitConfig(limit=50, window_sec=60))

# HTTP bridge router carrying the 5 spec endpoints. Endpoint
# handlers must be registered onto `http_bridge` BEFORE we call
# `app.include_router(http_bridge)` below — otherwise FastAPI
# mounts an empty router and the consumers see 404. The previous
# version of this file declared the endpoints below include_router,
# which silently produced an empty surface.
http_bridge = APIRouter(prefix="/api/v1/mcp", tags=["mcp"])


@http_bridge.get("/tools")
async def list_tools_endpoint() -> dict[str, list]:
    """ST-5.3.8.2: list registered tools."""
    return {"tools": await mcp_server.list_tools()}


@http_bridge.get("/resources")
async def list_resources_endpoint() -> dict[str, list]:
    """ST-5.3.8.2: list registered resources."""
    return {"resources": await mcp_server.list_resources()}


@http_bridge.get("/prompts")
async def list_prompts_endpoint() -> dict[str, list]:
    """ST-5.3.4: list prompt templates."""
    return {"prompts": list_prompts()}


@http_bridge.post("/prompts/{name}")
async def render_prompt_endpoint(
    name: str,
    payload: dict,
    request: Request,
) -> dict[str, str]:
    """ST-5.3.4: render a prompt template.

    Requires Authorization: Bearer <JWT>.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth[len("Bearer "):]
    # Lazy import: dev-only legacy verifier; production profile
    # rejects the LEGACY_LOGIN_COMPAT path at startup (SEC-IAM-01).
    from .auth import AuthError, verify_jwt_token

    try:
        await verify_jwt_token(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    try:
        rendered = render_prompt(name, **payload)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found") from None
    return {"name": name, "rendered": rendered}


@http_bridge.post("/tools/{name}")
async def call_tool_endpoint(
    name: str,
    payload: dict,
    request: Request,
) -> dict[str, object]:
    """ST-5.3.8.1: invoke a tool over HTTP.

    Body:
        {"arguments": {"query": "...", "top_k": 5}}

    Headers:
        Authorization: Bearer <JWT>
        X-Tenant-Id: <tenant>
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth[len("Bearer "):]
    from .auth import AuthError, verify_jwt_token

    try:
        claims = await verify_jwt_token(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    tenant_id = claims.get("tenant_id", "default")

    # per-tenant rate limiting.
    try:
        await _rate_limiter.check(tenant_id=tenant_id, tool_name=name)
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=429,
            detail=str(e),
            headers={"Retry-After": str(e.retry_after)},
        ) from e

    arguments = payload.get("arguments", {})
    try:
        result = await mcp_server.call_tool(name, arguments)
        return {"tool": name, "result": result}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found") from None
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


app = FastAPI(
    title="mate-tech-mcp",
    version="0.1.0",
    description="MCP (Model Context Protocol) HTTP bridge.",
)

# Hook 1 of 5: install SEC-IAM-01 auth middleware.
install_auth(app)

# Mount the bridge AFTER all routes are registered on it.
app.include_router(http_bridge)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    """Liveness probe."""
    return {"status": "ok", "version": app.version, "tools": len(mcp_server._tools)}  # pyright: ignore[reportPrivateUsage]


@app.on_event("startup")  # pyright: ignore[reportDeprecated]
async def on_startup() -> None:
    """lifespan hook."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(__import__("logging"), log_level)
        ),
    )
    logger.info(
        "mate-tech-mcp.startup",
        version=app.version,
        transport=os.getenv("MCP_TRANSPORT", "stdio"),
    )


def run_stdio() -> None:
    """ST-5.3.1.2 DoD: stdio transport entry."""
    import asyncio

    from mcp.server.stdio import stdio_server

    async def arun() -> None:
        server = await mcp_server._ensure_server()  # pyright: ignore[reportPrivateUsage]
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream, write_stream, server.create_initialization_options()
            )

    asyncio.run(arun())


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio").lower()
    if transport == "stdio":
        run_stdio()
    else:
        import uvicorn

        uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8081")))  # noqa: S104