"""1.1 task 1a: the MCP protocol surface binds the *authenticated* tenant.

Before 1.1 the streamable surface resolved dynamic tools against a
hardcoded ``default`` tenant, so every external client — regardless of
which ``sk-mcp-*`` key it presented — saw the same tool face. These tests
pin the new contract:

  - the tenant comes from ``request.state.ctx`` (set by ``install_auth``)
  - a request with no resolvable tenant **fails closed** (never ``default``)
  - tenant A never sees tenant B's dynamically-registered tools
  - the *static* surface is tenant-filtered too

The last test is a real streamable-http round-trip through a mounted
FastAPI app, proving that the auth middleware's ``request.state.ctx``
actually reaches the protocol surface across a Starlette mount.
"""

from __future__ import annotations

import asyncio
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager

import pytest

from mate_tech_mcp.protocol.streamable import (
    MateStreamableHttpServer,
    build_streamable_http_app,
)
from mate_tech_mcp.repositories import register_tool, reset_store
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


class _Ctx:
    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id


class _State:
    def __init__(self, tenant_id: str | None) -> None:
        if tenant_id is not None:
            self.ctx = _Ctx(tenant_id)


class _Request:
    def __init__(self, tenant_id: str | None) -> None:
        self.state = _State(tenant_id)


class _RequestContext:
    def __init__(self, tenant_id: str | None) -> None:
        self.request = _Request(tenant_id)


def _build_server() -> object:
    server = create_server("test-tenant-binding")
    t = AddTool()
    t.handler = t  # type: ignore[attr-defined]
    server.register_tool(t)
    return server


@contextmanager
def _in_request(tenant_id: str | None) -> Iterator[None]:
    """Simulate an in-flight MCP message carrying ``request.state.ctx``.

    ``Server.request_context`` is backed by the ``request_ctx`` ContextVar,
    so the fake is installed there rather than on the instance.
    """
    from mcp.server.lowlevel.server import request_ctx

    token = request_ctx.set(_RequestContext(tenant_id))  # type: ignore[arg-type]
    try:
        yield
    finally:
        request_ctx.reset(token)


@pytest.fixture(autouse=True)
def _clean_store():
    reset_store()
    yield
    reset_store()


# --- tenant resolution ---------------------------------------------------
@pytest.mark.asyncio
async def test_resolve_tenant_reads_request_state_ctx() -> None:
    surf = MateStreamableHttpServer(_build_server(), default_tenant="default")
    with _in_request("tenant-a"):
        assert await surf._resolve_tenant() == "tenant-a"  # pyright: ignore[reportPrivateUsage]


@pytest.mark.asyncio
async def test_resolve_tenant_fails_closed_without_ctx() -> None:
    """In a request, no authenticated tenant must NOT downgrade to default."""
    surf = MateStreamableHttpServer(_build_server(), default_tenant="default")
    with _in_request(None), pytest.raises(PermissionError):
        await surf._resolve_tenant()  # pyright: ignore[reportPrivateUsage]


@pytest.mark.asyncio
async def test_resolve_tenant_falls_back_outside_request() -> None:
    """No HTTP request at all (stdio / direct unit call) keeps default."""
    surf = MateStreamableHttpServer(_build_server(), default_tenant="default")
    assert await surf._resolve_tenant() == "default"  # pyright: ignore[reportPrivateUsage]


# --- dynamic surface -----------------------------------------------------
@pytest.mark.asyncio
async def test_dynamic_tools_are_tenant_scoped() -> None:
    register_tool("tenant-a", "a_only", endpoint="http://a:9000")
    register_tool("tenant-b", "b_only", endpoint="http://b:9000")
    surf = MateStreamableHttpServer(_build_server(), default_tenant="default")

    with _in_request("tenant-a"):
        names = {t.name for t in await surf.list_tools()}
    assert "a_only" in names
    assert "b_only" not in names  # cross-tenant negative

    with _in_request("tenant-b"):
        names = {t.name for t in await surf.list_tools()}
    assert "b_only" in names
    assert "a_only" not in names


@pytest.mark.asyncio
async def test_call_tool_rejects_foreign_tenant_dynamic_tool() -> None:
    register_tool("tenant-b", "b_only", endpoint="http://b:9000")
    surf = MateStreamableHttpServer(_build_server(), default_tenant="default")
    with _in_request("tenant-a"), pytest.raises(ValueError):
        await surf.call_tool("b_only", {})


# --- static surface ------------------------------------------------------
@pytest.mark.asyncio
async def test_static_surface_is_tenant_filtered() -> None:
    server = create_server("test-static-tenant")
    t = AddTool()
    t.handler = t  # type: ignore[attr-defined]
    server.register_tool(t, tenant="tenant-a")  # type: ignore[call-arg]
    surf = MateStreamableHttpServer(server, default_tenant="default")

    with _in_request("tenant-b"):
        assert "add" not in {x.name for x in await surf.list_tools()}

    with _in_request("tenant-a"):
        assert "add" in {x.name for x in await surf.list_tools()}


@pytest.mark.asyncio
async def test_platform_wide_static_tool_visible_to_all_tenants() -> None:
    """Tools registered without a tenant stay platform-wide (back-compat)."""
    server = create_server("test-static-platform")
    t = AddTool()
    t.handler = t  # type: ignore[attr-defined]
    server.register_tool(t)
    surf = MateStreamableHttpServer(server, default_tenant="default")
    with _in_request("tenant-a"):
        assert "add" in {x.name for x in await surf.list_tools()}


# --- downstream token passthrough ----------------------------------------
class _CtxWithAuth:
    def __init__(self, tenant_id: str, auth_method: object) -> None:
        self.tenant_id = tenant_id
        self.auth_method = auth_method


class _StateWithAuth:
    def __init__(self, ctx: _CtxWithAuth) -> None:
        self.ctx = ctx


class _RequestWithHeaders:
    def __init__(self, ctx: _CtxWithAuth, token: str) -> None:
        self.state = _StateWithAuth(ctx)
        self.headers = {"authorization": f"Bearer {token}"} if token else {}


class _RcWithHeaders:
    def __init__(self, request: _RequestWithHeaders) -> None:
        self.request = request


@pytest.mark.asyncio
async def test_user_token_is_forwarded_downstream() -> None:
    from mate_platform.tenancy import AuthMethod
    from mcp.server.lowlevel.server import request_ctx

    surf = MateStreamableHttpServer(_build_server())
    ctx = _CtxWithAuth("tenant-a", AuthMethod.USER)
    token = request_ctx.set(  # type: ignore[arg-type]
        _RcWithHeaders(_RequestWithHeaders(ctx, "eyJ.user.jwt"))
    )
    try:
        assert surf._request_bearer() == "eyJ.user.jwt"  # pyright: ignore[reportPrivateUsage]
    finally:
        request_ctx.reset(token)


@pytest.mark.asyncio
async def test_api_key_token_is_not_forwarded_downstream() -> None:
    """sk-mcp keys are centre-only; other services cannot verify them."""
    from mate_platform.tenancy import AuthMethod
    from mcp.server.lowlevel.server import request_ctx

    surf = MateStreamableHttpServer(_build_server())
    ctx = _CtxWithAuth("tenant-a", AuthMethod.API_KEY)
    token = request_ctx.set(  # type: ignore[arg-type]
        _RcWithHeaders(_RequestWithHeaders(ctx, "sk-mcp-secret"))
    )
    try:
        assert surf._request_bearer() == ""  # pyright: ignore[reportPrivateUsage]
    finally:
        request_ctx.reset(token)


# --- real round-trip across the mount ------------------------------------
def test_mounted_surface_resolves_tenant_from_auth_middleware() -> None:
    """End-to-end: auth middleware -> Starlette mount -> protocol surface."""
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId
    from starlette.middleware.base import BaseHTTPMiddleware

    class StubAuth(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):  # type: ignore[no-untyped-def]
            tenant = request.headers.get("x-test-tenant", "")
            if not tenant:
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
            request.state.ctx = RequestContext(
                request_id="",
                trace_id="",
                tenant_id=TenantId(tenant),
                user_id=UserId("u-1"),
                roles=frozenset(),
                permissions=frozenset(),
                scopes=frozenset(),
                client_id="test",
                auth_method=AuthMethod.API_KEY,
            )
            return await call_next(request)

    register_tool("tenant-a", "a_only", endpoint="http://a:9000")
    register_tool("tenant-b", "b_only", endpoint="http://b:9000")

    sub_app = build_streamable_http_app(_build_server())
    app = FastAPI()
    app.add_middleware(StubAuth)
    app.mount("/api/v1/mcp/protocol", sub_app)

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _lifespan(_app: FastAPI):
        async with sub_app.mate_server.session_manager.run():  # type: ignore[attr-defined]
            yield

    app.router.lifespan_context = _lifespan

    import uvicorn

    cfg = uvicorn.Config(app, host="127.0.0.1", port=18611, log_level="error")
    server = uvicorn.Server(cfg)
    threading.Thread(target=server.run, daemon=True).start()
    time.sleep(1.5)

    from mcp.client.session import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async def _names(tenant: str) -> set[str]:
        async with (
            streamablehttp_client(
                "http://127.0.0.1:18611/api/v1/mcp/protocol/mcp",
                headers={"x-test-tenant": tenant},
            ) as (read, write, _sid),
            ClientSession(read, write) as session,
        ):
            await session.initialize()
            tools = await session.list_tools()
            return {t.name for t in tools.tools}

    try:
        a = asyncio.run(_names("tenant-a"))
        b = asyncio.run(_names("tenant-b"))
    finally:
        server.should_exit = True

    assert "a_only" in a and "b_only" not in a
    assert "b_only" in b and "a_only" not in b
