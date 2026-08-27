"""Streamable-http MCP protocol surface (W4).

Mounts a real MCP protocol endpoint (``/api/v1/mcp/protocol``) alongside the
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
    ) -> None:
        self._mcp = mcp_server
        self._tenant = default_tenant
        super().__init__(name)

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
        args = arguments or {}
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
                tenant_id=self._tenant, tool_name=name, arguments=args,
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
        self, name: str, arguments: dict[str, Any] | None = None,
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
    """Return the Starlette streamable-http app for the MCPServer."""
    server = MateStreamableHttpServer(mcp_server)
    return server.streamable_http_app()
