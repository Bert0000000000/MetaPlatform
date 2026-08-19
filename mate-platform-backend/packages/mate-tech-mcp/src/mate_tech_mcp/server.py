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
                # MP-SAL-04 / ADR-0044：operationId + agent_invokable 桥接
                "operationId": getattr(t, "operation_id", ""),
                "capabilities": list(getattr(t, "capabilities", ())),
                "agentInvokable": bool(getattr(t, "agent_invokable", True)),
                "readonlyByUser": bool(getattr(t, "readonly_by_user", False)),
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
        """调用已注册工具.

        MP-SAL-04 / ADR-0044 HITL 边界：若 ``agent_invokable=False``，必须由
        caller 显式声明 ``__caller__="user"``；agent 调用（默认）会被拒。
        """
        if isinstance(arguments, dict):
            caller = arguments.pop("__caller__", None)
        else:
            caller = None
        for tool in self._tools:
            if getattr(tool, "name", None) == name:
                # HITL 闸门：agent_invokable=False 仅允许 user caller
                if not bool(getattr(tool, "agent_invokable", True)):
                    if caller != "user":
                        raise PermissionError(
                            f"Tool {name!r} is HITL-bound (agent_invokable=False); "
                            f"only user caller can invoke. Got __caller__={caller!r}",
                        )
                handler = getattr(tool, "handler", None)
                if handler is None:
                    # Fallback: 工具本身即 handler（ontology_proxy 风格）
                    handler = tool
                result = handler(**arguments)
                if hasattr(result, "__await__"):
                    result = await result
                return result
        raise KeyError(f"Tool '\''{name}'\'' not found")


def create_server(name: str | None = None) -> MCPServer:
    """工厂函数."""
    name = name or os.getenv("MCP_SERVER_NAME", "mate-tech-mcp")
    return MCPServer(name)