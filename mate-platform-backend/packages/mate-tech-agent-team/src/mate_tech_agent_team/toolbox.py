"""工具面：白名单闸门 + MCP 中心派发（任务 2 / 3 的公共底座）。

**两道闸门，缺一不可**：

1. **员工工具白名单**（D-8）——``EmployeeProfile.tools`` 是闭集，未列出即拒绝。
   模型完全可能请求一个它"知道"但没被授权的工具（这正是 prompt injection /
   幻觉的常见形态），所以闸门必须在**派发处**，不能只靠"没把 schema 给它"。
2. **中心的 ``agentInvokable`` 标志**——MCP 中心把 ``ont_confirm_proposal`` /
   ``ont_reject_proposal`` / ``ont_execute_proposal`` 标为不可被 agent 调用
   （人工闸门，ADR-0044）。即使有人把它们写进了某个员工的白名单，也必须拒绝。

两条都拒绝时抛 :class:`ToolNotAllowed`，由运行时记进回执的 ``tool_calls``，
**并且这次调用不会真的打到 MCP 中心**。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol


class ToolNotAllowed(PermissionError):
    """工具调用被闸门拒绝。"""

    def __init__(self, tool_name: str, reason: str) -> None:
        self.tool_name = tool_name
        self.reason = reason
        super().__init__(f"工具 {tool_name!r} 被拒绝：{reason}")


class Toolbox(Protocol):
    """按白名单出工具 schema、按白名单派发调用。"""

    async def schemas(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]: ...

    async def invoke(
        self, *, name: str, arguments: dict[str, Any], allowed: Sequence[str]
    ) -> Any: ...


def to_openai_schema(descriptor: dict[str, Any]) -> dict[str, Any]:
    """MCP 工具描述符 → OpenAI function-calling schema。"""
    schema = descriptor.get("inputSchema") or {"type": "object", "properties": {}}
    return {
        "type": "function",
        "function": {
            "name": descriptor["name"],
            "description": descriptor.get("description", ""),
            "parameters": schema,
        },
    }


class McpToolbox:
    """走既有 MCP 中心（``mate_clients.mcp.McpToolsClient``）的工具面。"""

    def __init__(self, client: Any, *, descriptors: list[dict[str, Any]] | None = None) -> None:
        self._client = client
        self._descriptors: dict[str, dict[str, Any]] = {d["name"]: d for d in (descriptors or [])}

    async def _ensure_descriptors(self) -> None:
        if self._descriptors:
            return
        tools = await self._client.list_tools()
        self._descriptors = {t["name"]: t for t in tools}

    async def schemas(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]:
        """只出白名单里、且中心确实有、且允许 agent 调用的工具。"""
        await self._ensure_descriptors()
        out: list[dict[str, Any]] = []
        for name in allowed:
            descriptor = self._descriptors.get(name)
            if descriptor is None or not descriptor.get("agentInvokable", True):
                continue
            out.append(to_openai_schema(descriptor))
        return out

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed: Sequence[str]) -> Any:
        if name not in allowed:
            raise ToolNotAllowed(name, "not_in_employee_tool_whitelist")
        await self._ensure_descriptors()
        descriptor = self._descriptors.get(name)
        if descriptor is not None and not descriptor.get("agentInvokable", True):
            raise ToolNotAllowed(name, "center_marks_not_agent_invokable")
        return await self._client.call_tool(name=name, arguments=arguments)


class CompositeToolbox:
    """按工具名把调用路由到不同的工具面。

    * 技能工具 → :class:`~mate_tech_agent_team.skill_toolbox.SkillToolbox`（读 SkillHub）
    * 其余（本体 ``ont_*``、``kb_search`` …）→ MCP 中心

    **本体不再有旁路**（1.1 task 1c）：1.0 时本体工具直连本体引擎，因为当时
    MCP 的代理用服务身份 token 出去、本体不认。1.1 把 MCP 代理改成逐请求
    透传调用方 token + 租户后，本体工具与其它工具走同一条总线——单一工具面，
    包络判定与审计只需做一处。

    **白名单闸门对每条路一视同仁**——路由不构成放行。
    """

    def __init__(
        self,
        *,
        mcp: Any = None,
        skills: Any = None,
        skill_names: frozenset[str] = frozenset(),
    ) -> None:
        self._mcp = mcp
        self._skills = skills
        self._skill_names = skill_names

    def _route(self, name: str) -> Any:
        if name in self._skill_names and self._skills is not None:
            return self._skills
        return self._mcp

    async def schemas(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        seen: set[str] = set()
        for name in allowed:
            toolbox = self._route(name)
            if toolbox is None:
                continue
            for schema in await toolbox.schemas(allowed=[name]):
                key = schema["function"]["name"]
                if key not in seen:
                    seen.add(key)
                    out.append(schema)
        return out

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed: Sequence[str]) -> Any:
        if name not in allowed:
            raise ToolNotAllowed(name, "not_in_employee_tool_whitelist")
        toolbox = self._route(name)
        if toolbox is None:
            raise ToolNotAllowed(name, "no_toolbox_for_tool")
        return await toolbox.invoke(name=name, arguments=arguments, allowed=allowed)

    async def aclose(self) -> None:
        for toolbox in (self._skills, self._mcp):
            close = getattr(toolbox, "aclose", None)
            if close is not None:
                await close()


__all__ = [
    "CompositeToolbox",
    "McpToolbox",
    "ToolNotAllowed",
    "Toolbox",
    "to_openai_schema",
]
