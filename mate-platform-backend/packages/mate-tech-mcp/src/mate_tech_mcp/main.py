"""Mate Platform - MCP main entry.

ST-5.3.1.2: mcp.Server 閻庡湱鍋樼欢銉╁礌?+ stdio 闁告凹鍨版慨?ST-5.3.6.1: 闂佹澘绉堕悿鍡欐導?env
ST-5.3.8.1: HTTP 婵℃ぜ鍎茬敮?/api/v1/mcp/tools/{name}
"""
from __future__ import annotations

from typing import Any

import os

import structlog
from fastapi import APIRouter, FastAPI, HTTPException, Request

from .auth import verify_jwt_token, AuthError
from .prompts.templates import list_prompts, render_prompt
from .resources.ontology import OntologyResource, build_ontology_resource
from .server import MCPServer, create_server
from .tools.kb_search import build_kb_search_tool
from .tools.rate_limit import RateLimitConfig, ToolRateLimiter

logger = structlog.get_logger(__name__)

# 闁稿繈鍔岄惇?MCP server 閻庡湱鍋樼欢?mcp_server: MCPServer = create_server()

# 濮掓稒顭堥璇测枖閵娿儱鏂€ kb_search 鐎规悶鍎遍崣鍧楁晬閸︾帄-5.3.2.1闁?mcp_server.register_tool(build_kb_search_tool())

# ontology 閻犙冨缁?_ontology: OntologyResource = build_ontology_resource()


def _register_default_resources() -> None:
    """婵炲鍔岄崬鑺ヮ渶濡鍚囬悹褍瀚花顕€鏁嶉崸顧磘ology://{class_id}闁?"""
    mcp_server.register_resource(_ontology)


_register_default_resources()

# per-tenant per-tool 闂傚嫭鍔栫粊锕傚闯?_rate_limiter = ToolRateLimiter(config=RateLimitConfig(limit=50, window_sec=60))

# HTTP 婵℃ぜ鍎茬敮瀵告崉椤栨粍鏆犻柨娑樻箺astAPI 濡炲瀛╅悧鎼佹晬?http_bridge = APIRouter(prefix="/api/v1/mcp", tags=["mcp"])

http_bridge = APIRouter(prefix="/api/v1/mcp", tags=["mcp"])

app = FastAPI(
    title="mate-tech-mcp",
    version="0.1.0",
    description="MCP (Model Context Protocol) server",
)

app.include_router(http_bridge)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    """ST-5.3.6.2 DoD: 闁稿鍎遍幃宥呂涢埀顒勫蓟?"""
    return {"status": "ok", "version": app.version, "tools": len(mcp_server._tools)}


@http_bridge.get("/tools")
async def list_tools_endpoint() -> dict[str, list]:
    """ST-5.3.8.2: 鐎规悶鍎遍崣鍧楀礆濡ゅ嫨鈧?"""
    return {"tools": await mcp_server.list_tools()}


@http_bridge.get("/resources")
async def list_resources_endpoint() -> dict[str, list]:
    """ST-5.3.8.2: 閻犙冨缁噣宕氬Δ鍕┾偓?"""
    return {"resources": await mcp_server.list_resources()}


@http_bridge.get("/prompts")
async def list_prompts_endpoint() -> dict[str, list]:
    """ST-5.3.4: 闁圭粯鍔楅妵姘熼埄鍐╃凡闁告帗顨夐妴?"""
    return {"prompts": list_prompts()}


@http_bridge.post("/prompts/{name}")
async def render_prompt_endpoint(name: str, payload: dict) -> dict[str, str]:
    """ST-5.3.4: 婵炴挸寮堕悡?prompt."""
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
    """ST-5.3.8.1: HTTP 婵℃ぜ鍎茬敮?闁?閻犲鍟导鎰板礂?

    Body:
        {"arguments": {"query": "...", "top_k": 5}}

    Headers:
        Authorization: Bearer <JWT>  (ST-5.3.9 闁哄稄绻濋悰?
        X-Tenant-Id: <tenant>        (ST-5.3.7 闂傚嫭鍔栫粊?
    """
    # OAuth: JWT 闁哄稄绻濋悰?(ST-5.3.9)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth[len("Bearer "):]
    try:
        claims = await verify_jwt_token(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    tenant_id = claims.get("tenant_id", "default")

    # 闂傚嫭鍔栫粊?(ST-5.3.7)
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

    # 閻犲鍟导鎰板礂?    arguments = payload.get("arguments", {})
    try:
        result = await mcp_server.call_tool(name, arguments)
        return {"tool": name, "result": result}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def on_startup() -> None:
    """lifespan 闂佽В鏅涢悺?"""
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
    """ST-5.3.1.2 DoD: stdio 闁告凹鍨版慨?"""
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