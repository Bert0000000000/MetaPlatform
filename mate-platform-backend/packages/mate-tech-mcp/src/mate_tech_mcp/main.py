"""Mate Platform - MCP main entry.

ST-5.3.1.2: mcp.Server 闁诲骸婀遍崑妯兼閵夆晛绀?+ stdio 闂佸憡鍑归崹鐗堟叏?ST-5.3.6.1: 闂備焦婢樼粔鍫曟偪閸℃瑦灏?env
ST-5.3.8.1: HTTP 濠碘剝銇滈崕鑼暜?/api/v1/mcp/tools/{name}
"""
from __future__ import annotations

import os
from typing import Any

import structlog
from fastapi import APIRouter, FastAPI, HTTPException, Request

from .auth import AuthError, verify_jwt_token
from .prompts.templates import list_prompts, render_prompt
from .resources.ontology import OntologyResource, build_ontology_resource
from .server import MCPServer, create_server
from .tools.kb_search import build_kb_search_tool
from .tools.rate_limit import RateLimitConfig, ToolRateLimiter

logger = structlog.get_logger(__name__)

# 闂佺绻堥崝宀勬儑?MCP server 闁诲骸婀遍崑妯兼?
mcp_server: MCPServer = create_server()

# 婵帗绋掗…鍫ヮ敇鐠囨祴鏋栭柕濞垮劚閺傗偓 kb_search 閻庤鎮堕崕閬嶅矗閸ф鏅柛锔惧竸-5.3.2.1闂?
mcp_server.register_tool(build_kb_search_tool())

# ontology 闁荤姍鍐仾缂?
_ontology: OntologyResource = build_ontology_resource()


def _register_default_resources() -> None:
    """濠电偛顦崝宀勫船閼恒儺娓舵俊顖涱儥閸氬洭鎮硅鐎氼厾鑺遍鈧弫宥夊锤椤хology://{class_id}闂?"""
    mcp_server.register_resource(_ontology)


_register_default_resources()

# per-tenant per-tool 闂傚倸瀚崝鏍矈閿曞倸闂?
_rate_limiter = ToolRateLimiter(config=RateLimitConfig(limit=50, window_sec=60))

# HTTP 濠碘剝銇滈崕鑼暜鐎靛憡宕夋い鏍ㄧ矋閺嗙娀鏌ㄥ☉妯荤astAPI 婵＄偛顑呯€涒晠鎮ч幖浣规櫖?
http_bridge = APIRouter(prefix="/api/v1/mcp", tags=["mcp"])


app = FastAPI(
    title="mate-tech-mcp",
    version="0.1.0",
    description="MCP (Model Context Protocol) server",
)

app.include_router(http_bridge)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    """ST-5.3.6.2 DoD: 闂佺顑冮崕閬嶅箖瀹ュ憘娑㈠焵椤掑嫬钃?"""
    return {"status": "ok", "version": app.version, "tools": len(mcp_server._tools)}


@http_bridge.get("/tools")
async def list_tools_endpoint() -> dict[str, list]:
    """ST-5.3.8.2: 閻庤鎮堕崕閬嶅矗閸ф绀嗘俊銈呭閳?"""
    return {"tools": await mcp_server.list_tools()}


@http_bridge.get("/resources")
async def list_resources_endpoint() -> dict[str, list]:
    """ST-5.3.8.2: 闁荤姍鍐仾缂侇煈鍣ｅ畷姘旈崟鈹惧亾?"""
    return {"resources": await mcp_server.list_resources()}


@http_bridge.get("/prompts")
async def list_prompts_endpoint() -> dict[str, list]:
    """ST-5.3.4: 闂佸湱绮崝妤呭Φ濮橆儵鐔煎焺閸愨晝鍑￠梺鍛婂笚椤ㄥ濡?"""
    return {"prompts": list_prompts()}


@http_bridge.post("/prompts/{name}")
async def render_prompt_endpoint(name: str, payload: dict) -> dict[str, str]:
    """ST-5.3.4: 濠电偞鎸稿鍫曟偂?prompt."""
    try:
        rendered = render_prompt(name, **payload)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
    return {"name": name, "rendered": rendered}


@http_bridge.post("/tools/{name}")
async def call_tool_endpoint(
    name: str,
    payload: dict,
    request: Request,
) -> dict[str, object]:
    """ST-5.3.8.1: HTTP 濠碘剝銇滈崕鑼暜?闂?闁荤姴顑呴崯顐ｅ閹版澘绀?

    Body:
        {"arguments": {"query": "...", "top_k": 5}}

    Headers:
        Authorization: Bearer <JWT>  (ST-5.3.9 闂佸搫绋勭换婵嬫偘?
        X-Tenant-Id: <tenant>        (ST-5.3.7 闂傚倸瀚崝鏍矈?
    """
    # OAuth: JWT 闂佸搫绋勭换婵嬫偘?(ST-5.3.9)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth[len("Bearer "):]
    try:
        claims = await verify_jwt_token(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    tenant_id = claims.get("tenant_id", "default")

    # 闂傚倸瀚崝鏍矈?(ST-5.3.7)
    try:
        await _rate_limiter.check(tenant_id=tenant_id, tool_name=name)
    except Exception as e:  # RateLimitExceeded
        from .tools.rate_limit import RateLimitExceeded
        if isinstance(e, RateLimitExceeded):
            raise HTTPException(
                status_code=429,
                detail=str(e),
                headers={"Retry-After": str(e.retry_after)},
            )
        raise

    # 闁荤姴顑呴崯顐ｅ閹版澘绀?    arguments = payload.get("arguments", {})
    try:
        result = await mcp_server.call_tool(name, arguments)
        return {"tool": name, "result": result}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def on_startup() -> None:
    """lifespan 闂備浇袙閺呮盯鎮?"""
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
    """ST-5.3.1.2 DoD: stdio 闂佸憡鍑归崹鐗堟叏?"""
    import asyncio

    from mcp.server.stdio import stdio_server

    async def arun() -> None:
        server = await mcp_server._ensure_server()
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
        uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8081")))