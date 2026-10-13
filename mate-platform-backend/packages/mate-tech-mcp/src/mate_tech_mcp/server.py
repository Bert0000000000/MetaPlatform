"""MCP Server (ST-5.3.1.2).

封装 mcp.Server 实例化与 stdio 启动。
"""

from __future__ import annotations

import os
from typing import Any

import structlog

from .caller_context import current_caller

logger = structlog.get_logger(__name__)


class MCPServer:
    """MCP Server wrapper (lazy import mcp to reduce startup overhead)."""

    def __init__(self, name: str = "mate-tech-mcp") -> None:
        self.name = name
        self._server: Any | None = None
        self._tools: list[Any] = []
        # Tool name -> owning tenant. Tools registered without a tenant are
        # platform-wide and visible to every tenant (back-compat for the
        # tools wired at import time in main.py).
        self._tool_tenants: dict[str, str] = {}
        self._resources: list[Any] = []
        self._prompts: list[Any] = []

    async def _ensure_server(self) -> Any:
        """懒加载 mcp.Server."""
        if self._server is None:
            from mcp.server import Server

            self._server = Server(self.name)
            logger.info("mcp.server.created", name=self.name)
        return self._server

    def register_tool(self, tool: Any, *, tenant: str | None = None) -> None:
        """Register tool (lazy registration to MCP server).

        ``tenant`` scopes the tool to a single tenant; omitted (the default,
        and what every import-time registration in ``main.py`` uses) makes it
        platform-wide.
        """
        self._tools.append(tool)
        tool_name = getattr(tool, "name", "")
        if tenant and tool_name:
            self._tool_tenants[tool_name] = tenant
        logger.info("mcp.tool.registered", name=tool_name or "?", tenant=tenant or "*")

    def register_resource(self, resource: Any) -> None:
        """注册资源."""
        self._resources.append(resource)
        logger.info("mcp.resource.registered", uri=getattr(resource, "uri", "?"))

    def register_prompt(self, prompt: Any) -> None:
        """注册提示模板."""
        self._prompts.append(prompt)
        logger.info("mcp.prompt.registered", name=getattr(prompt, "name", "?"))

    async def list_tools(self, tenant_id: str | None = None) -> list[dict[str, Any]]:
        """List registered tools.

        ``tenant_id`` filters out tools registered for a *different* tenant.
        External REST/protocol surfaces also bind verified scopes and always
        pass the authenticated tenant; internal callers may omit it.
        """
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
            if self._visible_to(getattr(t, "name", "?"), tenant_id) and self.tool_allowed(t)
        ]

    @staticmethod
    def tool_allowed(tool: Any) -> bool:
        if not bool(getattr(tool, "agent_invokable", True)):
            return False
        caller = current_caller()
        if caller is None or caller.scopes is None:
            return True  # trusted in-process compatibility; HTTP always binds scopes
        required = getattr(tool, "required_scope", None)
        required_scopes = getattr(tool, "required_scopes", (required,))
        return bool(required_scopes) and set(required_scopes) <= caller.scopes

    def _visible_to(self, tool_name: str, tenant_id: str | None) -> bool:
        owner = self._tool_tenants.get(tool_name)
        if owner is None or tenant_id is None:
            return True
        return owner == tenant_id

    async def list_resources(self) -> list[dict[str, Any]]:
        return [
            {"uri": getattr(r, "uri", "?"), "name": getattr(r, "name", "")} for r in self._resources
        ]

    async def list_prompts(self) -> list[dict[str, Any]]:
        return [
            {"name": getattr(p, "name", "?"), "description": getattr(p, "description", "")}
            for p in self._prompts
        ]

    async def call_tool(
        self,
        name: str,
        arguments: dict[str, Any],
        *,
        tenant_id: str | None = None,
    ) -> Any:
        """调用已注册工具.

        HITL tools are unavailable through Agent dispatch, including forged
        ``__caller__="user"``. Human decisions use authenticated HTTP routes.

        ``tenant_id`` mirrors :meth:`list_tools` — a tool registered for
        another tenant is indistinguishable from an unknown tool (KeyError),
        and external surfaces deny it without an unscoped fallback.
        """
        if isinstance(arguments, dict):
            caller = arguments.pop("__caller__", None)
        else:
            caller = None
        for tool in self._tools:
            if getattr(tool, "name", None) == name:
                if not self._visible_to(name, tenant_id):
                    raise KeyError(f"Tool '''{name}''' not found")
                # Legacy diagnostic only; tool_allowed still denies every HITL tool.
                if not bool(getattr(tool, "agent_invokable", True)):
                    if caller != "user":
                        raise PermissionError(
                            f"Tool {name!r} is HITL-bound (agent_invokable=False); "
                            f"only user caller can invoke. Got __caller__={caller!r}",
                        )
                if not self.tool_allowed(tool):
                    raise PermissionError("tool is outside verified caller grants")
                handler = getattr(tool, "handler", None)
                if handler is None:
                    # Fallback: 工具本身即 handler（ontology_proxy 风格）
                    handler = tool
                arguments = self._normalize_arguments(tool, arguments)
                result = handler(**arguments)
                if hasattr(result, "__await__"):
                    result = await result
                return result
        raise KeyError(f"Tool '''{name}''' not found")

    @staticmethod
    def _normalize_arguments(tool: Any, arguments: dict[str, Any]) -> dict[str, Any]:
        """Adapt generic dispatch arguments to the tool's declared schema.

        Orchestrator dispatch uses ``message`` as its common task payload,
        while MCP tools expose capability-specific fields such as ``query``
        or ``markings``. Passing the generic field verbatim makes narrow
        tools such as ``ont_list_classes()`` fail with ``TypeError``. When a
        JSON-schema property map is declared, retain only declared fields and
        map ``message`` to ``query`` where that conventional field exists.
        Tools without a schema keep the legacy pass-through behaviour so
        dynamic handlers remain compatible.
        """
        schema = getattr(tool, "input_schema", None)
        properties = schema.get("properties") if isinstance(schema, dict) else None
        if not isinstance(properties, dict):
            return arguments

        normalized = {key: value for key, value in arguments.items() if key in properties}
        if "message" in arguments and "message" not in properties:
            if "query" in properties and "query" not in normalized:
                normalized["query"] = arguments["message"]
        return normalized


def create_server(name: str | None = None) -> MCPServer:
    """工厂函数."""
    name = name or os.getenv("MCP_SERVER_NAME", "mate-tech-mcp")
    return MCPServer(name)
