"""SuperAI Orchestrator (AGENT-ORCH-01) 测试。"""

from __future__ import annotations

import pytest

from mate_kernel.agent.orchestrator import (
    AgentRole,
    AgentSelector,
    PlanSpec,
    PlanState,
    PlanStep,
    StepKind,
    StepResult,
    StepStatus,
    SuperAIOrchestrator,
)


def _hitl_step(idx: str = "1") -> PlanStep:
    return PlanStep(
        step_id=idx,
        kind=StepKind.PROPOSE,
        target="ont.acme.act.approve_order",
        requires_hitl=True,
    )


def _action_step(idx: str = "2") -> PlanStep:
    return PlanStep(
        step_id=idx,
        kind=StepKind.APPLY_ACTION,
        target="ont.acme.act.approve_order",
        requires_hitl=False,
    )


def _plan(steps: tuple[PlanStep, ...]) -> PlanSpec:
    return PlanSpec(
        plan_id="p1",
        author_user_id="alice",
        steps=steps,
    )


class TestPlanSpec:
    def test_requires_hitl(self) -> None:
        with pytest.raises(ValueError, match="HITL"):
            _plan((_action_step(),))

    def test_requires_non_empty(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            PlanSpec(plan_id="p", author_user_id="alice", steps=())

    def test_basic(self) -> None:
        p = _plan((_hitl_step(), _action_step()))
        assert len(p.steps) == 2


class TestOrchestrator:
    def _orch(self) -> SuperAIOrchestrator:
        return SuperAIOrchestrator()

    def test_submit_and_get(self) -> None:
        o = self._orch()
        s = o.submit(_plan((_hitl_step(), _action_step())))
        assert s.plan.plan_id == "p1"
        assert s.current_step_idx == 0

    def test_record_completed_advances(self) -> None:
        o = self._orch()
        o.submit(_plan((_hitl_step(), _action_step())))
        o.record("p1", StepResult(step_id="1", status=StepStatus.COMPLETED))
        s = o.get("p1")
        assert s.current_step_idx == 1
        assert s.current_step is not None and s.current_step.step_id == "2"

    def test_record_hitl_waits(self) -> None:
        o = self._orch()
        o.submit(_plan((_hitl_step(), _action_step())))
        o.record("p1", StepResult(step_id="1", status=StepStatus.HITL_WAITING))
        s = o.get("p1")
        assert s.current_step_idx == 0  # 不推进
        o.record("p1", StepResult(step_id="1", status=StepStatus.COMPLETED))
        s = o.get("p1")
        assert s.current_step_idx == 1

    def test_record_failed_aborts(self) -> None:
        o = self._orch()
        o.submit(_plan((_hitl_step(), _action_step())))
        o.record("p1", StepResult(step_id="1", status=StepStatus.FAILED, error="x"))
        s = o.get("p1")
        assert s.aborted is True
        assert s.current_step is None

    def test_abort(self) -> None:
        o = self._orch()
        o.submit(_plan((_hitl_step(), _action_step())))
        s = o.abort("p1", "user cancel")
        assert s.aborted is True

    def test_get_unknown_raises(self) -> None:
        o = self._orch()
        with pytest.raises(KeyError):
            o.get("missing")


class TestAgentSelector:
    def test_ontology(self) -> None:
        sel = AgentSelector()
        assert sel.select("ont.acme.obj.order") == AgentRole.ONTOLOGY

    def test_workflow(self) -> None:
        sel = AgentSelector()
        assert sel.select("wfe.flow.approve_order") == AgentRole.WORKFLOW

    def test_data(self) -> None:
        sel = AgentSelector()
        assert sel.select("data.product.sales") == AgentRole.DATA_PRODUCT

    def test_obs(self) -> None:
        sel = AgentSelector()
        assert sel.select("obs.alert.cpu_high") == AgentRole.OBS

    def test_security(self) -> None:
        sel = AgentSelector()
        assert sel.select("sec.policy.pii") == AgentRole.SECURITY

    def test_knowledge(self) -> None:
        sel = AgentSelector()
        assert sel.select("kb.doc.manual") == AgentRole.KNOWLEDGE

    def test_app(self) -> None:
        sel = AgentSelector()
        assert sel.select("app.form.order_entry") == AgentRole.APP

    def test_unknown_falls_back_to_superai(self) -> None:
        sel = AgentSelector()
        assert sel.select("random.string") == AgentRole.SUPERAI