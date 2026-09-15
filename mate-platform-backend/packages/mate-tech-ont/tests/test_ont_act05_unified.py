"""ADR-0064 —— Action 统一为 EditSet：S1 模型层 + S2 统一执行器 + S3 入口分派。

S1：function_ref 可选（ClassRef | None）；「至少声明一个」约束；_row_to_at 去
noop 静默兜底；serde 补 declarative_edits 往返；DTO/契约可选化。

S2：统一执行器 —— function 返回值两规约（① {"edits":[...]} 纯对象直用，混入
其他字段 422；② 普通映射按 parameters 转 set_property，与旧 function_result
回写等价）+ 声明式 edits 合并同一事务；安全闸门（行/列策略 + G6 marking 合取
门 + G7 scoped session）逐 edit 校验；audit is_compat 标记。

S3：propose / propose-edit-set 按 ActionType 声明分派，走错端点不再 500
（FunctionNotRegistered → 422）。
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
from mate_kernel.ontology.serde.serde import (
    action_type_from_dict,
    action_type_to_dict,
)
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

T = "act05u"
OBJ = f"ont.{T}.obj.org.employee.v1"
P_NAME = f"ont.{T}.prop.ename.v1"
P_STATUS = f"ont.{T}.prop.estatus.v1"
P_LEVEL = f"ont.{T}.prop.elevel.v1"
ACT_PURE = f"ont.{T}.act.org.set-status-declarative.v1"
ACT_HYBRID = f"ont.{T}.act.org.promote-hybrid.v1"
ACT_FN_ONLY = f"ont.{T}.act.org.legacy-fn.v1"
FN = f"ont.{T}.fn.org.compute.v1"
P_NEW_STATUS = f"ont.{T}.prop.new-status.v1"  # 参数自身 rid（legacy 回写落点）

EDIT_TMPL = {
    "op": "set_property",
    "target": "$target",
    "property_rid": P_STATUS,
    "value": "$param.new-status",
}


def _param(name: str) -> Property:
    return Property(
        rid=ClassRef(f"ont.{T}.prop.{name}.v1"),
        type_id="string",
        nullable=False,
        primary_key=False,
        title=name,
        format=PropertyFormat.STRING,
    )


def _mk_repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ),
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
                Property(
                    rid=ClassRef(P_LEVEL),
                    type_id="string",
                    nullable=True,
                    primary_key=False,
                    title="level",
                    format=PropertyFormat.STRING,
                ),
            ),
            display_name="employee",
        )
    )
    r.create_individual(
        Individual(
            rid=f"ont.{T}.ind.employee.alice",
            class_rid=ClassRef(OBJ),
            props=(
                (ClassRef(P_NAME), "alice"),
                (ClassRef(P_STATUS), "active"),
                (ClassRef(P_LEVEL), "junior"),
            ),
            primary_key="alice",
            tenant_id=T,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
    return r


# ─────────────────── S1 · 模型层 ───────────────────


class TestS1Model:
    def test_function_ref_optional_declarative_only(self) -> None:
        at = ActionType(
            rid=ClassRef(ACT_PURE),
            parameters=(_param("new-status"),),
            submission_criteria=(),
            side_effects=(),
            function_ref=None,
            on=(ClassRef(OBJ),),
            declarative_edits=(dict(EDIT_TMPL),),
        )
        assert at.function_ref is None
        assert len(at.declarative_edits) == 1

    def test_both_sources_coexist(self) -> None:
        """D-2：不互斥 —— 声明式 edits + function_ref 并存合法。"""
        at = ActionType(
            rid=ClassRef(ACT_HYBRID),
            parameters=(_param("new-status"),),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(FN),
            on=(ClassRef(OBJ),),
            declarative_edits=(dict(EDIT_TMPL),),
        )
        assert at.function_ref is not None
        assert len(at.declarative_edits) == 1

    def test_neither_source_rejected(self) -> None:
        with pytest.raises(ValueError, match="at least one"):
            ActionType(
                rid=ClassRef(ACT_PURE),
                parameters=(_param("new-status"),),
                submission_criteria=(),
                side_effects=(),
                function_ref=None,
                on=(ClassRef(OBJ),),
                declarative_edits=(),
            )

    def test_serde_roundtrip_declarative(self) -> None:
        """serde 往返不得丢 declarative_edits（S1 核查结论：当前完全不含）。"""
        at = ActionType(
            rid=ClassRef(ACT_PURE),
            parameters=(_param("new-status"),),
            submission_criteria=(),
            side_effects=(),
            function_ref=None,
            on=(ClassRef(OBJ),),
            declarative_edits=(dict(EDIT_TMPL),),
        )
        d = action_type_to_dict(at)
        assert d["declarative_edits"] == [EDIT_TMPL]
        assert d["function_ref"] is None
        assert action_type_from_dict(d) == at

    def test_serde_roundtrip_function_style(self) -> None:
        """既有 function 式往返不受影响。"""
        at = ActionType(
            rid=ClassRef(ACT_FN_ONLY),
            parameters=(_param("new-status"),),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(FN),
            on=(ClassRef(OBJ),),
        )
        assert action_type_from_dict(action_type_to_dict(at)) == at

    def test_inmemory_upsert_get_pure_declarative(self) -> None:
        r = _mk_repo()
        at = ActionType(
            rid=ClassRef(ACT_PURE),
            parameters=(_param("new-status"),),
            submission_criteria=(),
            side_effects=(),
            function_ref=None,
            on=(ClassRef(OBJ),),
            declarative_edits=(dict(EDIT_TMPL),),
        )
        r.upsert_action_type(at)
        got = r.get_action_type(ClassRef(ACT_PURE))
        assert got.function_ref is None
        assert got.declarative_edits == (EDIT_TMPL,)


class TestS1Dto:
    """api 层 DTO 转换：function_ref 空串 ⇄ None（契约可选化）。"""

    def test_dto_roundtrip_optional_function_ref(self) -> None:
        from mate_tech_ont.v2_kernel.api import (
            _action_type_to_dto,
            _dto_to_action_type,
            ActionTypeDTO,
        )

        dto = ActionTypeDTO(
            rid=ACT_PURE,
            parameters=[],
            submission_criteria=[],
            side_effects=[],
            function_ref="",
            on=[OBJ],
            declarative_edits=[dict(EDIT_TMPL)],
        )
        at = _dto_to_action_type(dto)
        assert at.function_ref is None
        assert at.declarative_edits == (EDIT_TMPL,)
        back = _action_type_to_dto(at)
        assert back.function_ref == ""
        assert back.declarative_edits == [EDIT_TMPL]


# ─────────────────── PG 真库（可达时）───────────────────

PG_DSN = os.environ.get("ACT05U_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont")


class TestS1Pg:
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
            r.create_individual(mem.get_individual(f"ont.{T}.ind.employee.alice"))
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            for tbl in (
                "ont_individual",
                "ont_object_type",
                "ont_action_type",
                "ont_proposal",
                "ont_proposal_event",
                "ont_proposal_execution",
                "ont_proposal_idempotency",
                "ont_action_audit",
                "ont_outbox_event",
            ):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_row_to_at_no_noop_fallback(self, pg_repo) -> None:
        """空 function_ref 行 → 读回 None（不再静默造 ont.system.fn.noop.v1）。"""
        with pg_repo.tenant_scope(T):
            at = ActionType(
                rid=ClassRef(ACT_PURE),
                parameters=(_param("new-status"),),
                submission_criteria=(),
                side_effects=(),
                function_ref=None,
                on=(ClassRef(OBJ),),
                declarative_edits=(dict(EDIT_TMPL),),
            )
            pg_repo.upsert_action_type(at)
            got = pg_repo.get_action_type(ClassRef(ACT_PURE))
            assert got.function_ref is None
            assert got.declarative_edits == (EDIT_TMPL,)

    def test_row_to_at_neither_rejected(self, pg_repo) -> None:
        """空 function_ref + 空 declarative_edits 的行 → 读回 fail-fast。"""
        import psycopg2

        with pg_repo.tenant_scope(T):
            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO ont_action_type
                       (rid, tenant_id, parameters, submission_criteria, side_effects,
                        function_ref, target_object_types, declarative_edits, updated_at)
                       VALUES (%s, %s, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '', %s,
                               '[]'::jsonb, now())
                       ON CONFLICT (rid) DO UPDATE SET function_ref='', declarative_edits='[]'::jsonb""",
                    (ACT_FN_ONLY, T, [OBJ]),
                )
            conn.commit()
            conn.close()
            with pytest.raises(ValueError, match="at least one"):
                pg_repo.get_action_type(ClassRef(ACT_FN_ONLY))


# ─────────────────── S2 · 统一执行器 + 完整安全闸门 ───────────────────

ALICE = f"ont.{T}.ind.employee.alice"


def _hybrid_action_type() -> ActionType:
    """混合式：声明式改 status + function 算 elevel（参数 rid = 对象属性 rid）。"""
    return ActionType(
        rid=ClassRef(ACT_HYBRID),
        parameters=(_param("new-status"), _elevel_param()),
        submission_criteria=(),
        side_effects=(),
        function_ref=ClassRef(FN),
        on=(ClassRef(OBJ),),
        declarative_edits=(dict(EDIT_TMPL),),
    )


def _elevel_param() -> Property:
    """参数声明直接落在对象属性 P_LEVEL 上（与 legacy 回写映射目标一致）。"""
    return Property(
        rid=ClassRef(P_LEVEL),
        type_id="string",
        nullable=True,
        primary_key=False,
        title="elevel",
        format=PropertyFormat.STRING,
    )


def _register_fn(r: object, result: object) -> None:
    r._action_service.register_function(FN, lambda target_iid, parameters: result)


class TestS2UnifiedInMemory:
    def test_spec1_function_returns_edits(self) -> None:
        """规约①：function 返回 {"edits":[...]} → 直用 EditSet（与声明式合并单事务）。"""
        r = _mk_repo()
        at = _hybrid_action_type()
        r.upsert_action_type(at)
        _register_fn(
            r,
            {
                "edits": [
                    {
                        "op": "set_property",
                        "target": ALICE,
                        "property_rid": P_LEVEL,
                        "value": "staff",
                    }
                ]
            },
        )
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "混合")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        result = r.execute_proposal(pid)
        applied = result.applied if hasattr(result, "applied") else result["applied"]
        assert len(applied) == 2  # 声明式 status + fn edits level
        ind = r.get_individual(ALICE)
        assert ind.get(ClassRef(P_STATUS)) == "away"
        assert ind.get(ClassRef(P_LEVEL)) == "staff"

    def test_spec1_mixed_fields_rejected(self) -> None:
        """规约①禁止混用：{"edits":[...], "extra": ...} → ValueError（API 422）。"""
        r = _mk_repo()
        r.upsert_action_type(_hybrid_action_type())
        _register_fn(
            r,
            {
                "edits": [
                    {
                        "op": "set_property",
                        "target": ALICE,
                        "property_rid": P_LEVEL,
                        "value": "staff",
                    }
                ],
                "bonus": "leak",
            },
        )
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "混合")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        with pytest.raises(ValueError, match="mix"):
            r.execute_proposal(pid)
        # 未落库
        ind = r.get_individual(ALICE)
        assert ind.get(ClassRef(P_STATUS)) == "active"

    def test_spec2_mapping_equivalent_to_legacy(self) -> None:
        """规约②：普通映射 → set_property；结果与旧 function_result 回写一致。"""
        r = _mk_repo()
        at = _hybrid_action_type()
        r.upsert_action_type(at)
        _register_fn(r, {"elevel": "principal"})  # 短名 elevel → P_LEVEL（与 legacy 回写映射同规则）
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "leave"}, [], "规约②")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        result = r.execute_proposal(pid)
        ind = r.get_individual(ALICE)
        # 声明式 status + 规约② level 都生效
        assert ind.get(ClassRef(P_STATUS)) == "leave"
        assert ind.get(ClassRef(P_LEVEL)) == "principal"
        # is_compat 标记：走了规约②兼容转换（EditSetResult.meta）
        assert result.meta["is_compat"] is True
        assert result.meta["fn_spec"] == "mapping"

    def test_legacy_action_path_regression(self) -> None:
        """D-5：legacy function_result 回写路径保留、行为不变（标记断言见 PG 侧）。"""
        r = _mk_repo()
        at = ActionType(
            rid=ClassRef(ACT_FN_ONLY),
            parameters=(_param("new-status"),),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(FN),
            on=(ClassRef(OBJ),),
        )
        r.upsert_action_type(at)
        _register_fn(r, {"new-status": "fnaway"})
        r.propose_action(ClassRef(ACT_FN_ONLY), {"new-status": "fnaway"}, ALICE, "legacy")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        # InMemory action-kind 走 apply_action 协议路径（proposal_id 透传）
        applied_at, effects = r.apply_action(
            ClassRef(ACT_FN_ONLY), ALICE, {"new-status": "fnaway"}, {"proposal_id": pid}
        )
        assert applied_at is not None
        ind = r.get_individual(ALICE)
        assert ind.get(ClassRef(P_NEW_STATUS)) == "fnaway"  # legacy 回写：参数 rid 即落点
        assert isinstance(effects, list)


class TestS2SecurityGateInMemory:
    """安全闸门：行/列策略 + G6 marking 合取门 + scoped 收窄，逐 edit 校验。"""

    def _gated_repo(self):
        r = _mk_repo()
        r.upsert_action_type(_hybrid_action_type())
        _register_fn(r, {"elevel": "principal"})
        return r

    def test_row_policy_denies_write(self) -> None:
        r = self._gated_repo()
        r.upsert_security_policy(
            {"kind": "row", "class_rid": OBJ, "field": "estatus", "op": "ne", "value": "locked"}
        )
        # 把 alice 置为策略不可见态
        from dataclasses import replace as _repl

        ind = r.get_individual(ALICE)
        r._individuals[ALICE] = _repl(
            ind,
            props=tuple(
                (k, "locked") if k.rid == P_STATUS else (k, v) for k, v in ind.props
            ),
        )
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "gate")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        with pytest.raises(ValueError, match="row policy"):
            r.execute_proposal(pid, viewer_markings=("everyone",))
        ind2 = r.get_individual(ALICE)
        assert ind2.get(ClassRef(P_STATUS)) == "locked"  # 未写

    def test_column_policy_denies_write(self) -> None:
        r = self._gated_repo()
        r.upsert_security_policy(
            {"kind": "column", "property_rid": P_LEVEL, "required_markings": ["hr-privileged"]}
        )
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "gate")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        # viewer 无 hr-privileged → set level（fn 规约②）被拒
        with pytest.raises(ValueError, match="column policy"):
            r.execute_proposal(pid, viewer_markings=("everyone",))
        # 持有标记 → 放行
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "gate2")
        pid2 = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid2, confirmed_by="boss")
        r.execute_proposal(pid2, viewer_markings=("hr-privileged",))
        ind = r.get_individual(ALICE)
        assert ind.get(ClassRef(P_STATUS)) == "away"

    def test_marking_gate_denies_write(self) -> None:
        """G6 合取门：实例/类型 marking ⊄ viewer → 拒写。"""
        from dataclasses import replace as _repl

        r = self._gated_repo()
        ind = r.get_individual(ALICE)
        r._individuals[ALICE] = _repl(ind, marking=("confidential",))
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "gate")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        with pytest.raises(ValueError, match="marking"):
            r.execute_proposal(pid, viewer_markings=("public",))
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "gate2")
        pid2 = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid2, confirmed_by="boss")
        r.execute_proposal(pid2, viewer_markings=("public", "confidential"))
        assert r.get_individual(ALICE).get(ClassRef(P_STATUS)) == "away"

    def test_scoped_narrowing_denies_out_of_scope_write(self) -> None:
        """G7 scoped session：会话收窄后（viewer 不含所需 marking）→ 越界写被拒。"""
        from dataclasses import replace as _repl

        r = self._gated_repo()
        ind = r.get_individual(ALICE)
        r._individuals[ALICE] = _repl(ind, marking=("confidential",))
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "away"}, [], "gate")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        # 用户本持 confidential，但会话收窄到 public → 拒
        with pytest.raises(ValueError, match="marking"):
            r.execute_proposal(pid, viewer_markings=("public",))

    def test_no_config_zero_change(self) -> None:
        """无策略/无 marking 配置：带空 viewer 执行与不传 viewer 结果一致。"""
        r = self._gated_repo()
        r.propose_edit_set(ACT_HYBRID, ALICE, {"new-status": "nominal"}, [], "zero")
        pid = list(r._action_service._proposals)[-1]
        r.confirm_proposal(pid, confirmed_by="boss")
        r.execute_proposal(pid, viewer_markings=())
        ind = r.get_individual(ALICE)
        assert ind.get(ClassRef(P_STATUS)) == "nominal"
        assert ind.get(ClassRef(P_LEVEL)) == "principal"


class TestS2PgUnified:
    """PG 真库：统一执行器 + 闸门 + is_compat（可达时）。"""

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
            r.create_individual(mem.get_individual(ALICE))
            r.upsert_action_type(_hybrid_action_type())
        yield r
        import psycopg2

        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            for tbl in (
                "ont_individual",
                "ont_object_type",
                "ont_action_type",
                "ont_proposal",
                "ont_proposal_event",
                "ont_proposal_execution",
                "ont_proposal_idempotency",
                "ont_action_audit",
                "ont_outbox_event",
                "ont_security_policy",
                "ont_edit_overlay",
            ):
                cur.execute(f"DELETE FROM {tbl} WHERE tenant_id=%s", (T,))
        conn.commit()
        conn.close()

    def test_pg_hybrid_single_txn_both_applied(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            pg_repo._action_service.register_function(
                FN, lambda target_iid, parameters: {"elevel": "principal"}
            )
            prop = pg_repo.propose_edit_set(
                ACT_HYBRID, ALICE, {"new-status": "pg-away"}, [], "PG 混合式"
            )
            pid = prop.proposal_id if hasattr(prop, "proposal_id") else prop["proposal_id"]
            pg_repo.confirm_proposal(pid, confirmed_by="boss")
            result = pg_repo.execute_proposal(pid)
            assert result["kind"] == "edit_set"
            assert result["applied_count"] == 2
            assert result["is_compat"] is True  # 规约②转换
            ind = pg_repo.get_individual(ALICE)
            assert ind.get(ClassRef(P_STATUS)) == "pg-away"
            assert ind.get(ClassRef(P_LEVEL)) == "principal"

    def test_pg_column_policy_denies(self, pg_repo) -> None:
        with pg_repo.tenant_scope(T):
            pg_repo.upsert_security_policy(
                {
                    "kind": "column",
                    "property_rid": P_LEVEL,
                    "markings": ["hr-privileged"],
                    "tenant_id": T,
                }
            )
            pg_repo._action_service.register_function(
                FN, lambda target_iid, parameters: {"elevel": "principal"}
            )
            prop = pg_repo.propose_edit_set(
                ACT_HYBRID, ALICE, {"new-status": "x"}, [], "gate"
            )
            pid = prop.proposal_id if hasattr(prop, "proposal_id") else prop["proposal_id"]
            pg_repo.confirm_proposal(pid, confirmed_by="boss")
            with pytest.raises(ValueError, match="column policy"):
                pg_repo.execute_proposal(pid, viewer_markings=("everyone",))
            ind = pg_repo.get_individual(ALICE)
            assert ind.get(ClassRef(P_STATUS)) == "active"  # 事务未落

    def test_pg_legacy_path_is_compat_marker(self, pg_repo) -> None:
        """D-5：legacy function_result 回写（kind=action）audit 打 is_compat=True。"""
        with pg_repo.tenant_scope(T):
            at = ActionType(
                rid=ClassRef(ACT_FN_ONLY),
                parameters=(_param("new-status"),),
                submission_criteria=(),
                side_effects=(),
                function_ref=ClassRef(FN),
                on=(ClassRef(OBJ),),
            )
            pg_repo.upsert_action_type(at)
            pg_repo._action_service.register_function(
                FN, lambda target_iid, parameters: {"new-status": "pg-legacy"}
            )
            prop = pg_repo.propose_action(
                ClassRef(ACT_FN_ONLY), {"new-status": "pg-legacy"}, ALICE, "legacy"
            )
            pid = prop.proposal_id if hasattr(prop, "proposal_id") else prop["proposal_id"]
            pg_repo.confirm_proposal(pid, confirmed_by="boss")
            result = pg_repo.execute_proposal(pid, idempotency_key=f"leg-{pid}")
            assert result["kind"] == "action"
            assert result["is_compat"] is True
            ind = pg_repo.get_individual(ALICE)
            assert ind.get(ClassRef(P_NEW_STATUS)) == "pg-legacy"  # legacy 回写：参数 rid 即落点
