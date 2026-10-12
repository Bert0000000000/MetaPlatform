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
    required_scope = "platform.read"
    agent_invokable = True
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


def _surface(server):
    from types import SimpleNamespace

    surf = MateStreamableHttpServer(server)
    surf._request_object = lambda: SimpleNamespace(
        state=SimpleNamespace(
            ctx=SimpleNamespace(
                tenant_id="default", scopes=frozenset({"platform.read"}), auth_method="api_key"
            )
        ),
        headers={},
    )
    return surf


# --- unit ---------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_tools_excludes_unscoped_dynamic() -> None:
    server = _build_server()
    # The protocol surface resolves dynamic tools against the default tenant.
    register_tool("default", "hr_tool", endpoint="http://hr:9000")
    try:
        surf = _surface(server)
        tools = await surf.list_tools()
        names = [t.name for t in tools]
        assert "add" in names
        assert "hr_tool" not in names  # no trustworthy capability metadata
    finally:
        from mate_tech_mcp.repositories import reset_store

        reset_store()


@pytest.mark.asyncio
async def test_call_tool_local_handler() -> None:
    server = _build_server()
    surf = _surface(server)
    result = await surf.call_tool("add", {"a": 2, "b": 3})
    assert result == {"sum": 5}


@pytest.mark.asyncio
async def test_call_tool_unknown_raises() -> None:
    server = _build_server()
    surf = _surface(server)
    with pytest.raises(PermissionError):
        await surf.call_tool("nope", {})


# --- integration --------------------------------------------------------
def _authed_app(server: object) -> object:
    """Mount the protocol surface behind an auth middleware.

    1.1 task 1a: the surface resolves the tenant from ``request.state.ctx``
    and fails closed without it, so a round-trip needs the same middleware
    shape ``main.py`` installs via ``install_auth``.
    """
    from contextlib import asynccontextmanager

    from fastapi import FastAPI
    from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId
    from starlette.middleware.base import BaseHTTPMiddleware

    class StubAuth(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):  # type: ignore[no-untyped-def]
            request.state.ctx = RequestContext(
                request_id="",
                trace_id="",
                tenant_id=TenantId("default"),
                user_id=UserId("test-user"),
                roles=frozenset(),
                permissions=frozenset(),
                scopes=frozenset({"platform.read"}),
                client_id="test",
                auth_method=AuthMethod.API_KEY,
            )
            return await call_next(request)

    sub_app = build_streamable_http_app(server)
    app = FastAPI()
    app.add_middleware(StubAuth)
    app.mount("/api/v1/mcp/protocol", sub_app)

    @asynccontextmanager
    async def _lifespan(_app: FastAPI):
        async with sub_app.mate_server.session_manager.run():  # type: ignore[attr-defined]
            yield

    app.router.lifespan_context = _lifespan
    return app


def test_streamable_http_roundtrip() -> None:
    """Official MCP client <-> streamable-http surface end-to-end."""
    app = _authed_app(_build_server())
    cfg = uvicorn.Config(app, host="127.0.0.1", port=55517, log_level="error")
    u = uvicorn.Server(cfg)
    import socket

    listener = socket.socket()
    listener.bind(("127.0.0.1", 55517))  # checked-free owned loopback test listener
    thread = threading.Thread(target=lambda: u.run(sockets=[listener]), daemon=True)
    thread.start()
    for _ in range(100):
        if u.started:
            break
        time.sleep(0.02)

    from mcp.client.session import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    async def run() -> tuple[list[str], object]:
        async with (
            streamable_http_client("http://127.0.0.1:55517/api/v1/mcp/protocol/mcp") as (
                read,
                write,
                _sid,
            ),
            ClientSession(read, write) as session,
        ):
            await session.initialize()
            tools = await session.list_tools()
            names = [t.name for t in tools.tools]
            res = await session.call_tool("add", {"a": 4, "b": 5})
            return names, res

    try:
        assert u.started
        names, res = asyncio.run(run())
    finally:
        u.should_exit = True
        thread.join(5)
        listener.close()
        assert not thread.is_alive()
    assert "add" in names
    assert res.structuredContent == {"sum": 9}, res
