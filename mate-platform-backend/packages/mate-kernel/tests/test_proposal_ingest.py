"""MP-SAL-04b: proposal kind 泛化 —— 文本→本体 ingest 的内核面。

kind 三态（ADR-0044 附录 · Text-to-Ontology）：
- action          : subject = ActionType rid（SAL-04 既有）
- create_instance : subject = class rid，parameters = {props}
- model_type      : subject = 新类型 rid，parameters = 类型定义
confirm（人闸）与 execute（落库）分离；mark_applied 仅 confirmed 可达。
"""

from __future__ import annotations

import pytest

from mate_kernel.action.engine import (
    ActionService,
    ProposalNotConfirmed,
    ProposalStatus,
)

_CTX = None  # mark_applied 不需要 ctx


def _svc() -> ActionService:
    return ActionService()


class TestProposalKind:
    def test_default_kind_is_action(self) -> None:
        p = _svc().propose("ont.t.act.flag.v1", {}, None, "impact")
        assert p.kind == "action"

    def test_create_instance_kind_carries_class_rid_as_subject(self) -> None:
        p = _svc().propose(
            "ont.t.obj.supplier.v1", {"props": {"name": "华信科技"}},
            None, "新建供应商", kind="create_instance",
        )
        assert p.kind == "create_instance"
        assert p.action_rid == "ont.t.obj.supplier.v1"


class TestMarkApplied:
    def test_pending_cannot_mark_applied(self) -> None:
        svc = _svc()
        p = svc.propose("ont.t.obj.supplier.v1", {}, None, "i", kind="create_instance")
        with pytest.raises(ProposalNotConfirmed):
            svc.mark_applied(p.proposal_id)

    def test_rejected_cannot_mark_applied(self) -> None:
        svc = _svc()
        p = svc.propose("ont.t.obj.supplier.v1", {}, None, "i", kind="create_instance")
        svc.reject_proposal(p.proposal_id)
        with pytest.raises(ProposalNotConfirmed):
            svc.mark_applied(p.proposal_id)

    def test_confirmed_marks_applied(self) -> None:
        svc = _svc()
        p = svc.propose("ont.t.obj.supplier.v1", {}, None, "i", kind="create_instance")
        svc.confirm_proposal(p.proposal_id, confirmed_by="alice")
        out = svc.mark_applied(p.proposal_id)
        assert out.status is ProposalStatus.APPLIED

    def test_double_apply_marks_terminal(self) -> None:
        svc = _svc()
        p = svc.propose("x", {}, None, "i")
        svc.confirm_proposal(p.proposal_id)
        svc.mark_applied(p.proposal_id)
        with pytest.raises(ProposalNotConfirmed, match="applied"):
            svc.mark_applied(p.proposal_id)
