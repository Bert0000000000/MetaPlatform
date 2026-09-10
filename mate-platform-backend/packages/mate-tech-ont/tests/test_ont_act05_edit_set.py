"""ACT-05 —— 声明式 edit-set：模板解析 / 单事务执行 / 回滚 / 逆编辑 / 双路径。

覆盖：
1. 模板占位符：$target / $param.<name> / $now / 未知参数 fail-fast；
2. AI 路径：propose_edit_set → confirm → execute（pending 前不可执行）；
3. D7 人工路径：apply_edit_set_now（即时 proposal + 审计）；
4. 原子性：中途失败 → 整体回滚（InMemory 补偿式 + PG 事务回滚）；
5. 逆编辑：set_property 旧值 / create→delete / add→remove；
6. 批量上限 1000。
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
    EditOp,
    EditSetError,
    invert_edits,
    resolve_edit_template,
)
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.link_type import (
    Cardinality,
    Directionality,
    LinkType,
)
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "act05"
OBJ_EMP = f"ont.{T}.obj.org.employee.v1"
OBJ_DEPT = f"ont.{T}.obj.org.department.v1"
LINK = f"ont.{T}.link.org.dept-employees.v1"
P_NAME = f"ont.{T}.prop.ename.v1"
P_STATUS = f"ont.{T}.prop.estatus.v1"
ACT = f"ont.{T}.act.org.transfer-employee.v1"


def _mk_repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ_EMP),
        primary_key=(ClassRef(P_NAME),),
        properties=(
            Property(rid=ClassRef(P_NAME), type_id="string", nullable=False,
                     primary_key=True, title="name", format=PropertyFormat.STRING),
            Property(rid=ClassRef(P_STATUS), type_id="string", nullable=True,
                     primary_key=False, title="status", format=PropertyFormat.STRING),
        ),
        display_name="employee",
    ))
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ_DEPT),
        primary_key=(ClassRef(P_NAME),),
        properties=(Property(rid=ClassRef(P_NAME), type_id="string", nullable=False,
                             primary_key=True, title="name",
                             format=PropertyFormat.STRING),),
        display_name="department",
    ))
    r.upsert_link_type(LinkType(
        rid=ClassRef(LINK), src=ClassRef(OBJ_DEPT), dst=ClassRef(OBJ_EMP),
        cardinality=Cardinality.ONE_TO_MANY, directionality=Directionality.DIRECTED,
    ))
    r.create_individual(Individual(
        rid=f"ont.{T}.ind.employee.alice", class_rid=ClassRef(OBJ_EMP),
        props=((ClassRef(P_NAME), "alice"), (ClassRef(P_STATUS), "active")),
        primary_key="alice", tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    ))
    r.upsert_action_type(ActionType(
        rid=ClassRef(ACT),
        parameters=(
            Property(rid=ClassRef(f"ont.{T}.prop.new-status.v1"), type_id="string",
                     nullable=False, primary_key=False, title="newStatus",
                     format=PropertyFormat.STRING),
        ),
        submission_criteria=(), side_effects=(),
        function_ref=ClassRef(f"ont.{T}.fn.org.transfer.v1"),
        on=(ClassRef(OBJ_EMP),),
        title="Transfer Employee",
        declarative_edits=(
            {"op": "set_property", "target": "$target",
             "property_rid": P_STATUS, "value": "$param.new-status"},
        ),
    ))
    return r


class TestTemplates:
    def test_placeholders(self) -> None:
        e = resolve_edit_template(
            {"op": "set_property", "target": "$target",
             "property_rid": "p", "value": "$param.amount"},
            target_iid="ind-1", parameters={"amount": 42}, now_iso="2026-09-10T00:00:00Z")
        assert e.target == "ind-1"
        assert e.value == 42

    def test_unknown_param_rejected(self) -> None:
        with pytest.raises(EditSetError, match="not provided"):
            resolve_edit_template(
                {"op": "set_property", "target": "$target",
                 "property_rid": "p", "value": "$param.nothere"},
                target_iid="ind-1", parameters={})

    def test_bad_op_rejected(self) -> None:
        with pytest.raises(EditSetError, match="unknown edit op"):
            EditOp(op="explode", target="x")


class TestInMemoryExecution:
    def test_ai_path_propose_confirm_execute(self) -> None:
        r = _mk_repo()
        at = r.get_action_type(ClassRef(ACT))
        prop = r.propose_edit_set(
            ACT, f"ont.{T}.ind.employee.alice", {"new-status": "transferred"},
            list(at.declarative_edits), "把 alice 调岗")
        # pending 不可执行
        from mate_kernel.action.engine import ProposalNotConfirmed

        with pytest.raises(ProposalNotConfirmed):
            r.execute_proposal(prop.proposal_id)
        r.confirm_proposal(prop.proposal_id, confirmed_by="boss")
        result = r.execute_proposal(prop.proposal_id)
        assert len(result.applied) == 1
        ind = r.get_individual(f"ont.{T}.ind.employee.alice")
        assert ind.get(ClassRef(P_STATUS)) == "transferred"
        # 逆编辑：set_property 回旧值
        assert result.inverse[0].value == "active"

    def test_human_path_apply_now(self) -> None:
        r = _mk_repo()
        r.apply_edit_set_now(
            ACT, f"ont.{T}.ind.employee.alice", {"s": "on-leave"},
            [{"op": "set_property", "target": "$target",
              "property_rid": P_STATUS, "value": "$param.s"}],
            actor="hr-1",
        )
        ind = r.get_individual(f"ont.{T}.ind.employee.alice")
        assert ind.get(ClassRef(P_STATUS)) == "on-leave"

    def test_atomic_rollback_on_failure(self) -> None:
        r = _mk_repo()
        edits = [
            {"op": "set_property", "target": f"ont.{T}.ind.employee.alice",
             "property_rid": P_STATUS, "value": "will-rollback"},
            {"op": "set_property", "target": "ont.act05.ind.employee.ghost",
             "property_rid": P_STATUS, "value": "x"},  # 不存在 → 失败
        ]
        with pytest.raises(Exception, match="not found"):
            r.apply_edit_set_now(
                ACT, None, {}, edits, actor="hr-1",
            )
        # 第一条也被回滚
        ind = r.get_individual(f"ont.{T}.ind.employee.alice")
        assert ind.get(ClassRef(P_STATUS)) == "active"

    def test_create_object_and_add_link(self) -> None:
        r = _mk_repo()
        edits = [
            {"op": "create_object", "class_rid": OBJ_DEPT,
             "primary_key": "rnd", "props": {P_NAME: "rnd"}},
            {"op": "add_link", "link_type_rid": LINK,
             "src": f"ont.{T}.ind.department.rnd",
             "dst": f"ont.{T}.ind.employee.alice"},
        ]
        result = r.apply_edit_set_now(ACT, None, {}, edits, actor="hr-1")
        assert result.created_rids == (f"ont.{T}.ind.department.rnd",)
        around = r.search_around(f"ont.{T}.ind.employee.alice")
        assert around and around[0]["direction"] == "in"
        assert around[0]["peers"][0]["ename"] == "rnd"

    def test_batch_limit(self) -> None:
        r = _mk_repo()
        edits = [
            {"op": "set_property", "target": f"ont.{T}.ind.employee.alice",
             "property_rid": P_STATUS, "value": "x"},
        ] * (EDIT_BATCH_LIMIT + 1)
        from mate_kernel.action.edit_set import resolve_edit_templates

        with pytest.raises(EditSetError, match="batch limit"):
            resolve_edit_templates(edits, target_iid=None, parameters={})


class TestInvert:
    def test_invert_mixed(self) -> None:
        applied = [
            EditOp(op="set_property", target="i1", property_rid="p1", value="new"),
            EditOp(op="create_object", class_rid="c", primary_key="k"),
            EditOp(op="add_link", link_type_rid="lt", src="a", dst="b",
                   link_instance_rid="li-1"),
        ]
        inv, non_inv = invert_edits(
            applied, old_values={"i1#p1": "old"},
            created_rids=["ont.t.ind.c.k"], removed_links=[],
        )
        assert not non_inv
        ops = [e.op for e in inv]
        # 逆序：remove_link → delete_object → set_property(旧值)
        assert ops == ["remove_link", "delete_object", "set_property"]
        assert inv[2].value == "old"

    def test_delete_object_non_invertible(self) -> None:
        applied = [EditOp(op="delete_object", target="i1")]
        inv, non_inv = invert_edits(applied, old_values={}, created_rids=[], removed_links=[])
        assert not inv
        assert len(non_inv) == 1


# ─────────────────── PG 真库同语义（可达时）───────────────────

PG_DSN = os.environ.get(
    "ACT05_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgSameSemantics:
    @pytest.fixture()
    def pg_repo(self):
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        # 复用 InMemory 建模助手灌 PG
        mem = _mk_repo()
        with r.tenant_scope(T):
            for ot in mem.list_object_types(100, 0):
                r.upsert_object_type(ot)
            r.upsert_link_type(mem.get_link_type(ClassRef(LINK)))
            r.create_individual(mem.get_individual(f"ont.{T}.ind.employee.alice"))
            r.upsert_action_type(mem.get_action_type(ClassRef(ACT)))
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            for tbl in ("ont_individual", "ont_link_instance", "ont_object_type",
                        "ont_link_type", "ont_action_type", "ont_proposal",
                        "ont_proposal_event", "ont_proposal_execution",
                        "ont_proposal_idempotency", "ont_action_audit",
                        "ont_outbox_event", "ont_axiom"):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_pg_human_path_and_rollback(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            # 人工路径：set_property 成功
            result = pg_repo.apply_edit_set_now(
                ACT, f"ont.{T}.ind.employee.alice", {"new-status": "pg-transferred"},
                [{"op": "set_property", "target": "$target",
                  "property_rid": P_STATUS, "value": "$param.new-status"}],
                actor="hr-pg",
            )
            assert result["kind"] == "edit_set"
            assert result["applied_count"] == 1
            assert result["inverse"][0]["value"] == "active"
            ind = pg_repo.get_individual(f"ont.{T}.ind.employee.alice")
            assert ind.get(ClassRef(P_STATUS)) == "pg-transferred"
            # 审计行存在
            import psycopg2

            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM ont_action_audit WHERE tenant_id=%s "
                    "AND action_rid=%s", (T, ACT))
                assert cur.fetchone()[0] >= 1
            conn.commit()
            conn.close()
            # 失败回滚：坏 target → 事务整体回滚
            with pytest.raises(Exception, match="not found"):
                pg_repo.apply_edit_set_now(
                    ACT, None, {},
                    [
                        {"op": "set_property", "target": f"ont.{T}.ind.employee.alice",
                         "property_rid": P_STATUS, "value": "rollback-me"},
                        {"op": "set_property", "target": "ont.act05.ind.employee.ghost",
                         "property_rid": P_STATUS, "value": "x"},
                    ],
                    actor="hr-pg",
                )
            ind2 = pg_repo.get_individual(f"ont.{T}.ind.employee.alice")
            assert ind2.get(ClassRef(P_STATUS)) == "pg-transferred"

    def test_pg_ai_path_propose_confirm_execute(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            prop = pg_repo.propose_edit_set(
                ACT, f"ont.{T}.ind.employee.alice", {"new-status": "pg-promoted"},
                [{"op": "set_property", "target": "$target",
                  "property_rid": P_STATUS, "value": "$param.new-status"}],
                "AI 提案：晋升",
            )
            pid = prop.proposal_id if hasattr(prop, "proposal_id") else prop["proposal_id"]
            from mate_kernel.action.engine import ProposalNotConfirmed

            with pytest.raises(ProposalNotConfirmed):
                pg_repo.execute_proposal(pid)
            pg_repo.confirm_proposal(pid, confirmed_by="boss")
            result = pg_repo.execute_proposal(pid)
            assert result["kind"] == "edit_set"
            ind = pg_repo.get_individual(f"ont.{T}.ind.employee.alice")
            assert ind.get(ClassRef(P_STATUS)) == "pg-promoted"
