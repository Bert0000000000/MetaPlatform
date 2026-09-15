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

# skill 检索工具 (agent 按能力检索 skillhub -> 读 SKILL.md 搭应用).
mcp_server.register_tool(build_search_skill_tool())
mcp_server.register_tool(build_read_skill_tool())

# MP-SAL-01: ontology 三件套代理工具 (tech-ont v2, ADR-0043 §2.3 消费者).
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


def _register_ontology_server_capability() -> None:
    """MCP 中心平台能力登记（幂等）：本体引擎 MCP 服务。

    把平台自己的 ontology 能力面登记进 external-agent 注册表，使
    MCP 中心「服务端」tab 可见（endpoint 指向本服务的 streamable 协议端），
    外部客户端（Codex / Claude Code 等）按同一入口接入。
    """
    from datetime import UTC, datetime

    from .management_repo import ExternalAgent, get_external_agent, put_external_agent

    server_id = "srv-ontology-engine"
    if get_external_agent("tenant-default", server_id) is not None:
        return
    now = datetime.now(UTC).isoformat()
    put_external_agent(
        "tenant-default",
        ExternalAgent(
            id=server_id,
            tenant_id="tenant-default",
            name="Ontology Engine MCP",
            description=(
                "本体引擎能力面：类型发现/实例浏览(Interface 多态)/语义检索/"
                "结构化查询/三闸门自检/提案(带溯源)/Agent 指标。"
                "外部 AI 客户端经 streamable-http 接入，写路径全部走 "
                "proposal+HITL（AI 永不直写）。"
            ),
            endpoint="/api/v1/mcp/protocol/mcp",
            protocol_type="MCP",
            status="ACTIVE",
            trust_level="TRUSTED",
            auth_type="bearer",
            capabilities="ontology.read,ontology.write,proposal,hitl",
            created_at=now,
            updated_at=now,
        ),
    )
    logger.info("mcp.capability.ontology_engine.registered", server_id=server_id)


_register_ontology_server_capability()
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

# Hook 1 of 5: install SEC-IAM-01 auth middleware. The optional
# api_key_verifier (ADR-0062) is a second chance for long-lived external
# client keys: sk-mcp-* bearers that the JWT verifier rejects fall through to
# mcp_api_key_verifier. Every other token behaves exactly as before.
from .security import mcp_api_key_verifier

install_auth(app, api_key_verifier=mcp_api_key_verifier)

# Bind the MCP server + per-tenant rate limiter onto app.state so the
# origin router handlers (api/origin_routes.py) can resolve them without
# importing main.py (avoids a circular import).
app.state.mcp_server = mcp_server
app.state.rate_limiter = _rate_limiter
app.state.outbox_writer = _outbox

# P3-W10 Fix-1: 5 spec endpoints mounted via the explicit origin router
# (api/origin_routes.py) so that spec-level scanners can discover them.
from .api.clients_routes import router as clients_router
from .api.extras_routes import router as extras_router
from .api.management_routes import router as management_router
from .api.origin_routes import router as origin_router

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
from .protocol.streamable import build_streamable_http_app

# Keep the protocol endpoint inside the canonical /api/v1/mcp namespace so
# direct service callers and the API gateway expose the same contract.
_streamable_app = build_streamable_http_app(mcp_server)
app.mount("/api/v1/mcp/protocol", _streamable_app)

# Fix（2026-09-14）：Starlette mount 不执行子应用 lifespan —— FastMCP 的
# streamable session manager（task group）从未启动，外部客户端 POST 一律
# 500 "Task group is not initialized"。把子应用 lifespan 并入父应用；
# 自定义 lifespan_context 生效后 Starlette 不再自动跑 on_startup/on_shutdown
# 钩子，因此在 lifespan 内动态执行（含本文件后文注册的 startup 钩子）。
from contextlib import asynccontextmanager


@asynccontextmanager
async def _lifespan_with_streamable(_app: FastAPI):
    _streamable_server = _streamable_app.mate_server  # type: ignore[attr-defined]
    async with _streamable_server.session_manager.run():
        for hook in list(_app.router.on_startup):
            await hook()
        yield
        for hook in list(_app.router.on_shutdown):
            await hook()


app.router.lifespan_context = _lifespan_with_streamable


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    """Liveness probe."""
    return {"status": "ok", "version": app.version, "tools": len(mcp_server._tools)}  # pyright: ignore[reportPrivateUsage]


def _bootstrap_api_keys() -> None:
    """Wire the long-lived MCP API key store (ADR-0062).

    Gated on an explicit DSN, matching mate-tech-data's ``_bootstrap_sql``:
    without ``MATE_DB_URL`` the store stays None and every ``sk-mcp-*`` token
    is rejected (fail-closed) rather than silently falling back to a stray
    local SQLite file.

    Only ``mcp_api_keys`` is created here — not ``create_all()``, which would
    also materialise the catalog tables without the tenant RLS policies that
    the alembic chain attaches to them.
    """
    if not (os.environ.get("MATE_DB_URL") or os.environ.get("DATABASE_URL")):
        logger.info("mcp.api_keys.disabled", reason="MATE_DB_URL unset")
        return

    from mate_tech_db.base import get_engine

    from .repositories.sql_models import McpApiKeyORM
    from .security import McpApiKeyStore, set_api_key_runtime

    try:
        McpApiKeyORM.__table__.create(bind=get_engine(), checkfirst=True)
    except Exception:
        # Never let key-store wiring take the whole service down: without a
        # store the verifier fails closed, which is a safe degraded mode.
        logger.exception("mcp.api_keys.bootstrap_failed")
        return

    set_api_key_runtime(McpApiKeyStore())
    logger.info("mcp.api_keys.enabled")


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
    _bootstrap_api_keys()


def run_stdio() -> None:
    """ST-5.3.1.2 DoD: stdio transport entry."""
    import asyncio

    from mcp.server.stdio import stdio_server

    async def arun() -> None:
        server = await mcp_server._ensure_server()  # pyright: ignore[reportPrivateUsage]
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream, server.create_initialization_options())

    asyncio.run(arun())


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio").lower()
    if transport == "stdio":
        run_stdio()
    else:
        import uvicorn

        uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8081")))
