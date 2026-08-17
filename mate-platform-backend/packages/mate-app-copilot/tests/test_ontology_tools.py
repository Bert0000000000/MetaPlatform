"""MP-SAL-01: copilot ontology 工具接线 e2e（ADR-0043 §2.3-2.6 验收核心）。

链路：发布 ObjectType（repo 类型清单）→ build_ontology_tools 生成
query_<slug> + list_classes + inspect_class（markings 可见性过滤）→
execute_ontology_tool 模拟 FC 调用 → IR 查询 → 结果信封 + result_schema。
marking negative：缺标记时工具不可见，且直调被拒（执行期二次校验）。
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from mate_app_copilot.agent_loop import build_tools as build_agent_loop_tools
from mate_app_copilot.ontology_tools import (
    build_ontology_tools,
    execute_ontology_tool,
)
from mate_kernel.objectset.ir import (
    Condition,
    ObjectSetQuery,
    QueryOp,
    QueryResult,
)
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import LinkInstance
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat

_T = "cope2e"
_NOW = datetime.now(UTC)


def _prop(slug: str, fmt: PropertyFormat = PropertyFormat.STRING, type_id: str = "string") -> Property:
    return Property(
        rid=ClassRef(f"ont.{_T}.prop.{slug}.v1"),
        type_id=type_id, nullable=True, primary_key=False, title=slug, format=fmt,
    )


def _ot(slug: str, marking: tuple[str, ...] = ()) -> ObjectType:
    return ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.{slug}.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.{slug}-id.v1"),),
        properties=(
            Property(rid=ClassRef(f"ont.{_T}.prop.{slug}-id.v1"), type_id="string",
                     nullable=False, primary_key=True, title="id",
                     format=PropertyFormat.STRING),
            _prop("amount", PropertyFormat.INTEGER, "integer"),
            _prop("status"),
        ),
        display_name=slug,
        marking=marking,
    )


class _FakeRepo:
    """OntologyToolRepo 协议的最小实现：类型清单 + IR 查询直通 InMemory 执行器。"""

    def __init__(self, types: tuple[ObjectType, ...]) -> None:
        self.types = types
        self.queries: list[ObjectSetQuery] = []
        self.proposals: list[dict] = []

    def list_object_types(self, limit: int = 10000, offset: int = 0) -> tuple[ObjectType, ...]:
        return self.types

    def get_object_type(self, rid: ClassRef) -> ObjectType:
        for t in self.types:
            if t.rid.rid == rid.rid:
                return t
        raise KeyError(rid.rid)

    def list_link_instances(self) -> tuple[LinkInstance, ...]:
        return ()

    def execute_object_query(self, q: ObjectSetQuery) -> QueryResult:
        self.queries.append(q)
        return QueryResult(
            kind="objects",
            rows=({"{s}-id".format(s="order"): "o1", "amount": 100, "status": "open"},),
            result_schema={"amount": {"type": "integer", "rid": f"ont.{_T}.prop.amount.v1"}},
        )

    def search_objects(
        self, text: str, class_rid: str | None = None, top_k: int = 5,
    ) -> list[dict]:
        return []

    def propose_action(
        self, action_rid, parameters, target_iid, impact_summary, expected_diff=None,
    ):
        from types import SimpleNamespace
        self.proposals.append({
            "action_rid": str(action_rid), "parameters": parameters,
            "target_iid": target_iid, "impact_summary": impact_summary,
        })
        from mate_kernel.action.engine import ProposalStatus
        return SimpleNamespace(
            proposal_id="prop-xyz", status=ProposalStatus.PENDING,
            impact_summary=impact_summary,
        )


def _repo() -> _FakeRepo:
    return _FakeRepo((_ot("order"), _ot("ledger", marking=("domain:finance",))))


class TestBuildOntologyTools:
    def test_fixed_plus_unmarked_type_tools(self) -> None:
        tools = build_ontology_tools(_repo(), agent_markings=())
        names = [t["function"]["name"] for t in tools]
        # SAL-04 起固定辅助面 5 件：list/inspect/search/propose + 每类型 query_<slug>
        assert names == [
            "list_classes", "inspect_class", "query_order", "search_objects",
            "propose_action",
        ]
        # HITL 边界：confirm/reject 绝不作为 LLM 工具出现
        assert not any("confirm" in n or "reject" in n for n in names)

    def test_marked_type_visible_with_marking(self) -> None:
        tools = build_ontology_tools(_repo(), agent_markings=("domain:finance",))
        names = [t["function"]["name"] for t in tools]
        assert "query_ledger" in names

    def test_field_enum_baked(self) -> None:
        tools = build_ontology_tools(_repo(), agent_markings=())
        q = next(t for t in tools if t["function"]["name"] == "query_order")
        enum = q["function"]["parameters"]["properties"]["filters"]["items"]["properties"]["field"]["enum"]
        assert "amount" in enum


class TestExecuteOntologyTool:
    def test_query_tool_executes_ir(self) -> None:
        repo = _repo()
        out = execute_ontology_tool(repo, "query_order", {
            "filters": [{"field": "status", "op": "eq", "value": "open"}],
        })
        assert out["kind"] == "objects"
        assert out["rows"][0]["amount"] == 100
        assert out["result_schema"]["amount"]["rid"].endswith("prop.amount.v1")
        assert len(repo.queries) == 1
        assert repo.queries[0].filters == (Condition("status", QueryOp.EQ, "open"),)

    def test_list_classes(self) -> None:
        out = execute_ontology_tool(_repo(), "list_classes", {})
        slugs = {c["slug"] for c in out["classes"]}
        assert slugs == {"order", "ledger"}

    def test_inspect_class(self) -> None:
        out = execute_ontology_tool(_repo(), "inspect_class", {
            "class_rid": f"ont.{_T}.obj.order.v1",
        })
        assert out["class_rid"] == f"ont.{_T}.obj.order.v1"
        assert any(p["slug"] == "amount" for p in out["properties"])

    def test_marked_type_direct_call_denied_without_marking(self) -> None:
        with pytest.raises(PermissionError, match="marking"):
            execute_ontology_tool(_repo(), "query_ledger", {}, agent_markings=())

    def test_marked_type_direct_call_allowed_with_marking(self) -> None:
        out = execute_ontology_tool(
            _repo(), "query_ledger", {}, agent_markings=("domain:finance",),
        )
        assert out["kind"] == "objects"

    def test_unknown_tool_rejected(self) -> None:
        with pytest.raises(KeyError):
            execute_ontology_tool(_repo(), "query_ghost", {})


class TestAgentLoopIntegration:
    def test_build_tools_merges_dispatch_and_ontology_tools(self) -> None:
        roles = [{"role": "workflow", "name": "Workflow", "capabilities": []}]
        onto = build_ontology_tools(_repo(), agent_markings=())
        tools = build_agent_loop_tools(roles, ontology_tools=onto)
        names = [t["function"]["name"] for t in tools]
        assert "dispatch_employee" in names
        assert "query_order" in names

    def test_build_tools_without_roles_keeps_ontology_tools(self) -> None:
        onto = build_ontology_tools(_repo(), agent_markings=())
        tools = build_agent_loop_tools([], ontology_tools=onto)
        names = [t["function"]["name"] for t in tools]
        assert "query_order" in names
        assert "dispatch_employee" not in names
