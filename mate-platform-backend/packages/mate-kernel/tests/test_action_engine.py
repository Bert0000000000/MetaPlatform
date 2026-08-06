"""ACTION-03 ActionType.apply 协议测试。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from mate_kernel.action.engine import (
    ActionProposal,
    ActionService,
    SimpleRuleEvaluator,
    SubmissionContext,
    SubmissionCriteriaFailed,
)


class TestRuleEvaluator:
    def _e(self) -> SimpleRuleEvaluator:
        return SimpleRuleEvaluator()

    def test_eq_literal_match(self) -> None:
        assert self._e().evaluate("status == 'pending'", {"status": "pending"}, {}) is True

    def test_eq_literal_no_match(self) -> None:
        assert self._e().evaluate("status == 'pending'", {"status": "approved"}, {}) is False

    def test_neq(self) -> None:
        assert self._e().evaluate("status != 'deleted'", {"status": "active"}, {}) is True

    def test_startswith(self) -> None:
        assert self._e().evaluate("name startswith order", {"name": "order-100"}, {}) is True

    def test_unknown_expr_truthy(self) -> None:
        assert self._e().evaluate("flag", {"flag": True}, {})

    def test_target_props_fallback(self) -> None:
        assert self._e().evaluate("status == 'pending'", {}, {"status": "pending"})


class TestActionService:
    def _ctx(self) -> SubmissionContext:
        return SubmissionContext(
            actor="alice",
            sandbox_id="sb-001",
            hitl_token="tok-xyz",
            tenant_id="acme",
        )

    def _service(self) -> ActionService:
        return ActionService()

    def test_propose(self) -> None:
        s = self._service()
        p = s.propose(
            action_rid="ont.acme.act.approve",
            parameters={"status": "pending"},
            target_iid="ont.acme.ind.order.1",
            impact_summary="Approve order 1",
        )
        assert isinstance(p, ActionProposal)
        assert p.requires_hitl is True

    def test_apply_with_criteria_pass(self) -> None:
        s = self._service()
        outcome = s.apply(
            action_rid="ont.acme.act.approve",
            submission_criteria=("status == 'pending'",),
            function_ref="ont.acme.fn.approve.v1",
            on_rid="ont.acme.obj.order",
            target_iid="ont.acme.ind.order.1",
            parameters={"status": "pending"},
            side_effects=("notify_approver", "audit_log"),
            ctx=self._ctx(),
        )
        assert outcome.side_effects_emitted == ["notify_approver", "audit_log"]
        assert outcome.rolled_back is False
        assert outcome.audit_id.startswith("audit-")

    def test_apply_criteria_fail_raises(self) -> None:
        s = self._service()
        with pytest.raises(SubmissionCriteriaFailed, match="submission criteria not met"):
            s.apply(
                action_rid="ont.acme.act.approve",
                submission_criteria=("status == 'pending'",),
                function_ref="ont.acme.fn.approve.v1",
                on_rid="ont.acme.obj.order",
                target_iid="ont.acme.ind.order.1",
                parameters={"status": "approved"},
                side_effects=(),
                ctx=self._ctx(),
            )

    def test_apply_records_audit(self) -> None:
        s = self._service()
        s.apply(
            action_rid="ont.acme.act.a",
            submission_criteria=(),
            function_ref="ont.acme.fn.a.v1",
            on_rid="ont.acme.obj.a",
            target_iid=None,
            parameters={},
            side_effects=("emit",),
            ctx=self._ctx(),
        )
        s.apply(
            action_rid="ont.acme.act.b",
            submission_criteria=(),
            function_ref="ont.acme.fn.b.v1",
            on_rid="ont.acme.obj.b",
            target_iid=None,
            parameters={},
            side_effects=(),
            ctx=self._ctx(),
        )
        audit = s.get_audit()
        assert len(audit) == 2
        assert audit[0].audit_id == "audit-1"
        assert audit[1].audit_id == "audit-2"

    def test_rollback_on_failure(self) -> None:
        s = self._service()
        called = {"rollback": False}

        def bad_hook(t, p):
            raise RuntimeError("simulated fn failure")

        def rollback(t, p):
            called["rollback"] = True

        s.register_function("ont.acme.fn.fail.v1", bad_hook)
        with pytest.raises(RuntimeError, match="simulated fn failure"):
            s.apply(
                action_rid="ont.acme.act.fail",
                submission_criteria=(),
                function_ref="ont.acme.fn.fail.v1",
                on_rid="ont.acme.obj.fail",
                target_iid="ont.acme.ind.fail.1",
                parameters={},
                side_effects=(),
                ctx=self._ctx(),
                rollback_hook=rollback,
            )
        assert called["rollback"] is True
        # 失败不入审计
        assert s.get_audit() == []

    def test_register_function_invokes(self) -> None:
        s = self._service()
        invoked = {"called": False}

        def fn(t, p):
            invoked["called"] = True
            return "ok"

        s.register_function("ont.acme.fn.good.v1", fn)
        outcome = s.apply(
            action_rid="ont.acme.act.ok",
            submission_criteria=(),
            function_ref="ont.acme.fn.good.v1",
            on_rid="ont.acme.obj.ok",
            target_iid=None,
            parameters={},
            side_effects=(),
            ctx=self._ctx(),
        )
        assert invoked["called"] is True
        assert outcome.rolled_back is False


class TestSubmissionContext:
    def test_required_fields(self) -> None:
        c = SubmissionContext(actor="alice")
        assert c.actor == "alice"
        assert c.sandbox_id is None

    def test_immutable(self) -> None:
        c = SubmissionContext(actor="alice")
        with pytest.raises(Exception):
            c.actor = "evil"  # type: ignore[misc]