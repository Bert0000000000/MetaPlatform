"""ONT-G16+G13 — 推理引擎三规则单测。"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.reasoning.engine import run_inference  # noqa: E402


class TestSubclassClosure:
    def test_transitive_inheritance(self):
        out = run_inference(
            subclass_axioms=[("worker", "person"), ("person", "agent")],
            individuals={"i1": ["worker"]},
            same_as_pairs=[], transitive_axioms=[], property_edges=[],
        )
        c = out["classification"]["i1"]
        assert c["asserted"] == ["worker"]
        assert set(c["inferred"]) == {"person", "agent"}

    def test_cycle_safe(self):
        out = run_inference(
            subclass_axioms=[("a", "b"), ("b", "a")],
            individuals={"i": ["a"]},
            same_as_pairs=[], transitive_axioms=[], property_edges=[],
        )
        assert out["classification"]["i"]["asserted"] == ["a"]


class TestSameAs:
    def test_cluster_merge(self):
        out = run_inference(
            subclass_axioms=[],
            individuals={},
            same_as_pairs=[("a", "b"), ("b", "c")],
            transitive_axioms=[], property_edges=[],
        )
        assert set(out["same_as_clusters"]) == {"a"}
        assert out["same_as_clusters"]["a"] == ["a", "b", "c"]


class TestTransitive:
    def test_transitive_edge_inferred(self):
        out = run_inference(
            subclass_axioms=[],
            individuals={},
            same_as_pairs=[],
            transitive_axioms=["related_to"],
            property_edges=[("related_to", "x", "y"), ("related_to", "y", "z")],
        )
        got = {(e["src"], e["dst"]) for e in out["transitive_inferred"]}
        assert ("x", "z") in got

    def test_non_transitive_not_inferred(self):
        out = run_inference(
            subclass_axioms=[],
            individuals={},
            same_as_pairs=[],
            transitive_axioms=[],
            property_edges=[("owns", "x", "y"), ("owns", "y", "z")],
        )
        assert out["transitive_inferred"] == []


class TestEdgeCases:
    def test_empty_input(self):
        out = run_inference(subclass_axioms=[], individuals={},
                            same_as_pairs=[], transitive_axioms=[], property_edges=[])
        assert out["stats"]["facts_inferred"] == 0

    def test_self_pair_no_cluster(self):
        out = run_inference(subclass_axioms=[], individuals={},
                            same_as_pairs=[("a", "a")], transitive_axioms=[],
                            property_edges=[])
        assert out["same_as_clusters"] == {}

    def test_direct_edge_not_duplicated(self):
        out = run_inference(subclass_axioms=[], individuals={},
                            same_as_pairs=[], transitive_axioms=["p"],
                            property_edges=[("p", "x", "y")])
        assert out["transitive_inferred"] == []

    def test_stats_rules_constant(self):
        out = run_inference(subclass_axioms=[("a", "b")], individuals={"i": ["a"]},
                            same_as_pairs=[], transitive_axioms=[], property_edges=[])
        assert out["stats"]["rules_applied"] == 3

    def test_multiple_parents_union(self):
        out = run_inference(
            subclass_axioms=[("c", "p1"), ("c", "p2"), ("p1", "base")],
            individuals={"i": ["c"]},
            same_as_pairs=[], transitive_axioms=[], property_edges=[])
        assert set(out["classification"]["i"]["inferred"]) == {"p1", "p2", "base"}

    def test_classification_asserted_preserved(self):
        out = run_inference(subclass_axioms=[], individuals={"i": ["t"]},
                            same_as_pairs=[], transitive_axioms=[], property_edges=[])
        assert out["classification"]["i"] == {"asserted": ["t"], "inferred": []}
