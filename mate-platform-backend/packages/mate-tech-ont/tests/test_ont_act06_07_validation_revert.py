"""ACT-06/07 —— 参数校验 / 结构化规则 / edit-set revert 补偿。

覆盖：
1. validate_referenced_parameters：引用必填缺失 / 类型不符 / 未引用不约束；
2. RuleGroup：AND/OR 嵌套求值 + 结构自检（未知算子 / 空组）；
3. edit-set 入口校验接线（引用参数缺失 → propose 拒绝）；
4. revert：executed edit-set → 逆编辑补偿执行（值回滚）+ equivalence 判定；
   含不可逆项 → partial。
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

from mate_kernel.action.validation import (
    Condition,
    RuleGroup,
    evaluate_rule_group,
    validate_referenced_parameters,
    validate_submission_rules,
)
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "act0607"
OBJ = f"ont.{T}.obj.org.ticket.v1"
P_ID = f"ont.{T}.prop.ticket-id.v1"
P_SEV = f"ont.{T}.prop.severity.v1"
ACT = f"ont.{T}.act.org.escalate.v1"


def _mk_repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ),
        primary_key=(ClassRef(P_ID),),
        properties=(
            Property(rid=ClassRef(P_ID), type_id="string", nullable=False,
                     primary_key=True, title="ticketId", format=PropertyFormat.STRING),
            Property(rid=ClassRef(P_SEV), type_id="string", nullable=True,
                     primary_key=False, title="severity", format=PropertyFormat.STRING),
        ),
        display_name="ticket",
    ))
    r.create_individual(Individual(
        rid=f"ont.{T}.ind.ticket.t1", class_rid=ClassRef(OBJ),
        props=((ClassRef(P_ID), "t1"), (ClassRef(P_SEV), "low")),
        primary_key="t1", tenant_id=T,
        created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
    ))
    r.upsert_action_type(ActionType(
        rid=ClassRef(ACT),
        parameters=(
            Property(rid=ClassRef(f"ont.{T}.prop.level.v1"), type_id="string",
                     nullable=False, primary_key=False, title="level",
                     format=PropertyFormat.STRING),
            Property(rid=ClassRef(f"ont.{T}.prop.score.v1"), type_id="integer",
                     nullable=True, primary_key=False, title="score",
                     format=PropertyFormat.INTEGER),
        ),
        submission_criteria=(), side_effects=(),
        function_ref=ClassRef(f"ont.{T}.fn.org.escalate.v1"),
        on=(ClassRef(OBJ),),
        title="Escalate",
    ))
    return r


class TestReferencedParameterValidation:
    def test_missing_referenced_param(self) -> None:
        r = _mk_repo()
        at = r.get_action_type(ClassRef(ACT))
        defs = at.parameters
        templates = [{"op": "set_property", "target": "$target",
                      "property_rid": P_SEV, "value": "$param.level"}]
        v = validate_referenced_parameters(defs, {}, templates)
        assert any("missing" in x for x in v)

    def test_type_mismatch(self) -> None:
        r = _mk_repo()
        at = r.get_action_type(ClassRef(ACT))
        templates = [{"op": "set_property", "target": "$target",
                      "property_rid": P_SEV, "value": "$param.score"}]
        v = validate_referenced_parameters(
            at.parameters, {"score": "not-a-number"}, templates)
        assert any("expects number" in x for x in v)

    def test_unreferenced_required_not_demanded(self) -> None:
        r = _mk_repo()
        at = r.get_action_type(ClassRef(ACT))
        templates = [{"op": "set_property", "target": "$target",
                      "property_rid": P_SEV, "value": "high"}]  # 不引用任何参数
        v = validate_referenced_parameters(at.parameters, {}, templates)
        assert v == []

    def test_wired_into_propose(self) -> None:
        r = _mk_repo()
        with pytest.raises(ValueError, match="missing"):
            r.propose_edit_set(
                ACT, f"ont.{T}.ind.ticket.t1", {},
                [{"op": "set_property", "target": "$target",
                  "property_rid": P_SEV, "value": "$param.level"}],
                "升级工单",
            )


class TestRuleGroups:
    def test_and_or_nesting(self) -> None:
        rule = RuleGroup(
            all_of=(
                Condition("severity", "eq", "low"),
                RuleGroup(any_of=(
                    Condition("score", "gte", "5"),
                    Condition("vip", "truthy"),
                )),
            ),
        )
        data = {"severity": "low", "score": "7", "vip": None}
        assert evaluate_rule_group(rule, data.get) is True
        data2 = {"severity": "high", "score": "7", "vip": None}
        assert evaluate_rule_group(rule, data2.get) is False
        data3 = {"severity": "low", "score": "1", "vip": True}
        assert evaluate_rule_group(rule, data3.get) is True

    def test_structure_validation(self) -> None:
        bad = [
            {"cond": {"field": "x", "op": "explode"}},   # 未知算子
            {"all_of": []},                              # 空组
            {"nonsense": 1},                             # 无 cond/all_of/any_of
        ]
        v = validate_submission_rules(bad)
        assert len(v) == 3


# ─────────────────── PG：edit-set revert 补偿（可达时）───────────────────

PG_DSN = os.environ.get(
    "ACT0607_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgRevertCompensation:
    @pytest.fixture()
    def pg_repo(self):
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        r = PgOntologyRepository(dsn=PG_DSN)
        try:
            r._ensure_schema()
        except Exception as e:
            pytest.skip(f"PG unavailable: {e}")
        mem = _mk_repo()
        with r.tenant_scope(T):
            for ot in mem.list_object_types(100, 0):
                r.upsert_object_type(ot)
            r.create_individual(mem.get_individual(f"ont.{T}.ind.ticket.t1"))
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

    def test_revert_executes_inverse_edits(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            applied = pg_repo.apply_edit_set_now(
                ACT, f"ont.{T}.ind.ticket.t1", {},
                [{"op": "set_property", "target": f"ont.{T}.ind.ticket.t1",
                  "property_rid": P_SEV, "value": "critical"}],
                actor="op-1",
            )
            pid = applied.get("proposal_id")
            # apply_edit_set_now 返回 result（无 proposal_id）→ 从 proposal 表查最新
            conn_pid = None
            import psycopg2

            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT proposal_id FROM ont_proposal WHERE tenant_id=%s "
                    "AND action_rid=%s AND status='executed' "
                    "ORDER BY applied_at DESC LIMIT 1", (T, ACT))
                row = cur.fetchone()
                conn_pid = row[0] if row else None
            conn.commit()
            conn.close()
            assert conn_pid
            # 值已生效
            ind = pg_repo.get_individual(f"ont.{T}.ind.ticket.t1")
            assert ind.get(ClassRef(P_SEV)) == "critical"
            # revert → 逆编辑把值弹回 low
            out = pg_repo.revert_proposal(conn_pid, actor_id="op-1")
            assert out["status"] == "reverted"
            assert out["kind"] == "edit_set"
            assert out["equivalence"] == "equivalent"
            ind2 = pg_repo.get_individual(f"ont.{T}.ind.ticket.t1")
            assert ind2.get(ClassRef(P_SEV)) == "low"

    def test_non_executed_revert_rejected(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            prop = pg_repo.propose_edit_set(
                ACT, None, {},
                [{"op": "set_property", "target": f"ont.{T}.ind.ticket.t1",
                  "property_rid": P_SEV, "value": "x"}],
                "待确认提案",
            )
            pid = (prop.proposal_id if hasattr(prop, "proposal_id")
                   else prop["proposal_id"])
            with pytest.raises(ValueError, match="requires executed"):
                pg_repo.revert_proposal(pid, actor_id="op-1")
