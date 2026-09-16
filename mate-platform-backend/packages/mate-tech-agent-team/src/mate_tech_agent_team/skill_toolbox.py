"""技能工具面：清单外按需取正文（任务 6 的第 2 层）。

两个工具，**都只回"够用就停"的量**：

* ``read_skill(skill_id)`` —— 拿全文，但只在下发给它之后；
* ``search_skill(query)`` —— 清单外的兜底，**只回清单条目、不回正文**。

正文永远不常驻提示词：撑爆上下文的是正文，不是名字。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .skills import SkillCatalog, SkillNotFound
from .toolbox import ToolNotAllowed, to_openai_schema

SKILL_TOOL_NAMES: frozenset[str] = frozenset({"read_skill", "search_skill"})

_CATALOG: list[dict[str, Any]] = [
    {
        "name": "read_skill",
        "description": (
            "读取某个技能的**完整正文**。提示词里的技能清单只有名字与一句话说明；"
            "要按技能干活之前，先调它把做法取全，不要凭名字臆测。"
        ),
        "parameters": {
            "type": "object",
            "properties": {"skill_id": {"type": "string", "description": "技能 id"}},
            "required": ["skill_id"],
        },
    },
    {
        "name": "search_skill",
        "description": "在技能仓库里按关键词找技能（清单里没有时用）。只返回名字与一句话描述，不含正文",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "关键词"}},
            "required": ["query"],
        },
    },
]

_SUPPORTED = {entry["name"] for entry in _CATALOG}


class SkillToolbox:
    """把 SkillHub 的读能力暴露成员工可用的工具。"""

    def __init__(self, catalog: SkillCatalog, *, tenant_id: str = "") -> None:
        self._catalog = catalog
        self._tenant_id = tenant_id

    async def descriptors(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]:
        """与 MCP 工具面同形的描述符（``inputSchema`` 口径），供 LangChain 工具化。"""
        return [
            {
                "name": e["name"],
                "description": e["description"],
                "inputSchema": e["parameters"],
                "agentInvokable": True,
            }
            for e in _CATALOG
            if e["name"] in allowed
        ]

    async def schemas(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]:
        return [to_openai_schema(d) for d in await self.descriptors(allowed=allowed)]

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed: Sequence[str]) -> Any:
        if name not in allowed:
            raise ToolNotAllowed(name, "not_in_employee_tool_whitelist")
        if name not in _SUPPORTED:
            raise ToolNotAllowed(name, "not_a_skill_tool")
        if name == "read_skill":
            skill_id = str(arguments.get("skill_id") or "")
            try:
                return {"skill_id": skill_id, "content": self._catalog.read(skill_id)}
            except SkillNotFound as exc:
                raise ToolNotAllowed(skill_id, "skill_not_found") from exc
        entries = self._catalog.search(str(arguments.get("query") or ""), tenant_id=self._tenant_id)
        return {
            "entries": [
                {"skill_id": e.skill_id, "name": e.name, "description": e.description}
                for e in entries
            ]
        }


__all__ = ["SKILL_TOOL_NAMES", "SkillToolbox"]
