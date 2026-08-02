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
from fastapi import APIRouter, FastAPI

# BUSINESS-SLICES P1 wave 3: hook 1 (auth).
from mate_platform.auth import install_auth

from .federation import ExternalMcpClient, FederationRegistry
from .federation_routes import _set_external_client as _share_federation_external_client
from .federation_routes import _set_outbox as _share_federation_outbox
from .federation_routes import _set_registry as _share_federation_registry
from .federation_routes import router as federation_router_routes
from .resources.ontology import OntologyResource, build_ontology_resource
from .server import MCPServer, create_server
from .tools.kb_search import build_kb_search_tool
from .tools.rate_limit import RateLimitConfig, ToolRateLimiter

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

# 扩展能力 (backlog §3.8): MCP Federation registry + external client.
federation_registry = FederationRegistry()
federation_external_client = ExternalMcpClient()
_share_federation_registry(federation_registry)
_share_federation_external_client(federation_external_client)
# Outbox writer is optional — None in test profile; production wires
# the InMemoryOutboxWriter or SQL-backed writer at startup.
_share_federation_outbox(None)

# P3-W10 Fix-1: the 5 spec endpoints now live in the explicit
# ``api/origin_routes.py`` router (registered via ``@router.get``/
# ``@router.post`` so spec-level scanners can discover them). This
# variable is retained as an empty router for backwards-compat with
# any external code that imports ``mate_tech_mcp.main.http_bridge``.
http_bridge = APIRouter(prefix="/api/v1/mcp", tags=["mcp"])


app = FastAPI(
    title="mate-tech-mcp",
    version="0.1.0",
    description="MCP (Model Context Protocol) HTTP bridge.",
)

# Hook 1 of 5: install SEC-IAM-01 auth middleware.
install_auth(app)

# Bind the MCP server + per-tenant rate limiter onto app.state so the
# origin router handlers (api/origin_routes.py) can resolve them without
# importing main.py (avoids a circular import).
app.state.mcp_server = mcp_server
app.state.rate_limiter = _rate_limiter

# P3-W10 Fix-1: 5 spec endpoints mounted via the explicit origin router
# (api/origin_routes.py) so that spec-level scanners can discover them.
from .api.origin_routes import router as origin_router  # noqa: E402

app.include_router(origin_router)
# 扩展能力 (backlog §3.8): MCP Federation endpoints.
app.include_router(federation_router_routes)


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