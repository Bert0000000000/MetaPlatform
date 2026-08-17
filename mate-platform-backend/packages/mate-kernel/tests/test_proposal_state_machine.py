"""MP-SAL-04: Proposal 状态机 —— 内核红测试（ADR-0044 §2.1）。

pending → confirmed → applied / rejected（终态）。
未确认 proposal 永不落库：apply(proposal_id=未确认) → ProposalNotConfirmed。
"""

from __future__ import annotations

import pytest

from mate_kernel.action.engine import (
    ActionProposal,
    ActionService,
    ProposalNotConfirmed,
    ProposalStatus,
    SubmissionContext,
)


def _svc_with_action() -> ActionService:
    svc = ActionService()
    return svc


_CTX = SubmissionContext(actor="ai", tenant_id="t", hitl_token="tok-1")


def _propose(svc: ActionService, action_rid: str = "ont.t.act.flag.v1") -> ActionProposal:
    return svc.propose(
        action_rid=action_rid,
        parameters={"reason": "big amount"},
        target_iid="ont.t.ind.order.o1",
        impact_summary="把订单 o1 标记为待复核",
        expected_diff={"status": "open -> pending_review"},
    )


class TestStateMachine:
    def test_proposal_starts_pending_with_diff(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc)
        assert p.status is ProposalStatus.PENDING
        assert p.expected_diff["status"] == "open -> pending_review"

    def test_confirm_transitions(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc)
        confirmed = svc.confirm_proposal(p.proposal_id, confirmed_by="alice")
        assert confirmed.status is ProposalStatus.CONFIRMED
        assert confirmed.confirmed_by == "alice"
        assert confirmed.confirmed_at is not None

    def test_reject_is_terminal(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc)
        svc.reject_proposal(p.proposal_id, confirmed_by="alice")
        with pytest.raises(ValueError, match="rejected"):
            svc.confirm_proposal(p.proposal_id, confirmed_by="alice")

    def test_double_confirm_rejected(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc)
        svc.confirm_proposal(p.proposal_id, confirmed_by="alice")
        with pytest.raises(ValueError, match="pending"):
            svc.confirm_proposal(p.proposal_id, confirmed_by="bob")


class TestApplyGuards:
    def test_unconfirmed_proposal_never_applies(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc)  # 留在 pending
        with pytest.raises(ProposalNotConfirmed):
            svc.apply(
                action_rid=p.action_rid,
                submission_criteria=(),
                function_ref="fn",
                on_rid="",
                target_iid=p.target_iid,
                parameters=p.parameters,
                side_effects=(),
                ctx=_CTX,
                proposal_id=p.proposal_id,
            )

    def test_rejected_proposal_never_applies(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc)
        svc.reject_proposal(p.proposal_id, confirmed_by="alice")
        with pytest.raises(ProposalNotConfirmed):
            svc.apply(
                action_rid=p.action_rid,
                submission_criteria=(),
                function_ref="fn",
                on_rid="",
                target_iid=p.target_iid,
                parameters=p.parameters,
                side_effects=(),
                ctx=_CTX,
                proposal_id=p.proposal_id,
            )

    def test_confirmed_then_apply_marks_applied_and_audits(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc)
        svc.confirm_proposal(p.proposal_id, confirmed_by="alice")
        events: list[str] = []
        outcome = svc.apply(
            action_rid=p.action_rid,
            submission_criteria=(),
            function_ref="fn-flag",
            on_rid="",
            target_iid=p.target_iid,
            parameters=p.parameters,
            side_effects=("notify_user",),
            ctx=_CTX,
            proposal_id=p.proposal_id,
            side_effect_emitter=lambda se: events.append(se) or f"evt-{len(events)}",
        )
        assert outcome.proposal_id == p.proposal_id
        assert svc.get_proposal(p.proposal_id).status is ProposalStatus.APPLIED
        assert outcome.side_effect_events == [("notify_user", "evt-1")]

    def test_proposal_action_mismatch_rejected(self) -> None:
        svc = _svc_with_action()
        p = _propose(svc, action_rid="ont.t.act.flag.v1")
        svc.confirm_proposal(p.proposal_id, confirmed_by="alice")
        with pytest.raises(ProposalNotConfirmed, match="action"):
            svc.apply(
                action_rid="ont.t.act.other.v1",
                submission_criteria=(),
                function_ref="fn",
                on_rid="",
                target_iid=None,
                parameters={},
                side_effects=(),
                ctx=_CTX,
                proposal_id=p.proposal_id,
            )

    def test_null_proposal_id_legacy_path_still_works(self) -> None:
        svc = _svc_with_action()
        outcome = svc.apply(
            action_rid="ont.t.act.flag.v1",
            submission_criteria=(),
            function_ref="fn",
            on_rid="",
            target_iid=None,
            parameters={"reason": "x"},
            side_effects=(),
            ctx=_CTX,
        )
        assert outcome.proposal_id is None
