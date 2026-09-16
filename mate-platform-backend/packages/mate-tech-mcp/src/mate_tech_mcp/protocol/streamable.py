"""Streamable-http MCP protocol surface (W4).

Mounts a real MCP protocol endpoint (``/api/v1/mcp/protocol/mcp``) alongside the
REST bridge so external MCP clients (Claude Desktop, Cursor, …) can
discover and call the center's tools over the standard streamable-http
transport.

The surface is a ``FastMCP`` subclass whose ``list_tools`` /
``call_tool`` / resources / prompts delegate to the ``MCPServer``
runtime registry — so it reflects the W2 dynamic registry and the
federation fallback, not a static snapshot.

Tenant binding (ADR-0062 / 1.1 task 1a)
---------------------------------------
Every message on this surface is resolved against the **authenticated
caller's** tenant, read from ``request.state.ctx`` — the context
``mate_platform.auth.install_auth`` installs before the Starlette mount
is reached. ``default_tenant`` is only a fallback for callers with no
HTTP request at all (stdio, direct unit invocation); inside a request a
missing tenant context **fails closed** rather than silently resolving
against ``default``.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from mate_platform.tenancy import AuthMethod
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings as _TransportSecuritySettings
from mcp.types import (
    GetPromptResult,
    Prompt,
    PromptArgument,
    PromptMessage,
    Resource,
    TextContent,
    Tool,
)
from pydantic import AnyUrl

from ..caller_context import bind_caller
from ..federation_routes import federation_router
from ..prompts.templates import list_prompts as list_prompt_templates
from ..prompts.templates import render_prompt
from ..repositories import get_tool_by_name, list_dynamic_tools
from ..tools.forwarding import get_dynamic_invoker


class MateStreamableHttpServer(FastMCP):
    """FastMCP surface delegating to the MCPServer runtime registry."""

    def __init__(
        self,
        mcp_server: Any,
        *,
        name: str = "mate-tech-mcp",
        default_tenant: str = "default",
        settings: dict[str, Any] | None = None,
    ) -> None:
        self._mcp = mcp_server
        self._default_tenant = default_tenant
        super().__init__(name, **(settings or {}))

    # -- tenant binding ---------------------------------------------------
    def _request_object(self) -> Any | None:
        """The Starlette request of the in-flight HTTP message, if any.

        ``request.state`` is backed by ``scope['state']``, which survives the
        parent app's mount into this sub-app.
        """
        try:
            request_context = self._mcp_server.request_context
        except LookupError:
            return None
        return getattr(request_context, "request", None)

    def _request_tenant(self) -> str | None:
        """Tenant of the authenticated caller, or None outside a request."""
        request = self._request_object()
        if request is None:
            return None
        ctx = getattr(getattr(request, "state", None), "ctx", None)
        tenant = str(getattr(ctx, "tenant_id", "") or "")
        return tenant or None

    def _request_bearer(self) -> str:
        """The caller's raw bearer token, forwarded to downstream services.

        Only a real (JWT) bearer is forwarded: an ``sk-mcp-*`` key is a
        MCP-centre-only credential that no other service can verify, so for
        API-key callers the proxy falls back to the service identity while
        still naming the caller's tenant. See
        :class:`~mate_tech_mcp.caller_context.CallerContext`.
        """
        request = self._request_object()
        state = getattr(request, "state", None)
        if getattr(getattr(state, "ctx", None), "auth_method", None) == AuthMethod.API_KEY:
            return ""
        headers = getattr(request, "headers", None)
        header = headers.get("authorization") if headers is not None else None
        if not header:
            return ""
        parts = str(header).split(None, 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1].strip()
        return ""

    async def _resolve_tenant(self) -> str:
        """Resolve the tenant for this message; fail closed inside a request."""
        tenant = self._request_tenant()
        if tenant:
            return tenant
        if self._in_request():
            raise PermissionError(
                "MCP protocol calls require an authenticated tenant context; "
                "present an sk-mcp-* key or a user bearer token"
            )
        return self._default_tenant

    def _in_request(self) -> bool:
        """True when this call is running inside an HTTP MCP message."""
        try:
            return self._mcp_server.request_context is not None
        except LookupError:
            return False

    # -- tools -----------------------------------------------------------
    async def list_tools(self) -> list[Tool]:
        tenant = await self._resolve_tenant()
        static = await self._mcp.list_tools(tenant)
        known = {t["name"] for t in static}
        tools = [
            Tool(
                name=t["name"],
                description=t.get("description", ""),
                inputSchema=t.get("inputSchema") or {"type": "object"},
            )
            for t in static
        ]
        # W2 dynamic registry, scoped to the authenticated tenant.
        for d in list_dynamic_tools(tenant):
            if d.name not in known and d.enabled:
                tools.append(
                    Tool(
                        name=d.name,
                        description=d.description,
                        inputSchema=d.input_schema or {"type": "object"},
                    )
                )
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        tenant = await self._resolve_tenant()
        args = dict(arguments or {})
        # HITL 边界加固（外部协议面）：__caller__ 是平台内部 origin 路由
        # （用户会话）专用的声明通道，外部 MCP 客户端传来的 __caller__ 一律
        # 剥除 —— 远端 AI 客户端永远按 agent 视角，HITL 工具
        # （ont_confirm/reject/execute_proposal）在此面必然 PermissionError。
        args.pop("__caller__", None)
        # 1.1 task 1c: downstream proxies (ontology) must go out as the caller.
        with bind_caller(tenant_id=tenant, bearer_token=self._request_bearer()):
            return await self._dispatch(name, args, tenant)

    async def _dispatch(self, name: str, args: dict[str, Any], tenant: str) -> Any:
        # 1. local handler
        try:
            return await self._mcp.call_tool(name, args, tenant_id=tenant)
        except KeyError:
            pass
        # 2. W2 dynamic forwarding tool
        dyn = get_tool_by_name(tenant, name)
        if dyn is not None and dyn.enabled and dyn.endpoint:
            try:
                return await get_dynamic_invoker().invoke(
                    tenant_id=tenant,
                    name=name,
                    endpoint=dyn.endpoint,
                    arguments=args,
                )
            except RuntimeError as e:
                raise ValueError(str(e)) from e
        # 3. federation fallback
        try:
            remote = await federation_router.route(
                tenant_id=tenant,
                tool_name=name,
                arguments=args,
            )
            if remote is not None:
                return remote
        except RuntimeError as e:
            raise ValueError(str(e)) from e
        raise ValueError(f"Tool not found: {name}")

    # -- resources -------------------------------------------------------
    async def list_resources(self) -> list[Resource]:
        return [
            Resource(uri=r.get("uri", "?"), name=r.get("name", ""))
            for r in await self._mcp.list_resources()
        ]

    async def read_resource(self, uri: AnyUrl | str) -> Iterable[Any]:
        # The runtime wrapper does not expose a read handler yet; resource
        # reads surface as an error until a read path is wired.
        raise ValueError(f"Resource read not supported: {uri}")

    # -- prompts ---------------------------------------------------------
    async def list_prompts(self) -> list[Prompt]:
        return [
            Prompt(
                name=p["name"],
                description=p.get("description", ""),
                arguments=[
                    PromptArgument(name=a["name"], required=a.get("required", False))
                    for a in p.get("arguments", ())
                ],
            )
            for p in list_prompt_templates()
        ]

    async def get_prompt(
        self,
        name: str,
        arguments: dict[str, Any] | None = None,
    ) -> GetPromptResult:
        try:
            rendered = render_prompt(name, **(arguments or {}))
        except KeyError as e:
            raise ValueError(f"Prompt not found: {name}") from e
        return GetPromptResult(
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(type="text", text=rendered),
                )
            ]
        )


def build_streamable_http_app(mcp_server: Any):
    """Return the Starlette streamable-http app for the MCPServer.

    server 实例挂到 app.mate_server —— Starlette mount 不执行子应用
    lifespan，父应用必须用 server.session_manager.run() 托管会话管理器
    （否则外部 POST 一律 "Task group is not initialized" 500）。
    """
    # DNS 防重绑定白名单：默认仅 localhost；经 API 网关转发时 Host 是
    # upstream 服务名（mate-tech-mcp:8081）或对外域名 —— 由
    # MCP_ALLOWED_HOSTS（逗号分隔）注入。"*" 关闭校验（仅限内网部署）。
    import os as _os

    allowed = _os.getenv("MCP_ALLOWED_HOSTS", "")
    settings: dict[str, Any] = {}
    if allowed:
        settings["transport_security"] = _TransportSecuritySettings(
            allowed_hosts=[h.strip() for h in allowed.split(",") if h.strip()],
            allowed_origins=["*"],
        )
    server = MateStreamableHttpServer(mcp_server, settings=settings)
    app = server.streamable_http_app()
    app.mate_server = server  # type: ignore[attr-defined]
    return app
