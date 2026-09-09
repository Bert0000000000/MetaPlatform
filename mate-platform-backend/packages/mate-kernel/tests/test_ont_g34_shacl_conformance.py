"""ONT-G34 — W3C SHACL Test Suite 核心子集 conformance（映射到 kernel shacl.py）。

用例对位 W3C shacl-test-suite 的核心组件（focus node 行为以本仓实例载体
{rid, class_rid, props} 表达；断言 conforms 与关键 constraint）。
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

CLS = "ont.t.obj.c.v1"
P = "ont.t.prop.p.v1"
Q = "ont.t.prop.q.v1"


def _case(name, individuals, shapes, expect_conforms, expect_constraint=None):
    r = validate_shacl(individuals, shapes)
    ok = r["conforms"] == expect_conforms and (
        expect_constraint is None
        or any(v["constraint"] == expect_constraint for v in r["violations"])
    ) if expect_conforms else (
        r["conforms"] == expect_conforms
        and (expect_constraint is None
             or any(v["constraint"] == expect_constraint for v in r["violations"]))
    )
    return name, ok, r


def test_core_mincount():
    n, ok, r = _case(
        "core/property/minCount-001",
        [{"rid": "i1", "class_rid": CLS, "props": {}}],
        [NodeShape(CLS, (PropertyShape(path=P, min_count=1),))],
        expect_conforms=False, expect_constraint="minCount")
    assert ok, r


def test_core_maxcount():
    n, ok, r = _case(
        "core/property/maxCount-001",
        [{"rid": "i1", "class_rid": CLS, "props": {P: ["a", "b"]}}],
        [NodeShape(CLS, (PropertyShape(path=P, max_count=1),))],
        expect_conforms=False, expect_constraint="maxCount")
    assert ok, r


def test_core_datatype():
    n, ok, r = _case(
        "core/property/datatype-001",
        [{"rid": "i1", "class_rid": CLS, "props": {P: "not-an-int"}}],
        [NodeShape(CLS, (PropertyShape(path=P, datatype="integer"),))],
        expect_conforms=False, expect_constraint="datatype")
    assert ok, r


def test_core_pattern():
    n, ok, r = _case(
        "core/property/pattern-001",
        [{"rid": "i1", "class_rid": CLS, "props": {P: "abc"}}],
        [NodeShape(CLS, (PropertyShape(path=P, pattern=r"^a.c$"),))],
        expect_conforms=True)
    assert ok, r


def test_core_class():
    n, ok, r = _case(
        "core/property/class-001",
        [{"rid": "s1", "class_rid": CLS, "props": {P: "o1"}},
         {"rid": "o1", "class_rid": CLS, "props": {}}],
        [NodeShape(CLS, (PropertyShape(path=P, node_class=CLS),))],
        expect_conforms=True)
    assert ok, r


def test_core_closed():
    n, ok, r = _case(
        "core/closed-001",
        [{"rid": "i1", "class_rid": CLS, "props": {P: "a", Q: "b"}}],
        [NodeShape(CLS, (PropertyShape(path=P),), closed=True)],
        expect_conforms=False, expect_constraint="closed")
    assert ok, r


def test_core_languagein():
    n, ok, r = _case(
        "core/property/languageIn-001",
        [{"rid": "i1", "class_rid": CLS, "props": {P: "bonjour@fr"}}],
        [NodeShape(CLS, (PropertyShape(path=P, language_in=("fr", "en")),))],
        expect_conforms=True)
    assert ok, r


def test_core_not():
    neg = PropertyShape(path=P, pattern=r"^\d+$")
    shape = NodeShape(CLS, (PropertyShape(path=P, not_shape=neg),))
    n, ok, r = _case(
        "core/property/not-001",
        [{"rid": "i1", "class_rid": CLS, "props": {P: "123"}}],
        [shape],
        expect_conforms=False, expect_constraint="not")
    assert ok, r


def test_severity_semantics():
    """W3C 语义：Warning 不影响 conforms。"""
    n, ok, r = _case(
        "severity (W3C conforms semantics)",
        [{"rid": "i1", "class_rid": CLS, "props": {P: "x"}}],
        [NodeShape(CLS, (PropertyShape(path=P, pattern=r"^\d+$",
                                       severity="Warning"),))],
        expect_conforms=True)
    assert ok, r


def test_qualifiedshapes():
    n, ok, r = _case(
        "core/property/qualifiedValueShape (min count semantics)",
        [{"rid": "i1", "class_rid": CLS,
          "props": {P: ["EMP-1", "other"]}}],
        [NodeShape(CLS, (PropertyShape(
            path=P,
            qualified_value_shape=PropertyShape(path=P, pattern=r"^EMP-"),
            qualified_min_count=2),))],
        expect_conforms=False, expect_constraint="qualifiedMinCount")
    assert ok, r
