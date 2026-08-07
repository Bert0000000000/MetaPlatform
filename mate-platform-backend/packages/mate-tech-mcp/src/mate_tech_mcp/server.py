"""MCP Server (ST-5.3.1.2).

封装 mcp.Server 实例化与 stdio 启动。
"""
from __future__ import annotations

import os
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class MCPServer:
    """MCP Server wrapper (lazy import mcp to reduce startup overhead)."""

    def __init__(self, name: str = "mate-tech-mcp") -> None:
        self.name = name
        self._server: Any | None = None
        self._tools: list[Any] = []
        self._resources: list[Any] = []
        self._prompts: list[Any] = []

    async def _ensure_server(self) -> Any:
        """懒加载 mcp.Server."""
        if self._server is None:
            from mcp.server import Server
            self._server = Server(self.name)
            logger.info("mcp.server.created", name=self.name)
        return self._server

    def register_tool(self, tool: Any) -> None:
        """Register tool (lazy registration to MCP server)."""
        self._tools.append(tool)
        logger.info("mcp.tool.registered", name=getattr(tool, "name", "?"))

    def register_resource(self, resource: Any) -> None:
        """注册资源."""
        self._resources.append(resource)
        logger.info("mcp.resource.registered", uri=getattr(resource, "uri", "?"))

    def register_prompt(self, prompt: Any) -> None:
        """注册提示模板."""
        self._prompts.append(prompt)
        logger.info("mcp.prompt.registered", name=getattr(prompt, "name", "?"))

    async def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": getattr(t, "name", "?"),
                "description": getattr(t, "description", ""),
                "category": getattr(t, "category", ""),
                "inputSchema": getattr(t, "input_schema", {}),
            }
            for t in self._tools
        ]

    async def list_resources(self) -> list[dict[str, Any]]:
        return [
            {"uri": getattr(r, "uri", "?"), "name": getattr(r, "name", "")}
            for r in self._resources
        ]

    async def list_prompts(self) -> list[dict[str, Any]]:
        return [
            {"name": getattr(p, "name", "?"), "description": getattr(p, "description", "")}
            for p in self._prompts
        ]

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """调用已注册工具."""
        for tool in self._tools:
            if getattr(tool, "name", None) == name:
                handler = getattr(tool, "handler", None)
                if handler is None:
                    raise RuntimeError(f"Tool '\''{name}'\'' has no handler")
                result = handler(**arguments)
                if hasattr(result, "__await__"):
                    result = await result
                return result
        raise KeyError(f"Tool '\''{name}'\'' not found")


def create_server(name: str | None = None) -> MCPServer:
    """工厂函数."""
    name = name or os.getenv("MCP_SERVER_NAME", "mate-tech-mcp")
    return MCPServer(name)