"""SEC-12 —— 行列级安全策略：行过滤 / 列脱敏 / bypass / 层级联动。

覆盖：
1. 行策略：不满足可见条件的实例被剔除；持有 bypass_markings 豁免；
2. 列策略：缺 required_markings → 值置 None（对象仍可见）；持有则原值；
3. 行 × 列组合 = 单元格级语义；
4. 层级联动：父类行策略约束子类实例（EXP-01 × SEC-12）；
5. PG 同语义（策略表 CRUD + 过滤）。
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
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "sec12"
OBJ = f"ont.{T}.obj.hr.employee.v1"
OBJ_MGR = f"ont.{T}.obj.hr.manager.v1"
P_ID = f"ont.{T}.prop.eid.v1"
P_SAL = f"ont.{T}.prop.salary.v1"
P_LEVEL = f"ont.{T}.prop.elevel.v1"


def _mk() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ), primary_key=(ClassRef(P_ID),),
        properties=(
            Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                     primary_key=True, title="id", format=PropertyFormat.STRING),
            Property(rid=ClassRef(P_SAL), type_id="double", nullable=True,
                     primary_key=False, title="salary", format=PropertyFormat.DOUBLE),
            Property(rid=ClassRef(P_LEVEL), type_id="string", nullable=True,
                     primary_key=False, title="level", format=PropertyFormat.STRING),
        ),
        display_name="employee",
    ))
    for pk, sal, level in [("e1", 100.0, "junior"), ("e2", 900.0, "exec")]:
        r.create_individual(Individual(
            rid=f"ont.{T}.ind.employee.{pk}", class_rid=ClassRef(OBJ),
            props=((ClassRef(P_ID), pk), (ClassRef(P_SAL), sal),
                   (ClassRef(P_LEVEL), level)),
            primary_key=pk, tenant_id=T,
            created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
        ))
    return r


class TestRowPolicies:
    def test_row_filter_and_bypass(self) -> None:
        r = _mk()
        r.upsert_security_policy({
            "kind": "row", "class_rid": OBJ,
            "field": "elevel", "op": "ne", "value": "exec",
            "bypass_markings": ["hr-privileged"],
        })
        visible = r.enforce_read_policies(r.list_individuals(None), [])
        assert {i.primary_key for i in visible} == {"e1"}
        allv = r.enforce_read_policies(r.list_individuals(None), ["hr-privileged"])
        assert {i.primary_key for i in allv} == {"e1", "e2"}

    def test_parent_policy_constrains_descendant(self) -> None:
        r = _mk()
        r.upsert_object_type(ObjectType(
            rid=ClassRef(OBJ_MGR), primary_key=(ClassRef(P_ID),),
            properties=(
                Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                         primary_key=True, title="id", format=PropertyFormat.STRING),
                Property(rid=ClassRef(P_LEVEL), type_id="string", nullable=True,
                         primary_key=False, title="level", format=PropertyFormat.STRING),
            ),
            display_name="manager", parent_class=ClassRef(OBJ),
        ))
        r.create_individual(Individual(
            rid=f"ont.{T}.ind.manager.m1", class_rid=ClassRef(OBJ_MGR),
            props=((ClassRef(P_ID), "m1"), (ClassRef(P_LEVEL), "exec")),
            primary_key="m1", tenant_id=T,
            created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
        ))
        r.upsert_security_policy({
            "kind": "row", "class_rid": OBJ,
            "field": "elevel", "op": "ne", "value": "exec",
        })
        visible = r.enforce_read_policies(r.list_individuals(None), [])
        assert "m1" not in {i.primary_key for i in visible}


class TestColumnPolicies:
    def test_mask_and_hold(self) -> None:
        r = _mk()
        r.upsert_security_policy({
            "kind": "column", "property_rid": P_SAL,
            "required_markings": ["finance"],
        })
        rows = [{"eid": "e1", "salary": 100.0}, {"eid": "e2", "salary": 900.0}]
        masked = r.mask_rows([dict(x) for x in rows], [])
        assert all(x["salary"] is None for x in masked)
        held = r.mask_rows([dict(x) for x in rows], ["finance"])
        assert held[0]["salary"] == 100.0

    def test_cell_level_semantics(self) -> None:
        """行过滤 + 列脱敏组合 = 单元格级（可见对象但敏感列置空）。"""
        r = _mk()
        r.upsert_security_policy({
            "kind": "row", "class_rid": OBJ,
            "field": "elevel", "op": "ne", "value": "exec",
            "bypass_markings": ["hr-privileged"],
        })
        r.upsert_security_policy({
            "kind": "column", "property_rid": P_SAL,
            "required_markings": ["finance"],
        })
        vis = r.enforce_read_policies(r.list_individuals(None), ["hr-privileged"])
        assert {i.primary_key for i in vis} == {"e1", "e2"}
        rows = [
            {"eid": i.primary_key,
             "salary": i.get(ClassRef(P_SAL))} for i in vis]
        masked = r.mask_rows(rows, ["hr-privileged"])
        assert all(x["salary"] is None for x in masked)


PG_DSN = os.environ.get(
    "SEC12_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgSameSemantics:
    def test_pg_row_policy(self) -> None:
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
                for i in mem.list_individuals(None):
                    r.create_individual(i)
                r.upsert_security_policy({
                    "kind": "row", "class_rid": OBJ,
                    "field": "elevel", "op": "ne", "value": "exec",
                    "markings": ["hr-privileged"], "tenant_id": T,
                })
                vis = r.enforce_read_policies(
                    r.list_individuals(ClassRef(OBJ)), [])
                assert {i.primary_key for i in vis} == {"e1"}
                allv = r.enforce_read_policies(
                    r.list_individuals(ClassRef(OBJ)), ["hr-privileged"])
                assert {i.primary_key for i in allv} == {"e1", "e2"}
                assert len(r.list_security_policies()) >= 1
        finally:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM ont_security_policy WHERE tenant_id=%s", (T,))
                cur.execute("DELETE FROM ont_individual WHERE tenant_id=%s", (T,))
                cur.execute("DELETE FROM ont_object_type WHERE tenant_id=%s", (T,))
                cur.execute("DELETE FROM ont_axiom WHERE tenant_id=%s", (T,))
            conn.commit()
            conn.close()
