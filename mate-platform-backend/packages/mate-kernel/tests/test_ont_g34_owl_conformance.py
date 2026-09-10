"""ONT-G34 — OWL 2 子集 conformance（经 reasoning engine 语义对位）。

OWL 2 基础公理 → 引擎输入映射：
  rdfs:subClassOf        → subclass_axioms (R1)
  owl:sameAs             → same_as_pairs (R2)
  传递属性 (owl:TransitiveProperty) → transitive_axioms (R3)
"""

from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.reasoning.engine import run_inference


def _run(sub, ind, same, trans, edges):
    return run_inference(
        subclass_axioms=sub,
        individuals=ind,
        same_as_pairs=same,
        transitive_axioms=trans,
        property_edges=edges,
    )


def test_owl_subclassof_chain():
    """rdfs:subClassOf 传递链：C ⊑ B ⊑ A ⟹ C ∈ A。"""
    r = _run([("c", "b"), ("b", "a")], {"i1": ["c"]}, [], [], [])
    assert "a" in r["classification"]["i1"]["inferred"]


def test_owl_sameas_symmetry():
    """owl:sameAs 对称闭包：a≡b ⟹ 双向合并。"""
    r = _run([], {}, [("i1", "i2")], [], [])
    assert set(r["same_as_clusters"].keys()) == {"i1"}
    assert r["same_as_clusters"]["i1"] == ["i1", "i2"]


def test_owl_transitive_property():
    """owl:TransitiveProperty：xRy ∧ yRz ⟹ xRz。"""
    r = _run([], {}, [], ["part_of"], [("part_of", "wheel", "car"), ("part_of", "car", "fleet")])
    assert {"property": "part_of", "src": "wheel", "dst": "fleet"} in r["transitive_inferred"]


def test_owl_subclass_inheritance_instance():
    """实例断言子类 ⟹ 继承全部祖先（R1 分类）。"""
    r = _run([("tomcat", "cat"), ("cat", "animal")], {"t1": ["tomcat"]}, [], [], [])
    cls = r["classification"]["t1"]
    assert cls["asserted"] == ["tomcat"]
    assert set(cls["inferred"]) == {"cat", "animal"}


def test_stats_rules_applied():
    r = _run([("b", "a")], {"i1": ["b"]}, [], [], [])
    assert r["stats"]["rules_applied"] == 3
