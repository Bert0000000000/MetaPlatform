"""ONT-GATE-01 — proposal 三闸门联动预检单测（schema × SHACL × Axiom）。

覆盖：ActionType 参数闸（必填/类型/未知参数）、create_instance 三闸
（schema 错误、SHACL Violation、Axiom 冲突→blocked；干净→通过）、
model_type 静态验证 + 层级环 dry-run、公理记录解析、报告结构。
Axiom 冲突用例依赖 reasoning.conflicts.detect_axiom_conflicts（G16 扩展）。
"""

from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.preflight import (
    PreflightReport,
    check_action_parameters,
    preflight_action,
    preflight_create_instance,
    preflight_model_type,
)
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

CID = "ont.t.prop.p-id.v1"
CNAME = "ont.t.prop.p-name.v1"
CAMT = "ont.t.prop.p-amt.v1"
ORDER = "ont.t.obj.order.v1"
BASE = "ont.t.obj.base.v1"
AID = "ont.t.prop.a-id.v1"


def _prop(rid: str, *, fmt=PropertyFormat.STRING, nullable=False, title=""):
    return Property(
        rid=ClassRef(rid),
        type_id=str(fmt),
        nullable=nullable,
        primary_key=False,
        title=title or rid.split(".")[-2],
        format=fmt,
    )


def _ot(parent: str | None = None, rid: str = ORDER) -> ObjectType:
    return ObjectType(
        rid=ClassRef(rid),
        display_name=rid.split(".")[-2],
        primary_key=(ClassRef(CID),),
        properties=(
            Property(
                rid=ClassRef(CID),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="id",
                format=PropertyFormat.STRING,
            ),
            _prop(CNAME),
            _prop(CAMT, fmt=PropertyFormat.INTEGER, nullable=True),
        ),
        parent_class=ClassRef(parent) if parent else None,
    )


def _action() -> ActionType:
    return ActionType(
        rid=ClassRef("ont.t.act.create-order.v1"),
        parameters=(
            Property(
                rid=ClassRef(AID),
                type_id="string",
                nullable=False,
                primary_key=False,
                title="order-id",
                format=PropertyFormat.STRING,
            ),
            _prop("ont.t.prop.a-qty.v1", fmt=PropertyFormat.INTEGER, nullable=False),
        ),
        submission_criteria=(),
        side_effects=(),
        function_ref=ClassRef("ont.t.fn.noop.v1"),
        on=(ClassRef(ORDER),),
    )


class TestActionParameterGate:
    def test_missing_required(self):
        r = check_action_parameters(_action(), {})
        assert r["errors"] and any("必填" in e for e in r["errors"])

    def test_wrong_type_string_gets_int(self):
        r = check_action_parameters(_action(), {"order-id": 123, "qty": 1})
        assert any("期望 string" in e for e in r["errors"])

    def test_bool_not_accepted_as_integer(self):
        r = check_action_parameters(_action(), {"order-id": "o1", "a-qty": True})
        assert any("bool" in e for e in r["errors"])

    def test_unknown_param_is_warning_only(self):
        r = check_action_parameters(_action(), {"order-id": "o1", "a-qty": 2, "extra": "x"})
        assert any("未声明参数" in w for w in r["warnings"])
        assert r["errors"] == []

    def test_slug_key_accepted(self):
        # rid 尾段去版本 = slug：AI 抽取常用
        r = check_action_parameters(_action(), {"order-id": "o1", "a-qty": 3})
        assert r["errors"] == []

    def test_preflight_action_blocked_and_pass(self):
        blocked = preflight_action(_action(), {})
        assert blocked.blocked is True
        assert "schema" in blocked.summary
        ok = preflight_action(_action(), {"order-id": "o1", "a-qty": 1})
        assert ok.blocked is False
        assert ok.shacl["checked"] is False


class TestCreateInstanceGate:
    def test_missing_pk_blocked_by_schema_and_shacl(self):
        r = preflight_create_instance(_ot(), {CNAME: "n"})
        assert r.blocked is True
        assert r.schema["errors"]
        assert r.shacl["checked"] and not r.shacl["conforms"]

    def test_wrong_value_type_blocked(self):
        r = preflight_create_instance(_ot(), {CID: "o1", CNAME: "n", CAMT: "not-an-int"})
        assert r.blocked is True
        assert r.schema["errors"]

    def test_clean_props_pass(self):
        r = preflight_create_instance(_ot(), {CID: "o1", CNAME: "n", CAMT: 5})
        assert r.blocked is False
        assert r.summary == "预检通过"
        assert r.shacl["conforms"] is True

    def test_slug_props_keys_accepted(self):
        # slug 键（name/amt）：SHACL path 归一到 rid 后仍应通过
        r = preflight_create_instance(_ot(), {"id": "o1", "p-name": "n", "p-amt": 5})
        assert r.blocked is False

    def test_disjoint_class_assertion_blocked(self):
        # Axiom dry-run：ORDER⊑MID⊑BASE 层级 + disjoint(ORDER, BASE)
        # → ORDER（及其实例）继承 BASE 又与 BASE 互斥 —— 类级闭包冲突
        axioms = [
            {"kind": "subclass", "operands": [ORDER, "ont.t.obj.mid.v1"], "enabled": True},
            {"kind": "subclass", "operands": ["ont.t.obj.mid.v1", BASE], "enabled": True},
            {"kind": "disjoint", "operands": [ORDER, BASE], "enabled": True},
        ]
        r = preflight_create_instance(
            _ot(), {CID: "o1", CNAME: "n"}, axiom_records=axioms, all_types=[]
        )
        assert any(a["rule"] == "disjoint" and a["severity"] == "violation" for a in r.axioms)
        assert r.blocked is True

    def test_to_dict_shape(self):
        d = preflight_create_instance(_ot(), {CID: "o1", CNAME: "n"}).to_dict()
        assert set(d) == {
            "blocked",
            "status",
            "unavailable",
            "schema",
            "shacl",
            "axioms",
            "summary",
        }
        assert d["status"] == "passed"
        assert d["unavailable"] == []


class TestModelTypeGate:
    def test_valid_model_passes(self):
        r = preflight_model_type(_ot())
        assert r.blocked is False
        assert r.schema["valid"] is True
        assert r.shacl["checked"] is False

    def test_hierarchy_cycle_blocked(self):
        # 提议 ORDER ⊑ BASE，而存量 BASE ⊑ ORDER —— 层级成环（dry-run）
        existing = [_ot(rid=BASE, parent=ORDER)]
        r = preflight_model_type(_ot(parent=BASE), existing_types=existing)
        assert any(a["rule"] == "subclass_cycle" for a in r.axioms)

    def test_axiom_records_parsed(self):
        records = [
            {"kind": "subclass", "operands": [ORDER, BASE], "enabled": True},
            {"kind": "same_as", "operands": [ORDER, BASE], "enabled": True},
            {"kind": "disjoint", "operands": [ORDER, BASE], "enabled": False},  # disabled
            {"kind": "weird", "operands": [ORDER], "enabled": True},  # 非二元
        ]
        from mate_kernel.ontology.preflight import _split_axiom_records

        got = _split_axiom_records(records)
        assert got["subclass"] == [(ORDER, BASE)]
        assert got["equivalent"] == [(ORDER, BASE)]
        assert got["disjoint"] == []


class TestReportHelper:
    def test_finish_blocks_on_each_gate(self):
        from mate_kernel.ontology.preflight import _finish

        assert _finish({"errors": ["x"]}, {"checked": False}, []).blocked
        assert _finish(
            {"errors": []},
            {"checked": True, "conforms": False, "violations": [{"c": 1}]},
            [],
        ).blocked
        assert _finish({"errors": []}, {"checked": False}, [{"severity": "violation"}]).blocked
        # warning 级不阻断
        r = _finish(
            {"errors": [], "warnings": ["w"]},
            {"checked": True, "conforms": True, "violations": []},
            [{"severity": "warning"}],
        )
        assert r.blocked is False
        assert "未达阻断级" in r.summary

    def test_report_is_frozen_serializable(self):
        rep = PreflightReport(blocked=False, summary="s")
        try:
            rep.blocked = True  # type: ignore[misc]
            raised = False
        except Exception:
            raised = True
        assert raised
