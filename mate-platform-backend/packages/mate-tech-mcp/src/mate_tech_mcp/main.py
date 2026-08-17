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
from mate_platform.messaging.outbox import InMemoryOutboxWriter

from .federation import ExternalMcpClient, FederationRegistry
from .federation_routes import _set_external_client as _share_federation_external_client
from .federation_routes import _set_outbox as _share_federation_outbox
from .federation_routes import _set_registry as _share_federation_registry
from .federation_routes import router as federation_router_routes
from .resources.ontology import OntologyResource, build_ontology_resource
from .server import MCPServer, create_server
from .tools.kb_search import build_kb_search_tool
from .tools.ontology_proxy import build_ontology_proxy_tools
from .tools.rate_limit import RateLimitConfig, ToolRateLimiter
from .tools.skill_search import build_read_skill_tool, build_search_skill_tool

logger = structlog.get_logger(__name__)

# MCP server (lazy import mcp).
mcp_server: MCPServer = create_server()

# Register the kb_search tool (ST-5.3.2.1).
mcp_server.register_tool(build_kb_search_tool())

# skill 检索工具（agent 按能力检索 skillhub → 读 SKILL.md 搭应用）。
mcp_server.register_tool(build_search_skill_tool())
mcp_server.register_tool(build_read_skill_tool())

# MP-SAL-01: ontology 三件套代理工具（tech-ont v2，ADR-0043 §2.3 消费者）。
for _tool in build_ontology_proxy_tools():
    mcp_server.register_tool(_tool)

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
# W2: wire a real outbox writer (was None, so federation/tool events were
# never emitted in production). In-memory for this batch; a SQL-backed
# relay can drain it to Kafka at startup (OutboxRelay.drain_once).
_outbox = InMemoryOutboxWriter()
_share_federation_outbox(_outbox)

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
app.state.outbox_writer = _outbox

# P3-W10 Fix-1: 5 spec endpoints mounted via the explicit origin router
# (api/origin_routes.py) so that spec-level scanners can discover them.
from .api.clients_routes import router as clients_router  # noqa: E402
from .api.extras_routes import router as extras_router  # noqa: E402
from .api.management_routes import router as management_router  # noqa: E402
from .api.origin_routes import router as origin_router  # noqa: E402

app.include_router(origin_router)
app.include_router(clients_router)
app.include_router(management_router)
# W5 P0 close-out: MCP center UI calls many endpoints that the contract-level
# mcp.yaml does not declare yet (audit / collaborations / tools/{id}/versions
# / resources/{id} / servers/{id} /status / permissions alias). Mount the
# extras router so the center no longer 404s on those.
app.include_router(extras_router)
# 扩展能力 (backlog §3.8): MCP Federation endpoints.
app.include_router(federation_router_routes)

# W4: real MCP protocol surface (streamable-http) for external MCP clients.
from .protocol.streamable import build_streamable_http_app  # noqa: E402

app.mount("/mcp-protocol", build_streamable_http_app(mcp_server))


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