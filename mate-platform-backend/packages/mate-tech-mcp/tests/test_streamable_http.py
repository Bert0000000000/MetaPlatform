"""W4 tests: streamable-http MCP protocol surface (MateStreamableHttpServer).

Covers:
  - unit: the FastMCP subclass delegates list_tools / call_tool to the
    MCPServer runtime registry (incl. W2 dynamic tools)
  - integration: a real streamable-http round-trip via the official MCP
    client (initialize -> list_tools -> call_tool)
"""
from __future__ import annotations

import asyncio
import threading
import time

import pytest
import uvicorn

from mate_tech_mcp.protocol.streamable import (
    MateStreamableHttpServer,
    build_streamable_http_app,
)
from mate_tech_mcp.repositories import register_tool
from mate_tech_mcp.server import create_server


class AddTool:
    name = "add"
    description = "Add two numbers"
    input_schema = {
        "type": "object",
        "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
        "required": ["a", "b"],
    }

    async def __call__(self, **arguments):  # type: ignore[no-untyped-def]
        return {"sum": arguments["a"] + arguments["b"]}


def _build_server() -> object:
    server = create_server("test-shttp")
    t = AddTool()
    t.handler = t  # type: ignore[attr-defined]
    server.register_tool(t)
    return server


# --- unit ---------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_tools_includes_static_and_dynamic() -> None:
    server = _build_server()
    # The protocol surface resolves dynamic tools against the default tenant.
    register_tool("default", "hr_tool", endpoint="http://hr:9000")
    try:
        surf = MateStreamableHttpServer(server)
        tools = await surf.list_tools()
        names = [t.name for t in tools]
        assert "add" in names
        assert "hr_tool" in names  # W2 dynamic registry surfaced
    finally:
        from mate_tech_mcp.repositories import reset_store

        reset_store()


@pytest.mark.asyncio
async def test_call_tool_local_handler() -> None:
    server = _build_server()
    surf = MateStreamableHttpServer(server)
    result = await surf.call_tool("add", {"a": 2, "b": 3})
    assert result == {"sum": 5}


@pytest.mark.asyncio
async def test_call_tool_unknown_raises() -> None:
    server = _build_server()
    surf = MateStreamableHttpServer(server)
    with pytest.raises(ValueError):
        await surf.call_tool("nope", {})


# --- integration --------------------------------------------------------
def test_streamable_http_roundtrip() -> None:
    """Official MCP client <-> streamable-http surface end-to-end."""
    app = build_streamable_http_app(_build_server())
    cfg = uvicorn.Config(app, host="127.0.0.1", port=18601, log_level="error")
    u = uvicorn.Server(cfg)
    threading.Thread(target=u.run, daemon=True).start()
    time.sleep(1.0)

    from mcp.client.session import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async def run() -> tuple[list[str], object]:
        async with (
            streamablehttp_client("http://127.0.0.1:18601/mcp") as (read, write, _sid),
            ClientSession(read, write) as session,
        ):
            await session.initialize()
            tools = await session.list_tools()
            names = [t.name for t in tools.tools]
            res = await session.call_tool("add", {"a": 4, "b": 5})
            return names, res

    names, res = asyncio.run(run())
    u.should_exit = True
    assert "add" in names
    assert res.structuredContent == {"sum": 9}, res
