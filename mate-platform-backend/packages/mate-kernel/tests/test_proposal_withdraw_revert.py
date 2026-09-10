"""PRD-02（MP-ACTION-CONFIRM-01 M1）— withdraw/revert 状态机单测。

kernel 层（host 可跑，无 PG 依赖）：转移守卫 + 终态语义。
"""
from __future__ import annotations

import os
import sys

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.action.engine import (
    ActionService,
    ProposalNotConfirmed,
    ProposalStatus,
)


def _svc_with_pending():
    svc = ActionService()
    p = svc.propose(
        "ont.t.obj.x.v1", {"a": 1}, None, "test",
        kind="create_instance",
    )
    return svc, p


class TestWithdraw:
    def test_pending_can_withdraw(self) -> None:
        svc, p = _svc_with_pending()
        out = svc.withdraw_proposal(p.proposal_id, by="author")
        assert out.status is ProposalStatus.WITHDRAWN

    def test_confirmed_cannot_withdraw(self) -> None:
        svc, p = _svc_with_pending()
        svc.confirm_proposal(p.proposal_id, confirmed_by="u")
        with pytest.raises(ProposalNotConfirmed):
            svc.withdraw_proposal(p.proposal_id, by="author")

    def test_withdraw_is_terminal_for_execute(self) -> None:
        svc, p = _svc_with_pending()
        svc.withdraw_proposal(p.proposal_id)
        with pytest.raises(ProposalNotConfirmed):
            svc.mark_applied(p.proposal_id) if hasattr(svc, "mark_applied") \
                else svc.mark_executed(p.proposal_id)

    def test_double_withdraw_rejected(self) -> None:
        svc, p = _svc_with_pending()
        svc.withdraw_proposal(p.proposal_id)
        with pytest.raises(ProposalNotConfirmed):
            svc.withdraw_proposal(p.proposal_id)


class TestRevert:
    def _executed(self):
        svc, p = _svc_with_pending()
        svc.confirm_proposal(p.proposal_id, confirmed_by="u")
        mark = getattr(svc, "mark_executed", None) or svc.mark_applied
        mark(p.proposal_id)
        return svc, p

    def test_executed_can_revert(self) -> None:
        svc, p = self._executed()
        out = svc.mark_reverted(p.proposal_id)
        assert out.status is ProposalStatus.REVERTED

    def test_pending_cannot_revert(self) -> None:
        svc, p = _svc_with_pending()
        with pytest.raises(ProposalNotConfirmed):
            svc.mark_reverted(p.proposal_id)

    def test_confirmed_cannot_revert(self) -> None:
        svc, p = _svc_with_pending()
        svc.confirm_proposal(p.proposal_id, confirmed_by="u")
        with pytest.raises(ProposalNotConfirmed):
            svc.mark_reverted(p.proposal_id)

    def test_revert_is_terminal(self) -> None:
        svc, p = self._executed()
        svc.mark_reverted(p.proposal_id)
        with pytest.raises(ProposalNotConfirmed):
            svc.mark_reverted(p.proposal_id)


class TestEnumSurface:
    def test_new_states_present(self) -> None:
        assert ProposalStatus.WITHDRAWN.value == "withdrawn"
        assert ProposalStatus.REVERTED.value == "reverted"
