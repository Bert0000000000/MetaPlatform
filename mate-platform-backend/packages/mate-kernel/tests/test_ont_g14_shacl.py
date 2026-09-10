"""ONT-G14 — SHACL Core 关键约束单测（正反例）。

覆盖 minCount / maxCount / datatype / pattern / class / closed 六个约束
组件 + 报告结构 + 多违例聚合。W3C 语义要点：pattern 仅作用于字符串值、
closed 不允许未声明属性、conforms = violations 为空。
"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.shacl import (  # noqa: E402
    NodeShape,
    PropertyShape,
    validate_shacl,
)

PERSON = "ont.t.ac.obj.person.v1"
EMP = "ont.t.ac.obj.employee.v1"
PROP = "ont.t.ac.prop.name.v1"
PROP_AGE = "ont.t.ac.prop.age.v1"
PROP_MGR = "ont.t.ac.prop.manager.v1"


def _ind(rid: str, cls: str, props: dict) -> dict:
    return {"rid": rid, "class_rid": cls, "props": props}


def _run(individuals, shapes):
    return validate_shacl(individuals, shapes)


def _shape(**kw) -> NodeShape:
    return NodeShape(target_class=EMP, property_shapes=(
        PropertyShape(path=PROP, **kw),
    ))


class TestCardinality:
    def test_min_count_pass(self):
        r = _run([_ind("i1", EMP, {PROP: "bob"})], [_shape(min_count=1)])
        assert r["conforms"] and r["violations"] == []

    def test_min_count_violation_on_missing(self):
        r = _run([_ind("i1", EMP, {})], [_shape(min_count=1)])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "minCount"

    def test_max_count_violation(self):
        r = _run([_ind("i1", EMP, {PROP: ["a", "b"]})], [_shape(max_count=1)])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "maxCount"

    def test_max_count_pass_on_single(self):
        r = _run([_ind("i1", EMP, {PROP: "a"})], [_shape(max_count=1)])
        assert r["conforms"]


class TestDatatypeAndPattern:
    def test_datatype_pass(self):
        r = _run([_ind("i1", EMP, {PROP_AGE: 30})],
                 [NodeShape(EMP, (PropertyShape(path=PROP_AGE, datatype="integer"),))])
        assert r["conforms"]

    def test_datatype_violation(self):
        r = _run([_ind("i1", EMP, {PROP_AGE: "thirty"})],
                 [NodeShape(EMP, (PropertyShape(path=PROP_AGE, datatype="integer"),))])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "datatype"

    def test_pattern_pass(self):
        r = _run([_ind("i1", EMP, {PROP: "EMP-001"})], [_shape(pattern=r"^EMP-\d+$")])
        assert r["conforms"]

    def test_pattern_violation(self):
        r = _run([_ind("i1", EMP, {PROP: "bad-id"})], [_shape(pattern=r"^EMP-\d+$")])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "pattern"

    def test_pattern_skips_non_string_w3c_semantics(self):
        """W3C：pattern 仅作用于字符串字面量；非字符串值不适用（无违例）。"""
        r = _run([_ind("i1", EMP, {PROP: 42})], [_shape(pattern=r"^EMP-\d+$")])
        assert r["conforms"]


class TestClassConstraint:
    def test_class_pass_when_value_is_instance_of_class(self):
        mgr = _ind("m1", EMP, {PROP_MGR: "e1"})
        emp = _ind("e1", EMP, {PROP: "bob"})
        r = _run([mgr, emp], [NodeShape(EMP, (
            PropertyShape(path=PROP_MGR, node_class=EMP),))])
        assert r["conforms"]

    def test_class_violation_on_wrong_class(self):
        mgr = _ind("m1", EMP, {PROP_MGR: "p1"})
        person = _ind("p1", PERSON, {PROP: "alice"})
        r = _run([mgr, person], [NodeShape(EMP, (
            PropertyShape(path=PROP_MGR, node_class=EMP),))])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "class"

    def test_class_violation_on_unresolvable_value(self):
        r = _run([_ind("m1", EMP, {PROP_MGR: "ghost"})],
                 [NodeShape(EMP, (PropertyShape(path=PROP_MGR, node_class=EMP),))])
        assert not r["conforms"]


class TestClosed:
    def test_closed_pass_with_declared_only(self):
        r = _run([_ind("i1", EMP, {PROP: "bob"})],
                 [NodeShape(EMP, (PropertyShape(path=PROP),), closed=True)])
        assert r["conforms"]

    def test_closed_violation_on_extra_property(self):
        r = _run([_ind("i1", EMP, {PROP: "bob", PROP_AGE: 3})],
                 [NodeShape(EMP, (PropertyShape(path=PROP),), closed=True)])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "closed"


class TestReport:
    def test_conforms_true_and_stats(self):
        r = _run([], [_shape(min_count=1)])
        assert r["conforms"] and r["stats"]["shapes"] == 1

    def test_multiple_violations_aggregate(self):
        r = _run([_ind("i1", EMP, {PROP_AGE: "x"})], [
            _shape(min_count=1),
            NodeShape(EMP, (PropertyShape(path=PROP_AGE, datatype="integer"),)),
        ])
        assert not r["conforms"]
        constraints = {v["constraint"] for v in r["violations"]}
        assert constraints == {"minCount", "datatype"}


# ---------------------------------------------------------------------------
# W3C 全集增量（第三批）：severity 分级 / sh:not / sh:languageIn 与 sh:qualifiedValueShape
# ---------------------------------------------------------------------------

class TestSeverity:
    def test_warning_does_not_break_conforms(self):
        """W3C：severity=Warning 的结果不影响 conforms。"""
        shape = NodeShape(EMP, (PropertyShape(
            path=PROP, pattern=r"^EMP-\d+$", severity="Warning"),))
        r = _run([_ind("i1", EMP, {PROP: "bad-id"})], [shape])
        assert r["conforms"]
        assert r["violations"][0]["severity"] == "Warning"
        assert r["severity_counts"]["Warning"] == 1

    def test_info_result_keeps_conforms(self):
        shape = NodeShape(EMP, (PropertyShape(
            path=PROP, datatype="integer", severity="Info"),))
        r = _run([_ind("i1", EMP, {PROP: "text"})], [shape])
        assert r["conforms"]
        assert r["violations"][0]["severity"] == "Info"

    def test_violation_still_breaks_conforms_and_counts(self):
        shapes = [
            NodeShape(EMP, (PropertyShape(
                path=PROP, pattern=r"^EMP-\d+$", severity="Warning"),)),
            NodeShape(EMP, (PropertyShape(
                path=PROP_AGE, datatype="integer", severity="Info"),)),
            NodeShape(EMP, (PropertyShape(path=PROP_MGR, min_count=1),)),
        ]
        r = _run([_ind("i1", EMP, {PROP: "bad-id", PROP_AGE: "x"})], shapes)
        assert not r["conforms"]
        assert r["severity_counts"] == {"Violation": 1, "Warning": 1, "Info": 1}

    def test_node_shape_closed_severity(self):
        shape = NodeShape(EMP, (PropertyShape(path=PROP),),
                          closed=True, severity="Warning")
        r = _run([_ind("i1", EMP, {PROP: "bob", PROP_AGE: 3})], [shape])
        assert r["conforms"]
        assert r["violations"][0]["constraint"] == "closed"
        assert r["violations"][0]["severity"] == "Warning"


class TestNotConstraint:
    def test_not_passes_when_inner_shape_violated(self):
        """值不满足被取反 shape ⟹ 通过。"""
        neg = PropertyShape(path=PROP, datatype="integer")  # 取反：不是整数
        r = _run([_ind("i1", EMP, {PROP: "text-value"})],
                 [NodeShape(EMP, (PropertyShape(path=PROP, not_shape=neg),))])
        assert r["conforms"] and r["violations"] == []

    def test_not_violates_when_inner_shape_conforms(self):
        """值满足被取反 shape ⟹ 违例（constraint=not）。"""
        neg = PropertyShape(path=PROP, pattern=r"^\d+$")
        r = _run([_ind("i1", EMP, {PROP: "12345"})],
                 [NodeShape(EMP, (PropertyShape(path=PROP, not_shape=neg),))])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "not"

    def test_not_with_severity_warning(self):
        neg = PropertyShape(path=PROP, pattern=r"^ok$")
        r = _run([_ind("i1", EMP, {PROP: "ok"})],
                 [NodeShape(EMP, (PropertyShape(
                     path=PROP, not_shape=neg, severity="Warning"),))])
        assert r["conforms"]
        assert r["violations"][0]["constraint"] == "not"


class TestLanguageIn:
    def test_language_in_pass_on_allowed_tag(self):
        r = _run([_ind("i1", EMP, {PROP: "bonjour@fr"})],
                 [_shape(language_in=("fr", "en"))])
        assert r["conforms"] and r["violations"] == []

    def test_language_in_violation_on_missing_tag(self):
        """无语言标签的纯字符串 = 违例（W3C：literal 须带语言标签）。"""
        r = _run([_ind("i1", EMP, {PROP: "plain"})],
                 [_shape(language_in=("fr", "en"))])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "languageIn"

    def test_language_in_violation_on_disallowed_tag(self):
        r = _run([_ind("i1", EMP, {PROP: "hallo@de"})],
                 [_shape(language_in=("fr", "en"))])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "languageIn"

    def test_language_in_accepts_jsonld_carrier(self):
        """{"@value": …, "@language": …} 载体同样可解析语言标签。"""
        r = _run([_ind("i1", EMP,
                       {PROP: {"@value": "hello", "@language": "en"}})],
                 [_shape(language_in=("en",))])
        assert r["conforms"]


class TestQualifiedValueShape:
    def _qshape(self, **kw) -> NodeShape:
        return NodeShape(EMP, (PropertyShape(
            path=PROP,
            qualified_value_shape=PropertyShape(path=PROP, pattern=r"^EMP-\d+$"),
            **kw,
        ),))

    def test_qualified_min_count_pass(self):
        r = _run([_ind("i1", EMP, {PROP: ["EMP-1", "EMP-2", "other"]})],
                 [self._qshape(qualified_min_count=2)])
        assert r["conforms"] and r["violations"] == []

    def test_qualified_min_count_violation(self):
        r = _run([_ind("i1", EMP, {PROP: ["EMP-1", "nope"]})],
                 [self._qshape(qualified_min_count=2)])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "qualifiedMinCount"

    def test_qualified_max_count_violation(self):
        r = _run([_ind("i1", EMP, {PROP: ["EMP-1", "EMP-2", "EMP-3"]})],
                 [self._qshape(qualified_max_count=2)])
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "qualifiedMaxCount"


# ---------------------------------------------------------------------------
# ONT-SHACL-REASONING：推理推导事实参与/驱动 SHACL 验证（subclass 公理联动）
# ---------------------------------------------------------------------------

MGR = "ont.t.ac.obj.manager.v1"
LEAD = "ont.t.ac.obj.teamlead.v1"


class TestShaclReasoning:
    EMPSHAPE = NodeShape(EMP, (
        PropertyShape(path=PROP, min_count=1, datatype="string"),))

    def test_subclass_instance_targeted(self):
        """manager ⊑ employee：employee 的 shape 验证 manager 实例（缺 name 报违例）。"""
        axioms = [(MGR, EMP)]
        r = validate_shacl([_ind("m1", MGR, {})], [self.EMPSHAPE],
                           subclass_axioms=axioms)
        assert not r["conforms"]
        assert r["violations"][0]["constraint"] == "minCount"

    def test_transitive_closure_targeting(self):
        """teamlead ⊑ manager ⊑ employee：传递闭包实例同样被纳入。"""
        axioms = [(LEAD, MGR), (MGR, EMP)]
        r = validate_shacl([_ind("l1", LEAD, {PROP: "bob"})],
                           [self.EMPSHAPE], subclass_axioms=axioms)
        assert r["conforms"]  # name 满足 → 通过（说明已被 target 到）

    def test_sh_class_subclass_satisfaction(self):
        """sh:class employee：引用值为 manager 实例即满足（子类 ⟹ is-a）。"""
        axioms = [(MGR, EMP)]
        shape = NodeShape(EMP, (
            PropertyShape(path=PROP_MGR, node_class=EMP),))
        r = validate_shacl(
            [_ind("m1", MGR, {PROP: "boss", PROP_MGR: "m2"}),
             _ind("m2", MGR, {PROP: "x"})],
            [shape], subclass_axioms=axioms)
        assert r["conforms"]

    def test_no_axioms_behavior_unchanged(self):
        """无公理：子类实例不被 target（旧行为）。"""
        r = validate_shacl([_ind("m1", MGR, {})], [self.EMPSHAPE])
        assert r["conforms"] and r["stats"]["nodes_validated"] == 0

    def test_multi_parent_closure(self):
        """多父并集：manager ⊑ employee 且 manager ⊑ person，两 shape 都命中。"""
        PERSON = "ont.t.ac.obj.person.v1"
        axioms = [(MGR, EMP), (MGR, PERSON)]
        pshape = NodeShape(PERSON, (
            PropertyShape(path=PROP, min_count=1),))
        r = validate_shacl([_ind("m1", MGR, {PROP: "boss"})],
                           [self.EMPSHAPE, pshape], subclass_axioms=axioms)
        assert r["conforms"] and r["stats"]["nodes_validated"] == 1

    def test_unrelated_branch_not_targeted(self):
        """无公共祖先的分支不被误 target。"""
        OTHER = "ont.t.ac.obj.machine.v1"
        axioms = [(OTHER, "ont.t.ac.obj.device.v1")]
        r = validate_shacl([_ind("x1", OTHER, {})], [self.EMPSHAPE],
                           subclass_axioms=axioms)
        assert r["conforms"] and r["stats"]["nodes_validated"] == 0
