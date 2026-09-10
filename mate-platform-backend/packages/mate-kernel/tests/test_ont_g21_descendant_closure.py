"""ONT-G21 — descendant_closure（后代闭包）单测。

推理层级对 ObjectSet 可见的查询侧原语：B 的后代 = 全部 A⊑…⊑B 的 A。
"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.reasoning.engine import descendant_closure


class TestDescendantClosure:
    def test_direct_subclass(self):
        out = descendant_closure([("employee", "person")])
        assert out["person"] == {"employee"}

    def test_transitive_chain(self):
        out = descendant_closure([("employee", "person"), ("person", "agent")])
        # agent 的后代含 employee（传递）与 person（直接）
        assert out["agent"] == {"employee", "person"}
        assert out["person"] == {"employee"}
        assert "employee" not in out  # employee 是叶子，无人⊑它

    def test_multi_parent_union(self):
        out = descendant_closure([("a", "x"), ("a", "y"), ("b", "x")])
        assert out["x"] == {"a", "b"}
        assert out["y"] == {"a"}

    def test_cycle_protection(self):
        out = descendant_closure([("a", "b"), ("b", "a")])
        # 环不发散：各自后代含对方（一次），不无限膨胀
        assert out["a"] == {"b"}
        assert out["b"] == {"a"}

    def test_empty_axioms(self):
        assert descendant_closure([]) == {}

    def test_queried_class_without_children_absent(self):
        out = descendant_closure([("employee", "person")])
        assert "employee" not in out  # employee 是叶子，无人⊑它
