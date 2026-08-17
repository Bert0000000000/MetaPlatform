"""MP-SAL-01: copilot 侧 ontology 工具接线（ADR-0043 §2.3/§2.6 消费者）。

把 kernel schema_gen 的产出接到 SuperAI agent loop：
- ``build_ontology_tools``：虚拟注册表 —— 从 repo 类型清单实时计算工具
  （list_classes + inspect_class + 每类型 query_<slug>，按 agent markings 过滤）；
- ``execute_ontology_tool``：模拟 FC 调用的执行端 —— query_<slug> 参数是
  ObjectSetQuery IR 的薄外壳；marking 在执行期二次校验（缺标记 → PermissionError）。
"""

from __future__ import annotations

from typing import Any, Protocol

from mate_kernel.objectset.ir import (
    Aggregation,
    Condition,
    MetricSpec,
    ObjectSetQuery,
    QueryOp,
    QueryResult,
    SortKey,
    TraversalStep,
)
from mate_kernel.ontology.instances import LinkInstance
from mate_kernel.ontology.types import ObjectType
from mate_kernel.tooling.schema_gen import (
    agent_tool_schemas,
    slug_of_rid,
    tool_name_for,
    visible_object_types,
)


class OntologyToolRepo(Protocol):
    """copilot 依赖的 repo 面（Pg / InMemory 均满足）。"""

    def list_object_types(self, limit: int = ..., offset: int = ...) -> list[ObjectType]: ...
    def get_object_type(self, rid: Any) -> ObjectType: ...
    def list_link_instances(self) -> list[LinkInstance]: ...
    def execute_object_query(self, q: ObjectSetQuery) -> QueryResult: ...
    def search_objects(
        self, text: str, class_rid: str | None = ..., top_k: int = ...,
    ) -> list[dict[str, Any]]: ...
    def propose_action(
        self, action_rid: Any, parameters: dict[str, Any],
        target_iid: str | None, impact_summary: str,
        expected_diff: dict[str, Any] | None = ...,
    ) -> Any: ...


SEARCH_OBJECTS_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "search_objects",
        "description": "对象语义检索：用自然语言找相关本体对象，返回对象卡片(带 rid 可追溯)。",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "自然语言检索文本"},
                "class_rid": {"type": "string", "description": "限定对象类型(可选)"},
                "top_k": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "required": ["text"],
        },
    },
}

# MP-SAL-04（ADR-0044 §2.5）：AI 只能提议；confirm/reject 不是 LLM 工具（用户侧端点）。
PROPOSE_ACTION_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "propose_action",
        "description": (
            "提议执行一个 ActionType：产出 pending proposal(含预期 diff)，"
            "等待用户确认后才会落库。不会直接修改任何数据。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action_rid": {"type": "string", "description": "ActionType rid"},
                "parameters": {"type": "object", "description": "动作参数"},
                "target_iid": {"type": "string", "description": "目标对象 rid"},
                "impact_summary": {"type": "string", "description": "人类可读的将做什么"},
                "expected_diff": {"type": "object", "description": "预期变更(可选)"},
            },
            "required": ["action_rid", "impact_summary"],
        },
    },
}


# MP-SAL-04b（ADR-0044 附录）：文本→本体 ingest——AI 只能提议，confirm/execute 均非 LLM 工具。
PROPOSE_CREATE_INSTANCE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "propose_create_instance",
        "description": (
            "从文本抽取的字段提议新建一个本体对象实例(kind=create_instance)。"
            "产出 pending proposal 等用户确认, 不会直接落库。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "class_rid": {"type": "string", "description": "目标 ObjectType rid"},
                "props": {"type": "object", "description": "字段值(含主键)"},
                "impact_summary": {"type": "string"},
                "expected_diff": {"type": "object"},
            },
            "required": ["class_rid", "props", "impact_summary"],
        },
    },
}

PROPOSE_MODEL_TYPE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "propose_model_type",
        "description": (
            "提议新建一个 ObjectType(AI 辅助建模, kind=model_type)。"
            "确认后经 execute 落库; schema 变更必须人工审。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "type_def": {
                    "type": "object",
                    "description": "ObjectType 定义(rid/primary_key/properties/display_name/marking)",
                },
                "impact_summary": {"type": "string"},
            },
            "required": ["type_def", "impact_summary"],
        },
    },
}


def build_ontology_tools(
    repo: OntologyToolRepo, agent_markings: tuple[str, ...] | list[str] = (),
) -> list[dict[str, Any]]:
    """发布即可见：每次调用从 repo 实时计算（虚拟注册表，零 push 同步）。"""
    types = repo.list_object_types(10000, 0)
    links = repo.list_link_instances()
    return [
        *agent_tool_schemas(types, links, tuple(agent_markings)),
        SEARCH_OBJECTS_TOOL,
        PROPOSE_ACTION_TOOL,
        PROPOSE_CREATE_INSTANCE_TOOL,
        PROPOSE_MODEL_TYPE_TOOL,
    ]


def execute_ontology_tool(
    repo: OntologyToolRepo,
    name: str,
    arguments: dict[str, Any],
    agent_markings: tuple[str, ...] | list[str] = (),
) -> dict[str, Any]:
    """工具名 → 执行。query_<slug> 执行前按类型 marking 二次校验可见性。"""
    if name == "list_classes":
        return _list_classes(repo, tuple(agent_markings))
    if name == "inspect_class":
        return _inspect_class(repo, str(arguments.get("class_rid", "")))
    if name == "search_objects":
        return {
            "cards": repo.search_objects(
                text=str(arguments.get("text", "")),
                class_rid=arguments.get("class_rid") or None,
                top_k=int(arguments.get("top_k", 5)),
            ),
        }
    if name == "propose_action":
        prop = repo.propose_action(
            action_rid=arguments.get("action_rid", ""),
            parameters=dict(arguments.get("parameters") or {}),
            target_iid=arguments.get("target_iid") or None,
            impact_summary=str(arguments.get("impact_summary", "")),
            expected_diff=dict(arguments.get("expected_diff") or {}),
        )
        return {
            "proposal_id": prop.proposal_id,
            "status": prop.status.value,
            "impact_summary": prop.impact_summary,
            "note": "已产出待确认提议；等待用户确认(confirm)后才会落库。",
        }
    if name == "propose_create_instance":
        prop = repo.propose_create_instance(
            class_rid=str(arguments.get("class_rid", "")),
            props=dict(arguments.get("props") or {}),
            impact_summary=str(arguments.get("impact_summary", "")),
            expected_diff=dict(arguments.get("expected_diff") or {}) or None,
        )
        return {
            "proposal_id": prop.proposal_id,
            "kind": "create_instance",
            "status": prop.status.value,
            "note": "已产出新建实例提议；等待用户确认后 execute 落库。",
        }
    if name == "propose_model_type":
        prop = repo.propose_model_type(
            type_def=dict(arguments.get("type_def") or {}),
            impact_summary=str(arguments.get("impact_summary", "")),
        )
        return {
            "proposal_id": prop.proposal_id,
            "kind": "model_type",
            "status": prop.status.value,
            "note": "已产出建模提议；schema 变更需用户确认后 execute 落库。",
        }
    if name.startswith("query_"):
        return _execute_query(repo, name, arguments, tuple(agent_markings))
    raise KeyError(f"unknown ontology tool: {name!r}")


def _list_classes(repo: OntologyToolRepo, _markings: tuple[str, ...]) -> dict[str, Any]:
    """发现面：列出全部类（含各自 marking 元数据）——可见性只约束 query 工具与执行。"""
    types = repo.list_object_types(10000, 0)
    return {
        "classes": [
            {
                "rid": t.rid.rid,
                "slug": slug_of_rid(t.rid.rid),
                "display_name": t.display_name,
                "marking": list(t.marking),
            }
            for t in types
        ],
    }


def _inspect_class(repo: OntologyToolRepo, class_rid: str) -> dict[str, Any]:
    from mate_kernel.ontology.identity import ClassRef  # noqa: PLC0415

    ot = repo.get_object_type(ClassRef(class_rid))
    return {
        "class_rid": ot.rid.rid,
        "display_name": ot.display_name,
        "marking": list(ot.marking),
        "properties": [
            {"slug": slug_of_rid(p.rid.rid), "type": p.type_id, "format": p.format.value}
            for p in ot.properties
        ],
        "links": [
            {"link_type": li.link_type_rid.rid}
            for li in repo.list_link_instances()
        ][:50],
    }


def _execute_query(
    repo: OntologyToolRepo,
    name: str,
    arguments: dict[str, Any],
    markings: tuple[str, ...],
) -> dict[str, Any]:
    types = repo.list_object_types(10000, 0)
    target: ObjectType | None = None
    for t in types:
        if tool_name_for(t) == name:
            target = t
            break
    if target is None:
        raise KeyError(f"unknown ontology tool: {name!r}")
    # 执行期二次校验（工具可见性不等于执行放行）
    if not visible_object_types((target,), markings):
        raise PermissionError(
            f"tool {name!r} requires markings {list(target.marking)}, "
            f"agent has {list(markings)}"
        )

    agg: Aggregation | None = None
    raw_agg = arguments.get("aggregation")
    if isinstance(raw_agg, dict):
        agg = Aggregation(
            group_by=tuple(raw_agg.get("group_by", ())),
            metrics=tuple(
                MetricSpec(
                    fn=str(m["fn"]),
                    field=m.get("field"),
                    alias=m.get("alias"),
                )
                for m in raw_agg.get("metrics", ())
            ),
        )
    q: ObjectSetQuery
    try:
        q = ObjectSetQuery(
            source=target.rid.rid,
            filters=tuple(
                Condition(field=str(c["field"]), op=QueryOp(str(c["op"])), value=c.get("value"))
                for c in arguments.get("filters", ())
                if isinstance(c, dict)
            ),
            aggregation=agg,
            traversal=tuple(
                TraversalStep(
                    link_type=str(t["link_type"]), direction=str(t["direction"]),
                )
                for t in arguments.get("traversal", ())
                if isinstance(t, dict)
            ),
            sort=tuple(
                SortKey(field=str(s["field"]), desc=bool(s.get("desc", False)))
                for s in arguments.get("sort", ())
                if isinstance(s, dict)
            ),
            paging_offset=int(arguments.get("paging_offset", 0)),
            paging_limit=int(arguments.get("paging_limit", 100)),
        )
    except ValueError as e:
        raise ValueError(f"invalid query arguments: {e}") from e

    result = repo.execute_object_query(q)
    return {
        "kind": result.kind,
        "rows": [dict(r) for r in result.rows],
        "result_schema": result.result_schema,
    }
