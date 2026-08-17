"""MP-SAL-01: schema_gen —— ObjectType → LLM 工具 schema 生成器（ADR-0043 §2.3-2.5）。

协议无关纯数据：产出 function-calling 形态的 tool schema dict，
不依赖 FastAPI / MCP。两个消费者各挂各的（mate-tech-mcp 注册、
copilot agent_loop 注入）。

形态（Palantir Object Query Tool 对标）：
- 每类型专用工具 ``query_<slug>``：字段枚举直接进参数 schema（token 效率），
  参数结构是 ObjectSetQuery IR 的薄外壳；
- 固定辅助工具 list_classes / inspect_class；
- 可见性：类型级 marking ⊆ agent required_markings（ADR-0043 §2.6）。
"""

from __future__ import annotations

from typing import Any

from ..ontology.instances.link_instance import LinkInstance
from ..ontology.types.object_type import ObjectType

__all__ = [
    "agent_tool_schemas",
    "inspect_class_tool_schema",
    "list_classes_tool_schema",
    "object_query_tool_schema",
    "slug_of_property_rid",
    "slug_of_rid",
    "tool_name_for",
    "visible_object_types",
]

_OP_ENUM = ["eq", "ne", "gt", "gte", "lt", "lte", "startswith", "contains", "truthy"]
_FN_ENUM = ["sum", "count", "avg", "min", "max"]


def slug_of_rid(rid: str) -> str:
    """`ont.<tenant>.obj.<slug>.v<n>` → `<slug>`（其余形态取末段）。"""
    parts = rid.split(".")
    return parts[3] if len(parts) >= 5 else parts[-1]


def slug_of_property_rid(rid: str) -> str:
    parts = rid.split(".")
    return parts[3] if len(parts) >= 5 else parts[-1]


def tool_name_for(ot: ObjectType) -> str:
    return f"query_{slug_of_rid(ot.rid.rid).replace('-', '_')}"


def visible_object_types(
    object_types: tuple[ObjectType, ...] | list[ObjectType],
    agent_markings: tuple[str, ...] | list[str],
) -> tuple[ObjectType, ...]:
    """可见 = 类型 marking ⊆ agent markings（无标记类型恒可见）。"""
    held = set(agent_markings)
    return tuple(t for t in object_types if set(t.marking) <= held)


def list_classes_tool_schema() -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": "list_classes",
            "description": "列出当前租户可见的本体对象类型（含 marking），用于发现可查询的类型。",
            "parameters": {"type": "object", "properties": {}},
        },
    }


def inspect_class_tool_schema() -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": "inspect_class",
            "description": "查看一个对象类型的元数据：属性（格式/类型）、可遍历的 link、可执行的动作。",
            "parameters": {
                "type": "object",
                "properties": {
                    "class_rid": {
                        "type": "string",
                        "description": "对象类型 rid（来自 list_classes）",
                    },
                },
                "required": ["class_rid"],
            },
        },
    }


def object_query_tool_schema(
    ot: ObjectType,
    links: tuple[LinkInstance, ...] | list[LinkInstance] = (),
) -> dict[str, Any]:
    """ObjectType → query_<slug> 专用工具；参数是 ObjectSetQuery IR 的薄外壳。"""
    fields = [slug_of_property_rid(p.rid.rid) for p in ot.properties]

    props: dict[str, Any] = {
        "filters": {
            "type": "array",
            "description": f"对 {ot.display_name or slug_of_rid(ot.rid.rid)} 的过滤条件（全部 AND）",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "enum": fields},
                    "op": {"type": "string", "enum": _OP_ENUM},
                    "value": {},
                },
                "required": ["field", "op"],
            },
        },
        "aggregation": {
            "type": "object",
            "description": "聚合（给出时返回分组行集而非对象）",
            "properties": {
                "group_by": {"type": "array", "items": {"type": "string", "enum": fields}},
                "metrics": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "fn": {"type": "string", "enum": _FN_ENUM},
                            "field": {"type": "string", "enum": fields},
                            "alias": {"type": "string"},
                        },
                        "required": ["fn"],
                    },
                },
            },
            "required": ["metrics"],
        },
        "sort": {
            "type": "array",
            "description": "多键排序（依次生效）",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "enum": fields},
                    "desc": {"type": "boolean"},
                },
                "required": ["field"],
            },
        },
        "paging_limit": {"type": "integer", "minimum": 1, "maximum": 1000},
        "paging_offset": {"type": "integer", "minimum": 0},
    }

    if links:
        link_rids: list[str] = []
        for li in links:
            if li.link_type_rid.rid not in link_rids:
                link_rids.append(li.link_type_rid.rid)
        props["traversal"] = {
            "type": "array",
            "description": "沿 link 遍历到对端对象（链式）",
            "items": {
                "type": "object",
                "properties": {
                    "link_type": {"type": "string", "enum": link_rids},
                    "direction": {"type": "string", "enum": ["out", "in"]},
                },
                "required": ["link_type", "direction"],
            },
        }

    desc = ot.display_name or slug_of_rid(ot.rid.rid)
    return {
        "type": "function",
        "function": {
            "name": tool_name_for(ot),
            "description": (
                f"查询本体对象类型「{desc}」（{ot.rid.rid}）。"
                "支持过滤/聚合/link 遍历/多键排序，返回结构化行集与 result_schema。"
            ),
            "parameters": {"type": "object", "properties": props},
        },
    }


def agent_tool_schemas(
    object_types: tuple[ObjectType, ...] | list[ObjectType],
    links: tuple[LinkInstance, ...] | list[LinkInstance] = (),
    agent_markings: tuple[str, ...] | list[str] = (),
) -> list[dict[str, Any]]:
    """虚拟注册表：按可见性从类型清单实时计算工具清单（零 push 同步）。"""
    out = [list_classes_tool_schema(), inspect_class_tool_schema()]
    for ot in visible_object_types(object_types, agent_markings):
        related = tuple(li for li in links if _touches(li, ot)) if links else ()
        out.append(object_query_tool_schema(ot, links=related))
    return out


def _touches(li: LinkInstance, ot: ObjectType) -> bool:
    """link 是否与该类型相关（src/dst 任一实例属于该类）——无法判定时保守收录。"""
    return True  # link_type 层的 src/dst 类归属需 LinkType 元数据，v1 不过滤
