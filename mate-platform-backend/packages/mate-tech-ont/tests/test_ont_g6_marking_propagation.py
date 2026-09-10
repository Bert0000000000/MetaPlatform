"""G6 —— marking 血缘传播：读时强制（实例 ∧ 类型[含祖先]）+ 写时继承 + 检索过滤。

语义（Palantir markings 二元合取 + 血缘传播）：
- 可见 = 实例 marking ⊆ viewer ∧ 类型 marking（含祖先类型）⊆ viewer；
- edit-set create_object → 实例继承类型（含祖先）marking；
- 语义检索卡片按同规则过滤。
"""
from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "g6"
OBJ = f"ont.{T}.obj.hr.record.v1"
OBJ_SUB = f"ont.{T}.obj.hr.payroll-record.v1"
P_ID = f"ont.{T}.prop.rid.v1"
P_NOTE = f"ont.{T}.prop.rnote.v1"
ACT = f"ont.{T}.act.hr.create-record.v1"


def _mk() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ), primary_key=(ClassRef(P_ID),),
        properties=(
            Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                     primary_key=True, title="id", format=PropertyFormat.STRING),
            Property(rid=ClassRef(P_NOTE), type_id="string", nullable=True,
                     primary_key=False, title="note", format=PropertyFormat.STRING),
        ),
        display_name="record", marking=("hr",),
    ))
    r.upsert_action_type(ActionType(
        rid=ClassRef(ACT), parameters=(), submission_criteria=(),
        side_effects=(), function_ref=ClassRef(f"ont.{T}.fn.x.v1"),
        on=(ClassRef(OBJ),), title="Create Record",
    ))
    return r


def _ind(rid: str, cls: str, pk: str, marking: tuple = ()) -> Individual:
    return Individual(
        rid=rid, class_rid=ClassRef(cls),
        props=((ClassRef(P_ID), pk),), primary_key=pk, tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
        marking=marking,
    )


class TestReadGate:
    def test_type_marking_gates_instances(self) -> None:
        r = _mk()
        # 实例本身无 marking，但类型带 hr → 无 hr 的 viewer 看不见
        r.create_individual(_ind(f"ont.{T}.ind.record.r1", OBJ, "r1"))
        assert r.enforce_read_policies(r.list_individuals(None), []) == []
        vis = r.enforce_read_policies(r.list_individuals(None), ["hr"])
        assert {i.primary_key for i in vis} == {"r1"}

    def test_instance_marking_and_gate(self) -> None:
        r = _mk()
        # 实例自身带 pii（类型 hr 合取）：必须同时持 hr+pii
        r.create_individual(_ind(f"ont.{T}.ind.record.r2", OBJ, "r2", ("pii",)))
        only_hr = r.enforce_read_policies(r.list_individuals(None), ["hr"])
        assert only_hr == []
        both = r.enforce_read_policies(r.list_individuals(None), ["hr", "pii"])
        assert {i.primary_key for i in both} == {"r2"}

    def test_parent_type_marking_propagates(self) -> None:
        r = _mk()
        # 子类型自身无 marking，但父类型 hr → 祖先 marking 传播约束
        r.upsert_object_type(ObjectType(
            rid=ClassRef(OBJ_SUB), primary_key=(ClassRef(P_ID),),
            properties=(
                Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                         primary_key=True, title="id", format=PropertyFormat.STRING),
            ),
            display_name="payroll", parent_class=ClassRef(OBJ),
        ))
        r.create_individual(_ind(f"ont.{T}.ind.payroll-record.p1", OBJ_SUB, "p1"))
        assert r.enforce_read_policies(r.list_individuals(None), []) == []
        vis = r.enforce_read_policies(r.list_individuals(None), ["hr"])
        assert {i.primary_key for i in vis} == {"p1"}


class TestWriteInheritance:
    def test_create_object_inherits_type_marking(self) -> None:
        r = _mk()
        r.apply_edit_set_now(
            ACT, None, {},
            [{"op": "create_object", "class_rid": OBJ,
              "primary_key": "r9", "props": {P_ID: "r9", P_NOTE: "n"}}],
            actor="hr-1",
        )
        ind = r.get_individual(f"ont.{T}.ind.record.r9")
        assert ind.marking == ("hr",)

    def test_create_inherits_ancestor_marking(self) -> None:
        r = _mk()
        r.upsert_object_type(ObjectType(
            rid=ClassRef(OBJ_SUB), primary_key=(ClassRef(P_ID),),
            properties=(
                Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                         primary_key=True, title="id", format=PropertyFormat.STRING),
            ),
            display_name="payroll", parent_class=ClassRef(OBJ),
        ))
        r.apply_edit_set_now(
            ACT, None, {},
            [{"op": "create_object", "class_rid": OBJ_SUB,
              "primary_key": "p9", "props": {P_ID: "p9"}}],
            actor="hr-1",
        )
        ind = r.get_individual(f"ont.{T}.ind.payroll-record.p9")
        assert ind.marking == ("hr",)  # 父类型 marking 继承


PG_DSN = os.environ.get(
    "G6_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgSameSemantics:
    def test_pg_gate_and_inheritance(self) -> None:
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        try:
            with r.tenant_scope(T):
                mem = _mk()
                r.upsert_object_type(mem.get_object_type(ClassRef(OBJ)))
                r.upsert_action_type(mem.get_action_type(ClassRef(ACT)))
                r.create_individual(_ind(f"ont.{T}.ind.record.pg1", OBJ, "pg1"))
                # 类型 marking hr → 无 marking 不可见
                vis = r.enforce_read_policies(
                    r.list_individuals(ClassRef(OBJ)), [])
                assert vis == []
                vis2 = r.enforce_read_policies(
                    r.list_individuals(ClassRef(OBJ)), ["hr"])
                assert {i.primary_key for i in vis2} == {"pg1"}
                # edit-set 创建 → marking 继承
                r.apply_edit_set_now(
                    ACT, None, {},
                    [{"op": "create_object", "class_rid": OBJ,
                      "primary_key": "pg9", "props": {P_ID: "pg9"}}],
                    actor="pg-op",
                )
                ind = r.get_individual(f"ont.{T}.ind.record.pg9")
                assert ind.marking == ("hr",)
        finally:
            with conn.cursor() as cur:
                for tbl in ("ont_individual", "ont_object_type", "ont_axiom",
                            "ont_action_type", "ont_proposal",
                            "ont_proposal_event", "ont_proposal_execution",
                            "ont_proposal_idempotency", "ont_action_audit",
                            "ont_outbox_event"):
                    cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
            conn.commit()
            conn.close()
