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
