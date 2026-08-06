"""AGENT-ONT-01 Ontology 数字员工测试。"""

from __future__ import annotations

import pytest

from mate_kernel.agent.ontology import (
    OntologyAgent,
    OntologyAgentRequest,
    OntologyQueryPlanner,
    SimpleQueryPlanner,
)
from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef


def _ctx() -> ManagerContext:
    return ManagerContext(user_id="alice", tenant_id="acme", session_id="s-1")


def _cls(slug: str = "order") -> ClassRef:
    return ClassRef(rid=f"ont.acme.cls.{slug}.v1")


class TestSimpleQueryPlanner:
    def _p(self) -> SimpleQueryPlanner:
        return SimpleQueryPlanner()

    def test_simple_eq(self) -> None:
        plan = self._p().plan("状态=open", _cls())
        assert "open" in plan.filter_expr

    def test_chinese_field(self) -> None:
        plan = self._p().plan("状态=open 金额>1000", _cls())
        assert " AND " in plan.filter_expr

    def test_numeric_value(self) -> None:
        plan = self._p().plan("amount=200", _cls())
        assert "200" in plan.filter_expr

    def test_empty_query(self) -> None:
        plan = self._p().plan("", _cls())
        assert plan.filter_expr == ""

    def test_default_class(self) -> None:
        plan = self._p().plan("x=1", None)
        assert plan.class_rid.rid.endswith(".order.v1")


class TestOntologyAgent:
    def _agent(self) -> OntologyAgent:
        return OntologyAgent()

    def test_handle_with_query(self) -> None:
        m = Manager(_ctx())
        resp = self._agent().handle(
            OntologyAgentRequest(user_query="状态=open"),
            m,
            default_class=_cls(),
        )
        assert resp.proposed_object_set is not None
        assert resp.confidence > 0.5
        assert resp.needs_clarification is False
        assert m.pending_changes_count() == 1

    def test_handle_empty_query(self) -> None:
        m = Manager(_ctx())
        resp = self._agent().handle(
            OntologyAgentRequest(user_query=""),
            m,
            default_class=_cls(),
        )
        assert resp.needs_clarification is True
        assert resp.confidence < 0.5
        assert any("补充" in s or "过滤" in s for s in resp.suggestions)

    def test_handle_default_class(self) -> None:
        m = Manager(_ctx())
        resp = self._agent().handle(
            OntologyAgentRequest(user_query="数量=10"),
            m,
            default_class=None,
        )
        assert resp.proposed_object_set is not None
        assert resp.proposed_object_set.class_rid.rid.endswith(".order.v1")
        assert any("order" in s for s in resp.suggestions)

    def test_handle_records_change_with_query(self) -> None:
        m = Manager(_ctx())
        self._agent().handle(
            OntologyAgentRequest(user_query="状态=open"),
            m,
            default_class=_cls(),
        )
        drained = m.drain_changes()
        assert len(drained) == 1
        assert drained[0].target_rid.endswith(".order.v1")
        assert "状态=open" in repr(drained[0].payload_hash) or len(drained[0].payload_hash) == 8

    def test_explanation_includes_filter(self) -> None:
        m = Manager(_ctx())
        resp = self._agent().handle(
            OntologyAgentRequest(user_query="状态=open"),
            m,
            default_class=_cls(),
        )
        assert "状态=open" in resp.explanation or "open" in resp.explanation

    def test_custom_planner(self) -> None:
        class StubPlanner:
            def plan(self, query, default_class):
                from mate_kernel.ontology.query.object_set import ObjectSet
                return ObjectSet(class_rid=default_class, filter_expr="custom == 1")

        m = Manager(_ctx())
        resp = OntologyAgent(planner=StubPlanner()).handle(
            OntologyAgentRequest(user_query="anything"),
            m,
            default_class=_cls(),
        )
        assert resp.proposed_object_set.filter_expr == "custom == 1"
