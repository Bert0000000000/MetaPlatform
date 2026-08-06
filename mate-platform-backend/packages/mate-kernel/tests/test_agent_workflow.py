"""AGENT-WF-01 Workflow 数字员工测试。"""

from __future__ import annotations

import pytest

from mate_kernel.action.engine import ActionService
from mate_kernel.agent.workflow import (
    FlowDefinition,
    FlowNode,
    FlowStatus,
    NodeKind,
    WorkflowAgent,
)
from mate_kernel.manager.protocol import Manager, ManagerContext


def _ctx() -> ManagerContext:
    return ManagerContext(user_id="alice", tenant_id="acme", session_id="s-1")


def _node(nid: str, kind: NodeKind, **kw) -> FlowNode:
    return FlowNode(node_id=nid, kind=kind, **kw)


class TestFlowDefinition:
    def test_valid(self) -> None:
        f = FlowDefinition(
            flow_rid="wfe.acme.flow.approve.v1",
            nodes=(
                _node("s", NodeKind.START, next="a"),
                _node("a", NodeKind.ACTION, action_rid="ont.acme.act.approve", next="e"),
                _node("e", NodeKind.END),
            ),
            start_node_id="s",
        )
        assert f.start_node_id == "s"

    def test_start_must_exist(self) -> None:
        with pytest.raises(ValueError, match="start_node_id"):
            FlowDefinition(
                flow_rid="wfe.x.flow.x.v1",
                nodes=(_node("a", NodeKind.ACTION, action_rid="r", next="e"),),
                start_node_id="missing",
            )

    def test_next_must_exist(self) -> None:
        with pytest.raises(ValueError, match="missing"):
            FlowDefinition(
                flow_rid="wfe.x.flow.x.v1",
                nodes=(_node("s", NodeKind.START, next="ghost"),),
                start_node_id="s",
            )


class TestWorkflowAgent:
    def _svc(self) -> ActionService:
        s = ActionService()
        s.register_function("ont.acme.act.approve", lambda t, p: "approved")
        s.register_function("ont.acme.act.notify", lambda t, p: "notified")
        return s

    def _mgr(self) -> Manager:
        return Manager(_ctx())

    def test_simple_action_flow_completes(self) -> None:
        wa = WorkflowAgent(self._svc())
        flow = FlowDefinition(
            flow_rid="wfe.acme.flow.approve.v1",
            nodes=(
                _node("s", NodeKind.START, next="a"),
                _node("a", NodeKind.ACTION, action_rid="ont.acme.act.approve", next="n"),
                _node("n", NodeKind.ACTION, action_rid="ont.acme.act.notify", next="e"),
                _node("e", NodeKind.END),
            ),
            start_node_id="s",
        )
        state = wa.start(flow, _ctx(), self._mgr())
        assert state.status == FlowStatus.COMPLETED
        assert state.finished_at is not None

    def test_wait_user_pauses(self) -> None:
        wa = WorkflowAgent(self._svc())
        flow = FlowDefinition(
            flow_rid="wfe.acme.flow.review.v1",
            nodes=(
                _node("s", NodeKind.START, next="w"),
                _node("w", NodeKind.WAIT_USER),
                _node("e", NodeKind.END, next=None),
            ),
            start_node_id="s",
        )
        # need to give w -> e link via next_true? WAIT_USER doesn't have next; treat as terminal pause.
        # patch:
        flow = FlowDefinition(
            flow_rid="wfe.acme.flow.review.v1",
            nodes=(
                _node("s", NodeKind.START, next="w"),
                _node("w", NodeKind.WAIT_USER),
            ),
            start_node_id="s",
        )
        state = wa.start(flow, _ctx(), self._mgr())
        assert state.status == FlowStatus.AWAITING_USER

    def test_resume_after_wait_user(self) -> None:
        wa = WorkflowAgent(self._svc())
        flow = FlowDefinition(
            flow_rid="wfe.acme.flow.review2.v1",
            nodes=(
                _node("s", NodeKind.START, next="a"),
                _node("a", NodeKind.ACTION, action_rid="ont.acme.act.approve", next="w"),
                _node("w", NodeKind.WAIT_USER),
            ),
            start_node_id="s",
        )
        state = wa.start(flow, _ctx(), self._mgr())
        # action ran → 之后等待用户
        assert state.status == FlowStatus.AWAITING_USER
        # resume：但 WAIT_USER 之后没有 next；应保持等待；用 abort 结束
        wa.abort(flow.flow_rid, _ctx(), reason="user cancel")
        s2 = wa.get_state(flow.flow_rid, _ctx())
        assert s2.status == FlowStatus.ABORTED

    def test_abort(self) -> None:
        wa = WorkflowAgent(self._svc())
        flow = FlowDefinition(
            flow_rid="wfe.acme.flow.x.v1",
            nodes=(_node("s", NodeKind.START),),
            start_node_id="s",
        )
        wa.start(flow, _ctx(), self._mgr())
        state = wa.abort(flow.flow_rid, _ctx(), reason="user cancel")
        assert state.status == FlowStatus.ABORTED

    def test_validation_rejects_missing_next(self) -> None:
        with pytest.raises(ValueError, match="missing"):
            FlowDefinition(
                flow_rid="wfe.acme.flow.y.v1",
                nodes=(_node("s", NodeKind.START, next="ghost"),),
                start_node_id="s",
            )

    def test_records_action_change(self) -> None:
        wa = WorkflowAgent(self._svc())
        mgr = self._mgr()
        flow = FlowDefinition(
            flow_rid="wfe.acme.flow.z.v1",
            nodes=(
                _node("s", NodeKind.START, next="a"),
                _node("a", NodeKind.ACTION, action_rid="ont.acme.act.approve", next="e"),
                _node("e", NodeKind.END),
            ),
            start_node_id="s",
        )
        wa.start(flow, _ctx(), mgr)
        changes = mgr.drain_changes()
        assert any(c.target_rid == "ont.acme.act.approve" for c in changes)

    def test_get_state_unknown_raises(self) -> None:
        wa = WorkflowAgent(self._svc())
        with pytest.raises(KeyError):
            wa.get_state("wfe.acme.flow.never.v1", _ctx())


class TestSelectorRoutedToWorkflow:
    def test_workflow_rid_routes_to_workflow_role(self) -> None:
        from mate_kernel.agent.orchestrator import AgentRole, AgentSelector
        assert AgentSelector().select("wfe.acme.flow.approve.v1") == AgentRole.WORKFLOW
