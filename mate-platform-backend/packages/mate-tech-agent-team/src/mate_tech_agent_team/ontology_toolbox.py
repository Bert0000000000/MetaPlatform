"""本体工具面（任务 3）。

员工通过**既有的** mate-tech-ont v2 工具面读写本体，不新建交互方式：

| 员工工具名 | 本体既有端点 |
| --- | --- |
| ``ont_list_classes`` | ``GET /api/v1/ont/v2/object-types`` |
| ``ont_inspect_class`` | ``GET /api/v1/ont/v2/classes/{rid}/inspect`` |
| ``ont_object_query`` | ``POST /api/v1/ont/v2/object-query`` |
| ``ont_propose_instance`` | ``POST /api/v1/ont/v2/classes/{rid}/propose-instance`` |

**写只到 proposal 为止**：本模块**不提供** confirm / reject / execute 三个工具
（ADR-0044：人确认才落库）。即使模型点名要它们，也会像白名单外的工具一样被拒。

**为什么这条路不经过 MCP 中心**：MCP 的本体代理用**服务身份**的
client_credentials token 出去，而该 token 不带 tenant claim，本体的
``AuthMiddleware`` 会直接拒（实测 401）；MCP 容器也没有挂载源码可热修。
而 ADR-0066 §3.3 的不变量本就要求「包络链根 = 发起用户」，所以这里直接带
**调用方的用户 token + 租户**走本体既有面，是正确且不改他服务的做法。
长期应收口到 MCP 的逐请求 token 透传（见本轮报告「遗留与建议」）。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .skill_toolbox import SKILL_TOOL_NAMES
from .toolbox import ToolNotAllowed

ONTOLOGY_TOOL_NAMES: frozenset[str] = frozenset(
    {"ont_list_classes", "ont_inspect_class", "ont_object_query", "ont_propose_instance"}
)

_CATALOG: list[dict[str, Any]] = [
    {
        "name": "ont_list_classes",
        "description": (
            "列出租户可见的本体对象类型的**清单**（rid + 名称 + marking）。"
            "这是发现可查询类型的唯一入口：**必须先调它，并从返回里原样挑 rid**，"
            "禁止凭业务名词自己拼造 rid（拼出来的 rid 一律 404）。"
        ),
        "parameters": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "description": "返回条数上限"}},
        },
    },
    {
        "name": "ont_inspect_class",
        "description": "查看某个对象类型的属性与链接定义。class_rid 必须来自 ont_list_classes 的返回",
        "parameters": {
            "type": "object",
            "properties": {"class_rid": {"type": "string", "description": "对象类型 rid"}},
            "required": ["class_rid"],
        },
    },
    {
        "name": "ont_object_query",
        "description": (
            "查询本体对象。source 必须是 ont_list_classes 返回的 rid（不要自己拼）；"
            "可选 filters（全部 AND）/aggregation/sort，返回结构化行集"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "source": {"type": "string", "description": "对象类型 rid"},
                "filters": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "过滤条件（全部 AND）",
                },
                "aggregation": {"type": "object", "description": "聚合（给出时返回分组行集）"},
                "sort": {"type": "array", "items": {"type": "object"}},
                "paging_limit": {"type": "integer"},
                "paging_offset": {"type": "integer"},
            },
            "required": ["source"],
        },
    },
    {
        "name": "ont_propose_instance",
        "description": (
            "**提议**新建一个对象实例。这只是提案，不会落库；需要人在 proposal 通道确认后才生效"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "class_rid": {"type": "string", "description": "对象类型 rid"},
                "props": {"type": "object", "description": "实例属性"},
                "impact_summary": {"type": "string", "description": "变更影响说明"},
            },
            "required": ["class_rid", "props"],
        },
    },
]

_SUPPORTED = {entry["name"] for entry in _CATALOG}


def to_catalog_schema(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": entry["name"],
            "description": entry["description"],
            "parameters": entry["parameters"],
        },
    }


class OntologyToolbox:
    """把本体的既有端点暴露成员工可用的工具（白名单闸门与 MCP 侧同规格）。"""

    def __init__(self, client: Any) -> None:
        self._client = client

    async def schemas(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]:
        return [to_catalog_schema(e) for e in _CATALOG if e["name"] in allowed]

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed: Sequence[str]) -> Any:
        if name not in allowed:
            raise ToolNotAllowed(name, "not_in_employee_tool_whitelist")
        if name not in _SUPPORTED:
            # 含 confirm/reject/execute：本模块根本没有实现，永远到不了本体
            raise ToolNotAllowed(name, "not_an_ontology_agent_tool")
        return await self._call(name, arguments)

    async def _call(self, name: str, arguments: dict[str, Any]) -> Any:
        if name == "ont_list_classes":
            return self._compact_classes(
                await self._client.list_classes(limit=int(arguments.get("limit") or 200))
            )
        if name == "ont_inspect_class":
            return await self._client.inspect_class(str(arguments["class_rid"]))
        if name == "ont_object_query":
            payload = {k: v for k, v in arguments.items() if v is not None}
            return await self._client.object_query(payload)
        if name == "ont_propose_instance":
            return await self._client.propose_instance(
                str(arguments["class_rid"]),
                dict(arguments.get("props") or {}),
                str(arguments.get("impact_summary") or ""),
            )
        raise ToolNotAllowed(name, "not_an_ontology_agent_tool")

    @staticmethod
    def _compact_classes(raw: Any) -> dict[str, Any]:
        """把对象类型的完整定义压成「rid + 名称」清单。

        本体返回的每个类型都带全部属性定义（几十个字段）。两件事都实测过：

        * 直接回原样 → 模型翻不到「订单」，**开始自己拼 rid**，然后 404；
        * 连属性名一起回 → 47 个类型加起来超过单条工具结果的裁剪上限，
          模型只看得到前几个类型，实测因此**挑错了订单类**。

        所以清单只回 rid + 名称；要属性再调 ``ont_inspect_class``。
        """
        items = raw if isinstance(raw, list) else (raw or {}).get("items", [])
        classes = []
        for item in items or []:
            if not isinstance(item, dict):
                continue
            rid = str(item.get("rid") or "")
            if not rid:
                continue
            classes.append(
                {
                    "rid": rid,
                    "name": rid.rsplit(".", 2)[-2] if "." in rid else rid,
                }
            )
        return {
            "count": len(classes),
            "classes": classes,
            "hint": "要看某个类型的属性与链接，用 ont_inspect_class(class_rid=…)。",
        }

    async def aclose(self) -> None:
        close = getattr(self._client, "aclose", None)
        if close is not None:
            await close()


class CompositeToolbox:
    """按工具名把调用路由到不同的工具面。

    * 本体工具 → :class:`OntologyToolbox`（带用户 token 直达本体既有面）
    * 技能工具 → :class:`~mate_tech_agent_team.skill_toolbox.SkillToolbox`（读 SkillHub）
    * 其余（kb_search …）→ MCP 中心

    **白名单闸门对每条路一视同仁**——路由不构成放行。
    """

    def __init__(
        self,
        *,
        ontology: OntologyToolbox | None = None,
        mcp: Any = None,
        skills: Any = None,
        ontology_names: frozenset[str] = ONTOLOGY_TOOL_NAMES,
        skill_names: frozenset[str] = SKILL_TOOL_NAMES,
    ) -> None:
        self._ontology = ontology
        self._mcp = mcp
        self._skills = skills
        self._ontology_names = ontology_names
        self._skill_names = skill_names

    def _route(self, name: str) -> Any:
        if name in self._ontology_names and self._ontology is not None:
            return self._ontology
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
        for toolbox in (self._ontology, self._skills, self._mcp):
            close = getattr(toolbox, "aclose", None)
            if close is not None:
                await close()


__all__ = [
    "ONTOLOGY_TOOL_NAMES",
    "CompositeToolbox",
    "OntologyToolbox",
    "to_catalog_schema",
]
