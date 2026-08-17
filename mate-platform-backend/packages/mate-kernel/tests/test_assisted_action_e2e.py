"""MP-SAL-04: assisted action 端到端 —— repo 链路测试（ADR-0044 §3）。

正路径：propose(pending) → confirm → apply(proposal_id) → 落库 + outbox 事件。
negative：未确认直调 apply → ProposalNotConfirmed 且数据零变化；rejected 不可 apply。
四段留痕：proposal 行 / confirmed_by+at / ApplyOutcome / outbox event id。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from mate_kernel.action.engine import ProposalNotConfirmed
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types import ActionType, ObjectType, Property, PropertyFormat

_T = "sal4"
_NOW = datetime.now(UTC)
ACT = f"ont.{_T}.act.flag-review.v1"


def _setup_repo() -> InMemoryOntologyRepository:
    repo = InMemoryOntologyRepository()
    prop_status = Property(
        rid=ClassRef(f"ont.{_T}.prop.status.v1"), type_id="string",
        nullable=True, primary_key=False, title="status", format=PropertyFormat.STRING,
    )
    prop_reason = Property(
        rid=ClassRef(f"ont.{_T}.prop.reason.v1"), type_id="string",
        nullable=True, primary_key=False, title="reason", format=PropertyFormat.STRING,
    )
    repo.upsert_object_type(ObjectType(
        rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        primary_key=(ClassRef(f"ont.{_T}.prop.oid.v1"),),
        properties=(
            Property(rid=ClassRef(f"ont.{_T}.prop.oid.v1"), type_id="string",
                     nullable=False, primary_key=True, title="oid",
                     format=PropertyFormat.STRING),
            prop_status,
        ),
        display_name="order",
    ))
    repo.create_individual(Individual(
        rid=f"ont.{_T}.ind.order.o1",
        class_rid=ClassRef(f"ont.{_T}.obj.order.v1"),
        props=(
            (ClassRef(f"ont.{_T}.prop.oid.v1"), "o1"),
            (prop_status.rid, "open"),
        ),
        primary_key="o1", created_at=_NOW, updated_at=_NOW, tenant_id=_T, marking=(),
    ))
    repo.upsert_action_type(ActionType(
        rid=ClassRef(ACT),
        parameters=(prop_reason,),
        submission_criteria=(),
        side_effects=("notify_user",),
        function_ref=ClassRef(f"ont.{_T}.fn.flag.v1"),
        on=(ClassRef(f"ont.{_T}.obj.order.v1"),),
    ))
    return repo


class _OutboxSpy:
    def __init__(self) -> None:
        self.events: list[tuple[str, str, dict[str, Any]]] = []
        self._n = 0

    def __call__(self, event_type: str, tenant_id: str, payload: dict[str, Any]) -> str:
        self._n += 1
        self.events.append((event_type, tenant_id, payload))
        return f"evt-{self._n}"


class TestAssistedActionE2E:
    def test_propose_confirm_apply_with_outbox(self) -> None:
        repo = _setup_repo()
        outbox = _OutboxSpy()
        repo.set_outbox_writer(outbox)

        prop = repo.propose_action(
            action_rid=ClassRef(ACT),
            parameters={"reason": "金额超 10 万"},
            target_iid=f"ont.{_T}.ind.order.o1",
            impact_summary="把订单 o1 标记为待复核",
            expected_diff={"reason": "<unset> -> 金额超 10 万"},
        )
        assert prop.status.value == "pending"  # ① 提议（不落库）

        confirmed = repo.confirm_proposal(prop.proposal_id, confirmed_by="alice")
        assert confirmed.status.value == "confirmed"
        assert confirmed.confirmed_by == "alice"  # ② 确认留痕

        applied_at, effects = repo.apply_action(
            ClassRef(ACT),
            f"ont.{_T}.ind.order.o1",
            {"reason": "金额超 10 万"},
            {"actor": "ai", "tenant_id": _T, "proposal_id": prop.proposal_id},
        )
        assert applied_at  # ③ 落库
        assert effects == ["notify_user"]
        assert repo.get_proposal(prop.proposal_id).status.value == "applied"
        assert outbox.events, "outbox must receive side-effect events"  # ④ 外部同步
        assert outbox.events[0][2]["proposal_id"] == prop.proposal_id
        assert outbox.events[0][2]["action_rid"] == ACT

    def test_unconfirmed_proposal_never_writes(self) -> None:
        repo = _setup_repo()
        prop = repo.propose_action(
            ClassRef(ACT), {"reason": "x"}, f"ont.{_T}.ind.order.o1", "impact",
        )
        with pytest.raises(ProposalNotConfirmed):
            repo.apply_action(
                ClassRef(ACT), f"ont.{_T}.ind.order.o1", {"reason": "x"},
                {"actor": "ai", "proposal_id": prop.proposal_id},
            )
        # 数据零变化
        ind = repo.get_individual(f"ont.{_T}.ind.order.o1")
        assert dict(ind.props).get(ClassRef(f"ont.{_T}.prop.status.v1")) == "open"

    def test_rejected_proposal_never_writes(self) -> None:
        repo = _setup_repo()
        prop = repo.propose_action(
            ClassRef(ACT), {"reason": "x"}, f"ont.{_T}.ind.order.o1", "impact",
        )
        repo.reject_proposal(prop.proposal_id, confirmed_by="alice")
        with pytest.raises(ProposalNotConfirmed):
            repo.apply_action(
                ClassRef(ACT), f"ont.{_T}.ind.order.o1", {"reason": "x"},
                {"actor": "ai", "proposal_id": prop.proposal_id},
            )
        assert repo.get_proposal(prop.proposal_id).status.value == "rejected"
