"""ACT-08 —— Scenario 会话沙盒最小版：读穿透写留沙盒 / merge 受治理落地。

覆盖：
1. 沙盒写不影响主库（discard 后主库原样）；
2. 合并视图：overlay 优先、墓碑隐藏、新建可见；
3. merge_to_base → apply_edit_set_now（审计管道）→ 主库生效 + 沙盒清空；
4. 冲突：沙盒期间主库删除目标 → merge 抛 ScenarioConflictError。
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
for _p in (_K,):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.action.scenario import ScenarioConflictError, ScenarioOverlay
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "act08"
OBJ = f"ont.{T}.obj.org.seat.v1"
P_ID = f"ont.{T}.prop.seat-id.v1"
P_OWNER = f"ont.{T}.prop.owner.v1"
ACT = f"ont.{T}.act.org.reassign-seat.v1"


def _base() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ),
            primary_key=(ClassRef(P_ID),),
            properties=(
                Property(
                    rid=ClassRef(P_ID),
                    type_id="string",
                    nullable=False,
                    primary_key=True,
                    title="seatId",
                    format=PropertyFormat.STRING,
                ),
                Property(
                    rid=ClassRef(P_OWNER),
                    type_id="string",
                    nullable=True,
                    primary_key=False,
                    title="owner",
                    format=PropertyFormat.STRING,
                ),
            ),
            display_name="seat",
        )
    )
    r.upsert_action_type(
        ActionType(
            rid=ClassRef(ACT),
            parameters=(),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(f"ont.{T}.fn.org.reassign.v1"),
            on=(ClassRef(OBJ),),
            title="Reassign Seat",
        )
    )
    r.create_individual(
        Individual(
            rid=f"ont.{T}.ind.seat.s1",
            class_rid=ClassRef(OBJ),
            props=((ClassRef(P_ID), "s1"), (ClassRef(P_OWNER), "alice")),
            primary_key="s1",
            tenant_id=T,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
    return r


class TestScenarioOverlay:
    def test_writes_stay_in_sandbox(self) -> None:
        base = _base()
        sc = ScenarioOverlay(base)
        sc.set_property(f"ont.{T}.ind.seat.s1", P_OWNER, "bob")
        # 沙盒内可见
        assert sc.get_individual(f"ont.{T}.ind.seat.s1").get(ClassRef(P_OWNER)) == "bob"
        # 主库未动
        assert base.get_individual(f"ont.{T}.ind.seat.s1").get(ClassRef(P_OWNER)) == "alice"
        sc.discard()
        assert sc.get_individual(f"ont.{T}.ind.seat.s1").get(ClassRef(P_OWNER)) == "alice"

    def test_merged_view_with_tombstone_and_create(self) -> None:
        base = _base()
        sc = ScenarioOverlay(base)
        sc.delete_object(f"ont.{T}.ind.seat.s1")
        sc.create_object(OBJ, "s2", {P_ID: "s2", P_OWNER: "carol"})
        rids = {i.rid for i in sc.list_individuals()}
        assert f"ont.{T}.ind.seat.s1" not in rids
        assert f"ont.{T}.ind.seat.s2" in rids

    def test_merge_applies_to_base_with_audit(self) -> None:
        base = _base()
        sc = ScenarioOverlay(base)
        sc.set_property(f"ont.{T}.ind.seat.s1", P_OWNER, "dave")
        sc.create_object(OBJ, "s3", {P_ID: "s3", P_OWNER: "erin"})
        assert len(sc.pending_edits()) == 2
        result = sc.merge_to_base(ACT, actor="planner-1")
        assert len(result.applied) == 2
        # 主库生效
        assert base.get_individual(f"ont.{T}.ind.seat.s1").get(ClassRef(P_OWNER)) == "dave"
        assert base.get_individual(f"ont.{T}.ind.seat.s3").get(ClassRef(P_OWNER)) == "erin"
        # 沙盒清空
        assert sc.pending_edits() == []
        # 审计留痕（即时 proposal 路径）
        assert len(base._action_service.get_audit()) >= 1

    def test_conflict_when_base_deleted_target(self) -> None:
        base = _base()
        sc = ScenarioOverlay(base)
        sc.set_property(f"ont.{T}.ind.seat.s1", P_OWNER, "frank")
        # 沙盒期间主库删掉目标（模拟并发）
        base._individuals.pop(f"ont.{T}.ind.seat.s1")
        with pytest.raises(ScenarioConflictError):
            sc.merge_to_base(ACT, actor="planner-1")
