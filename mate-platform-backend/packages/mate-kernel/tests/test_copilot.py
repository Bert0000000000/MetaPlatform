"""SUPER-COPILOT-01 SuperAI 编排平面测试。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from mate_kernel.agent.copilot import (
    AuditRetention,
    HitlTokenStore,
    IntentRouter,
    NullAgentInvoker,
    RetentionPolicy,
    SuperAICopilot,
    SuperAICopilotConfig,
)
from mate_kernel.agent.orchestrator import AgentRole, StepStatus
from mate_kernel.manager.protocol import Manager, ManagerContext


def _ctx() -> ManagerContext:
    return ManagerContext(user_id="alice", tenant_id="acme", session_id="s-1")


class TestHitlTokenStore:
    def _store(self) -> HitlTokenStore:
        return HitlTokenStore(ttl_seconds=60)

    def test_issue_and_validate(self) -> None:
        s = self._store()
        t = s.issue(_ctx(), "p1", "1")
        assert t.is_valid()
        out = s.validate(t.token, plan_id="p1", step_id="1")
        assert out.token == t.token

    def test_expired_token(self) -> None:
        s = HitlTokenStore(ttl_seconds=0)
        t = s.issue(_ctx(), "p1", "1")
        # ttl=0 → expires_at = now + 0 = now → 已过期
        with pytest.raises(PermissionError, match="expired"):
            s.validate(t.token, plan_id="p1", step_id="1")

    def test_mismatch_raises(self) -> None:
        s = self._store()
        t = s.issue(_ctx(), "p1", "1")
        with pytest.raises(PermissionError, match="mismatch"):
            s.validate(t.token, plan_id="p2", step_id="1")

    def test_consume_marks_used(self) -> None:
        s = self._store()
        t = s.issue(_ctx(), "p1", "1")
        s.consume(t.token)
        # 再次使用 → expired (used=True)
        with pytest.raises(PermissionError):
            s.validate(t.token, plan_id="p1", step_id="1")


class TestIntentRouter:
    def _r(self) -> IntentRouter:
        return IntentRouter()

    def test_route_ontology(self) -> None:
        assert self._r().route("查看订单对象") == AgentRole.ONTOLOGY

    def test_route_workflow(self) -> None:
        assert self._r().route("发起一个审批流程") == AgentRole.WORKFLOW

    def test_route_app(self) -> None:
        assert self._r().route("构建一个表单页面") == AgentRole.APP

    def test_route_data(self) -> None:
        assert self._r().route("查看血缘") == AgentRole.DATA_PRODUCT

    def test_route_obs(self) -> None:
        assert self._r().route("CPU 告警") == AgentRole.OBS

    def test_route_security(self) -> None:
        assert self._r().route("检查 marking 权限") == AgentRole.SECURITY

    def test_route_kb(self) -> None:
        assert self._r().route("查找 wiki 文档") == AgentRole.KNOWLEDGE

    def test_route_unknown_falls_back_to_superai(self) -> None:
        assert self._r().route("今天天气怎么样") == AgentRole.SUPERAI

    def test_plan_creates_two_steps(self) -> None:
        plan = self._r().plan("查找文档", author_user_id="alice", plan_id="p1")
        assert len(plan.steps) == 2
        # 必须有 HITL
        assert any(s.requires_hitl for s in plan.steps)


class TestAuditRetention:
    def _plan_state(self):
        from mate_kernel.agent.orchestrator import PlanSpec, PlanState, PlanStep, StepKind, StepResult, StepStatus
        spec = PlanSpec(
            plan_id="p1",
            author_user_id="alice",
            steps=(
                PlanStep(step_id="1", kind=StepKind.PROPOSE, target="x", requires_hitl=True),
                PlanStep(step_id="2", kind=StepKind.APPLY_ACTION, target="y"),
            ),
        )
        s = PlanState(plan=spec)
        s.history.append(StepResult(step_id="1", status=StepStatus.HITL_WAITING))
        return s

    def test_discard_returns_none(self) -> None:
        ar = AuditRetention(policy=RetentionPolicy.DISCARD)
        rec = ar.record(self._plan_state(), _ctx())
        assert rec is None
        assert ar.all_records() == ()

    def test_persist_7d_creates_record(self) -> None:
        ar = AuditRetention(policy=RetentionPolicy.PERSIST_7D)
        rec = ar.record(self._plan_state(), _ctx())
        assert rec is not None
        assert rec.expires_at is not None
        assert (rec.expires_at - rec.recorded_at).days == 7

    def test_evict_expired(self) -> None:
        ar = AuditRetention(policy=RetentionPolicy.PERSIST_7D)
        rec = ar.record(self._plan_state(), _ctx())
        assert rec is not None
        # 模拟 8 天后
        future = rec.expires_at + timedelta(days=1)
        n = ar.evict_expired(now=future)
        assert n == 1
        assert ar.all_records() == ()


class TestSuperAICopilot:
    def _cop(self, retention: RetentionPolicy = RetentionPolicy.DISCARD) -> SuperAICopilot:
        return SuperAICopilot(
            config=SuperAICopilotConfig(retention=retention),
            invoker=NullAgentInvoker(),
        )

    def test_submit_query_issues_token(self) -> None:
        c = self._cop()
        state, token = c.submit_query("查询所有订单", _ctx(), Manager(_ctx()))
        assert state.aborted is False
        assert token.plan_id == state.plan.plan_id

    def test_confirm_step_completes_plan(self) -> None:
        c = self._cop()
        state, token = c.submit_query("查询订单", _ctx(), Manager(_ctx()))
        # current_step_idx=0 → confirm step 1
        s = c.confirm_step(state.plan.plan_id, "1", token.token, _ctx(), Manager(_ctx()))
        # 因为 step 2 不是 HITL，会跑完
        assert s.aborted is False
        assert s.current_step_idx >= 1

    def test_abort(self) -> None:
        c = self._cop()
        state, _ = c.submit_query("查询订单", _ctx(), Manager(_ctx()))
        s = c.abort(state.plan.plan_id, reason="user cancel", ctx=_ctx())
        assert s.aborted is True

    def test_token_mismatch_on_confirm(self) -> None:
        c = self._cop()
        state, _ = c.submit_query("查询订单", _ctx(), Manager(_ctx()))
        with pytest.raises(PermissionError):
            c.confirm_step(state.plan.plan_id, "1", "bad-token", _ctx(), Manager(_ctx()))

    def test_persist_retention_creates_record(self) -> None:
        c = self._cop(retention=RetentionPolicy.PERSIST_7D)
        state, _ = c.submit_query("查询订单", _ctx(), Manager(_ctx()))
        c.abort(state.plan.plan_id, reason="x", ctx=_ctx())
        records = c.audit.all_records()
        assert len(records) == 1
