"""P1-6 / P1-7 —— edit-set 批量上限 10000（分片执行）+ 使用量 actor/source 维度。

P1-6（声明上限 1000→10000，内部按 EDIT_CHUNK_SIZE=1000 分片，语义不变）：
(a) 1500 条 create_object edit-set 经 apply_edit_set_now 全部落库（>1000 验证新上限）；
(b) 10001 条超限被拒（EditSetError ⊂ ValueError，解析层 fail-fast）；
(c) 分片语义：1500 条中第 1200 条引用不存在 target → 整体补偿回滚（前 1199 条不落库）。

P1-7（使用量补 user/app 维度：actor + source，向后兼容）：
(d) record_usage 不同 actor/source 计数正确（同 key 累加、跨维度聚合）；
(e) usage_summary 聚合行新增 actors 字段（distinct 非空 actor 数；输出结构只增不改）。
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

from mate_kernel.action.edit_set import (
    EDIT_BATCH_LIMIT,
    EDIT_CHUNK_SIZE,
    EditSetError,
)
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "p1lim"
OBJ_EMP = f"ont.{T}.obj.org.employee.v1"
OBJ_DEPT = f"ont.{T}.obj.org.department.v1"
P_NAME = f"ont.{T}.prop.ename.v1"
P_STATUS = f"ont.{T}.prop.estatus.v1"
ACT = f"ont.{T}.act.org.bulk-edit.v1"
ALICE = f"ont.{T}.ind.employee.alice"


def _mk_repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ_EMP),
            primary_key=(ClassRef(P_NAME),),
            properties=(
                Property(
                    rid=ClassRef(P_NAME),
                    type_id="string",
                    nullable=False,
                    primary_key=True,
                    title="name",
                    format=PropertyFormat.STRING,
                ),
                Property(
                    rid=ClassRef(P_STATUS),
                    type_id="string",
                    nullable=True,
                    primary_key=False,
                    title="status",
                    format=PropertyFormat.STRING,
                ),
            ),
            display_name="employee",
        )
    )
    r.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ_DEPT),
            primary_key=(ClassRef(P_NAME),),
            properties=(
                Property(
                    rid=ClassRef(P_NAME),
                    type_id="string",
                    nullable=False,
                    primary_key=True,
                    title="name",
                    format=PropertyFormat.STRING,
                ),
            ),
            display_name="department",
        )
    )
    r.create_individual(
        Individual(
            rid=ALICE,
            class_rid=ClassRef(OBJ_EMP),
            props=((ClassRef(P_NAME), "alice"), (ClassRef(P_STATUS), "active")),
            primary_key="alice",
            tenant_id=T,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
    r.upsert_action_type(
        ActionType(
            rid=ClassRef(ACT),
            parameters=(
                Property(
                    rid=ClassRef(f"ont.{T}.prop.new-status.v1"),
                    type_id="string",
                    nullable=False,
                    primary_key=False,
                    title="newStatus",
                    format=PropertyFormat.STRING,
                ),
            ),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(f"ont.{T}.fn.org.bulk-edit.v1"),
            on=(ClassRef(OBJ_EMP),),
            title="Bulk Edit",
            declarative_edits=(
                {
                    "op": "set_property",
                    "target": "$target",
                    "property_rid": P_STATUS,
                    "value": "$param.new-status",
                },
            ),
        )
    )
    return r


def _create_dept_edit(i: int) -> dict:
    pk = f"d{i:05d}"
    return {"op": "create_object", "class_rid": OBJ_DEPT, "primary_key": pk, "props": {P_NAME: pk}}


# ─────────────────── P1-6：批量上限 10000 + 分片语义 ───────────────────


class TestP16BatchLimit:
    def test_constants(self) -> None:
        """P1-6 声明：上限对齐 Palantir（10000），内部按 1000/批分片。"""
        assert EDIT_BATCH_LIMIT == 10000
        assert EDIT_CHUNK_SIZE == 1000

    def test_over_1000_all_applied(self) -> None:
        # (a) 1500 条 create_object（跨两个分片边界）→ 全部落库
        r = _mk_repo()
        edits = [_create_dept_edit(i) for i in range(1500)]
        result = r.apply_edit_set_now(ACT, None, {}, edits, actor="hr-1")
        assert len(result.applied) == 1500
        assert len(result.created_rids) == 1500
        depts = r.list_individuals(ClassRef(OBJ_DEPT))
        assert len(depts) == 1500
        assert {d.primary_key for d in depts} == {f"d{i:05d}" for i in range(1500)}

    def test_10001_rejected(self) -> None:
        # (b) 超过声明上限 → 解析层 fail-fast（EditSetError ⊂ ValueError）
        r = _mk_repo()
        edits = [
            {"op": "set_property", "target": ALICE, "property_rid": P_STATUS, "value": "x"}
        ] * (EDIT_BATCH_LIMIT + 1)
        with pytest.raises((ValueError, EditSetError), match="batch limit"):
            r.apply_edit_set_now(ACT, None, {}, edits, actor="hr-1")
        # 未产生任何副作用
        assert r.get_individual(ALICE).get(ClassRef(P_STATUS)) == "active"

    def test_chunk_failure_rolls_back_whole_set(self) -> None:
        # (c) 第 1200 条（第 2 分片内）引用不存在 target → 整体补偿回滚
        r = _mk_repo()
        edits = [_create_dept_edit(i) for i in range(1199)]
        edits.append(
            {
                "op": "set_property",
                "target": f"ont.{T}.ind.employee.ghost",  # 不存在
                "property_rid": P_STATUS,
                "value": "x",
            }
        )
        edits.extend(_create_dept_edit(i) for i in range(1199, 1499))  # 失败后不再执行
        assert len(edits) == 1500
        with pytest.raises(EditSetError, match="not found"):
            r.apply_edit_set_now(ACT, None, {}, edits, actor="hr-1")
        # 前 1199 条 create_object 全部回滚，未执行到后面的 300 条
        assert r.list_individuals(ClassRef(OBJ_DEPT)) == []
        assert r.get_individual(ALICE).get(ClassRef(P_STATUS)) == "active"


# ─────────────────── P1-7：使用量 actor/source 维度 ───────────────────


class TestP17UsageDimensions:
    def test_record_usage_actor_dimensions(self) -> None:
        # (d) 不同 actor/source 各自计数；同 (op, actor, source) 累加；缺省维度兼容
        r = _mk_repo()
        r.record_usage(OBJ_EMP, "read", 1, actor="alice", source="api")
        r.record_usage(OBJ_EMP, "read", 2, actor="alice", source="api")  # 同 key → 3
        r.record_usage(OBJ_EMP, "read", 4, actor="bob", source="edit-set")
        r.record_usage(OBJ_EMP, "write", 5)  # 旧调用形态（无维度）→ '' 桶
        row = next(u for u in r.usage_summary(30) if u["class_rid"] == OBJ_EMP)
        assert row["reads"] == 7  # 1+2+4
        assert row["writes"] == 5
        assert row["actors"] == 2  # alice + bob（'' 不计入 actors）

    def test_usage_summary_actors_field(self) -> None:
        # (e) summary 结构只增不改：新增 actors；无 actor 打点 → 0
        r = _mk_repo()
        r.record_usage(OBJ_DEPT, "read", 3)
        row = next(u for u in r.usage_summary(30) if u["class_rid"] == OBJ_DEPT)
        assert set(row) >= {"class_rid", "reads", "writes", "active_days", "actors"}
        assert row["actors"] == 0
        r.record_usage(OBJ_DEPT, "write", 1, actor="carol", source="app-1")
        row = next(u for u in r.usage_summary(30) if u["class_rid"] == OBJ_DEPT)
        assert row["actors"] == 1
        assert row["writes"] == 1


# ─────────────────── P1-7：PG 真库同语义（可达时；验证幂等迁移 + 6 列唯一键）───────────────────

PG_DSN = os.environ.get("P1LIM_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont")


class TestP17UsagePg:
    @pytest.fixture()
    def pg_repo(self):
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()  # P1-7 幂等迁移：补列 + 唯一键 4→6 列
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_usage_metric WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_usage_actor_dimensions_pg(self, pg_repo) -> None:
        OBJ = f"ont.{T}.obj.crm.doc.v1"
        with pg_repo.tenant_scope(T):
            pg_repo.record_usage(OBJ, "read", 1, actor="alice", source="api")
            pg_repo.record_usage(OBJ, "read", 2, actor="alice", source="api")  # UPSERT 累加
            pg_repo.record_usage(OBJ, "read", 4, actor="bob", source="edit-set")
            pg_repo.record_usage(OBJ, "write", 5)  # 缺省维度 → '' 桶
            row = next(u for u in pg_repo.usage_summary(30) if u["class_rid"] == OBJ)
            assert row["reads"] == 7
            assert row["writes"] == 5
            assert int(row["actors"]) == 2  # alice + bob
