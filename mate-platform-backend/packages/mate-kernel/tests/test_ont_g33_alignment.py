"""ONT-G33 — 对齐与合并最小闭环单测。

覆盖：same_as 显式配对聚类、词汇相似对齐、结构相似对齐、阈值负例、
传递闭包聚类（复用 R2 并查集）；类型合并字段并集、冲突标记与策略消解、
合并审计记录。
"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.alignment import (  # noqa: E402
    align_individuals,
    merge_object_types,
)
from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402


def _ind(rid: str, cls: str, **props) -> dict:
    return {"rid": rid, "class_rid": cls, "props": props}


CLSA = "ont.t1.obj.customer.v1"
CLSB = "ont.t2.obj.customer.v1"


class TestAlignIndividuals:
    def test_explicit_pair_forms_cluster(self):
        left = [_ind("a1", CLSA, **{"ont.t1.prop.name.v1": "Alice"})]
        right = [_ind("b1", CLSB, **{"ont.t2.prop.name.v1": "Bob"})]
        r = align_individuals(left, right, explicit_pairs=[("a1", "b1")])
        assert r["matched_pairs"][0]["evidence"] == ["explicit"]
        assert r["clusters"] == {"a1": ["a1", "b1"]}

    def test_lexical_normalized_match(self):
        """label 规范化（大小写/分隔符）后相等 = 词汇对齐。"""
        left = [_ind("a1", CLSA, **{"ont.t1.prop.name.v1": "ACME Corp."})]
        right = [_ind("b1", CLSB, **{"ont.t2.prop.fullname.v1": "acme corp"})]
        r = align_individuals(left, right)
        assert r["matched_pairs"][0]["evidence"] == ["lexical"]
        assert len(r["clusters"]) == 1

    def test_structural_match_same_class_overlapping_paths(self):
        """同类 + 属性路径/值签名重叠 ≥ 阈值 = 结构对齐（label 不同）。"""
        left = [_ind("a1", CLSA,
                     **{"ont.t1.prop.name.v1": "alpha",
                        "ont.t1.prop.email.v1": "shared@corp.io",
                        "ont.t1.prop.phone.v1": "555-0001"})]
        right = [_ind("b1", CLSB,
                      **{"ont.t2.prop.title.v1": "zeta",
                         "ont.t2.prop.email.v1": "shared@corp.io",
                         "ont.t2.prop.phone.v1": "555-0001"})]
        r = align_individuals(left, right)
        evid = r["matched_pairs"][0]["evidence"]
        assert "structural" in evid
        assert len(r["clusters"]) == 1

    def test_no_match_below_thresholds(self):
        left = [_ind("a1", CLSA, **{"ont.t1.prop.name.v1": "aaa"})]
        right = [_ind("b1", CLSB, **{"ont.t2.prop.name.v1": "zzz"})]
        r = align_individuals(left, right)
        assert r["matched_pairs"] == [] and r["clusters"] == {}
        assert r["stats"]["pairs_evaluated"] == 1

    def test_transitive_pairs_merge_into_single_cluster(self):
        """a≈b（显式）+ b≈c（词汇）⟹ 同簇（R2 对称闭包）。"""
        left = [
            _ind("a1", CLSA, **{"ont.t1.prop.name.v1": "n1"}),
            _ind("a2", CLSA, **{"ont.t1.prop.name.v1": "n2"}),
        ]
        right = [
            _ind("b1", CLSB, **{"ont.t2.prop.name.v1": "n1"}),
            _ind("b2", CLSB, **{"ont.t2.prop.name.v1": "n2"}),
        ]
        r = align_individuals(left, right, explicit_pairs=[("a1", "b2")])
        # a1≈b2 且 a2≈b1（词汇）→ 全员同簇
        clusters = r["clusters"]
        assert len(clusters) == 1
        members = next(iter(clusters.values()))
        assert set(members) == {"a1", "a2", "b1", "b2"}


# ---------------------------------------------------------------------------
# merge_object_types
# ---------------------------------------------------------------------------

def _prop(slug: str, *, type_id: str = "ont.t1.vt.string",
          nullable: bool = False, pk: bool = False,
          fmt: PropertyFormat = PropertyFormat.STRING) -> Property:
    return Property(
        rid=ClassRef(f"ont.t1.prop.{slug}.v1"),
        type_id=type_id,
        nullable=nullable,
        primary_key=pk,
        title=slug,
        format=fmt,
    )


def _ot(slug: str, props: list[Property], pks: list[str]) -> ObjectType:
    by_slug = {p.rid.rid.split(".")[-2]: p for p in props}
    return ObjectType(
        rid=ClassRef(f"ont.t1.obj.{slug}.v1"),
        primary_key=tuple(by_slug[s].rid for s in pks),
        properties=tuple(props),
    )


class TestMergeObjectTypes:
    def test_field_union_adds_new_property(self):
        a = _ot("customer", [_prop("id", pk=True), _prop("name")], ["id"])
        b = _ot("customer", [_prop("id", pk=True), _prop("email")], ["id"])
        out = merge_object_types(a, b)
        merged = out["object_type"]
        assert {p.rid.rid for p in merged.properties} >= {
            "ont.t1.prop.id.v1", "ont.t1.prop.name.v1", "ont.t1.prop.email.v1"}
        assert out["audit"]["added"] == ["ont.t1.prop.email.v1"]
        assert out["audit"]["conflicts"] == []

    def test_conflict_marked_and_resolved_keep_left(self):
        a = _ot("customer", [
            _prop("id", pk=True), _prop("age", type_id="ont.t1.vt.integer")],
            ["id"])
        b = _ot("customer", [
            _prop("id", pk=True), _prop("age", type_id="ont.t1.vt.string")],
            ["id"])
        out = merge_object_types(a, b, strategy="keep_left")
        merged = out["object_type"]
        age = next(p for p in merged.properties if "age" in p.rid.rid)
        assert age.type_id == "ont.t1.vt.integer"
        assert out["audit"]["conflicts"] == [{
            "property_rid": "ont.t1.prop.age.v1", "field": "type_id",
            "left": "ont.t1.vt.integer", "right": "ont.t1.vt.string",
            "resolved": "ont.t1.vt.integer",
        }]

    def test_strategy_keep_right_resolves_conflict(self):
        a = _ot("customer", [
            _prop("id", pk=True), _prop("age", type_id="ont.t1.vt.integer")],
            ["id"])
        b = _ot("customer", [
            _prop("id", pk=True), _prop("age", type_id="ont.t1.vt.string")],
            ["id"])
        out = merge_object_types(a, b, strategy="keep_right")
        age = next(p for p in out["object_type"].properties
                   if "age" in p.rid.rid)
        assert age.type_id == "ont.t1.vt.string"

    def test_merge_audit_and_pk_union(self):
        a = _ot("customer", [_prop("id", pk=True)], ["id"])
        b = _ot("customer", [_prop("code", pk=True, nullable=False)], ["code"])
        out = merge_object_types(a, b)
        audit = out["audit"]
        assert audit["merged_from"] == ["ont.t1.obj.customer.v1",
                                        "ont.t1.obj.customer.v1"]
        assert audit["into"] == "ont.t1.obj.customer.v1"
        assert audit["strategy"] == "keep_left"
        assert audit["properties_merged"] == 2
        pks = {p.rid for p in out["object_type"].primary_key}
        assert pks == {"ont.t1.prop.id.v1", "ont.t1.prop.code.v1"}
