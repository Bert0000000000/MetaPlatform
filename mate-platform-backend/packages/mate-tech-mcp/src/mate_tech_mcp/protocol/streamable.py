"""Streamable-http MCP protocol surface (W4).

Mounts a real MCP protocol endpoint (``/api/v1/mcp/protocol/mcp``) alongside the
REST bridge so external MCP clients (Claude Desktop, Cursor, …) can
discover and call the center's tools over the standard streamable-http
transport.

The surface is a ``FastMCP`` subclass whose ``list_tools`` /
``call_tool`` / resources / prompts delegate to the ``MCPServer``
runtime registry — so it reflects the W2 dynamic registry and the
federation fallback, not a static snapshot. Tenant resolution for the
dynamic/federation layers uses the ``default`` tenant (the MCP protocol
carries no tenant header; the outer ``install_auth`` middleware gates
the mount path).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

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
        self._tenant = default_tenant
        super().__init__(name, **(settings or {}))

    # -- tools -----------------------------------------------------------
    async def list_tools(self) -> list[Tool]:
        static = await self._mcp.list_tools()
        known = {t["name"] for t in static}
        tools = [
            Tool(
                name=t["name"],
                description=t.get("description", ""),
                inputSchema=t.get("inputSchema") or {"type": "object"},
            )
            for t in static
        ]
        # W2 dynamic registry (default tenant).
        for d in list_dynamic_tools(self._tenant):
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
        args = dict(arguments or {})
        # HITL 边界加固（外部协议面）：__caller__ 是平台内部 origin 路由
        # （用户会话）专用的声明通道，外部 MCP 客户端传来的 __caller__ 一律
        # 剥除 —— 远端 AI 客户端永远按 agent 视角，HITL 工具
        # （ont_confirm/reject/execute_proposal）在此面必然 PermissionError。
        args.pop("__caller__", None)
        # 1. local handler
        try:
            return await self._mcp.call_tool(name, args)
        except KeyError:
            pass
        # 2. W2 dynamic forwarding tool
        dyn = get_tool_by_name(self._tenant, name)
        if dyn is not None and dyn.enabled and dyn.endpoint:
            try:
                return await get_dynamic_invoker().invoke(
                    tenant_id=self._tenant,
                    name=name,
                    endpoint=dyn.endpoint,
                    arguments=args,
                )
            except RuntimeError as e:
                raise ValueError(str(e)) from e
        # 3. federation fallback
        try:
            remote = await federation_router.route(
                tenant_id=self._tenant,
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
