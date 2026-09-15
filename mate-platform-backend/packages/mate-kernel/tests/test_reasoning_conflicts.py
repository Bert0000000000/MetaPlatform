"""Axiom 冲突检测（detect_axiom_conflicts）单测 — SHACL×Axiom 联动闸门配套。

覆盖：等价传递/对称、等价×子类联动、disjoint 继承冲突、实例双互斥类、
domain/range 违例（含经闭包放行）、子类环、空输入全过、组合场景、
severity 正确性、去重与确定性。
"""

from __future__ import annotations

import os
import sys
from dataclasses import FrozenInstanceError

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

import pytest

from mate_kernel.ontology.reasoning import detect_axiom_conflicts as pkg_entry
from mate_kernel.ontology.reasoning.conflicts import AxiomConflict, detect_axiom_conflicts
from mate_kernel.ontology.reasoning.engine import detect_axiom_conflicts as engine_entry

RULES = {"subclass_cycle", "disjoint", "domain", "range", "equivalence"}


def run(**kw) -> list[AxiomConflict]:
    base: dict = dict(
        subclass_axioms=[],
        equivalent_axioms=[],
        disjoint_axioms=[],
        type_assertions=[],
        property_assertions=[],
        domain_range=[],
    )
    base.update(kw)
    return detect_axiom_conflicts(**base)


class TestEmptyAndConsistent:
    def test_empty_input(self):
        assert run() == []

    def test_consistent_model_no_conflict(self):
        out = run(
            subclass_axioms=[("Manager", "Employee"), ("Employee", "Person")],
            equivalent_axioms=[("Manager", "Mgr")],
            type_assertions=[("i1", "Manager"), ("org1", "Org")],
            property_assertions=[{"property": "worksFor", "subject": "i1", "object": "org1"}],
            domain_range=[{"property": "worksFor", "domain": "Employee", "range": "Org"}],
        )
        assert out == []

    def test_import_paths_share_one_implementation(self):
        # 三条导入路径（engine / conflicts / 包级）指向同一实现，闸门任选其一
        assert engine_entry is detect_axiom_conflicts
        assert pkg_entry is detect_axiom_conflicts


class TestEquivalence:
    def test_transitive_symmetric_closure(self):
        # eqA ≡ eqB ≡ eqC，eqC ⊑ Root ⟹ eqA ⊑ Root（传递 + 对称 + 子类联动）
        kw = dict(
            subclass_axioms=[("eqC", "Root")],
            equivalent_axioms=[("eqA", "eqB"), ("eqB", "eqC")],
            type_assertions=[("s", "eqA")],
            property_assertions=[{"property": "p", "subject": "s", "object": "o"}],
            domain_range=[{"property": "p", "domain": "Root", "range": None}],
        )
        assert run(**kw) == []
        # 无等价公理时同一模型必须违例 —— 证明上面的 [] 来自等价闭包
        no_eq = dict(kw)
        no_eq["equivalent_axioms"] = []
        assert [cf.rule for cf in run(**no_eq)] == ["domain"]

    def test_cluster_straddles_disjoint_pair(self):
        # A≡B ∧ disjoint(A,C) ∧ B≡C：等价类 {A,B,C} 跨越互斥对
        out = run(
            equivalent_axioms=[("A", "B"), ("B", "C")],
            disjoint_axioms=[("A", "C")],
        )
        assert len(out) == 1
        cf = out[0]
        assert cf.rule == "equivalence"
        assert cf.severity == "violation"
        assert cf.subjects == ("A", "B", "C")
        assert "A" in cf.message and "C" in cf.message

    def test_equivalent_pair_also_disjoint(self):
        out = run(
            equivalent_axioms=[("A", "B")],
            disjoint_axioms=[("A", "B")],
        )
        assert [cf.rule for cf in out] == ["equivalence"]
        assert out[0].subjects == ("A", "B")

    def test_equivalence_feeds_disjoint_check(self):
        # S 断言为 A、C；A≡B 且 disjoint(B,C) ⟹ S 经等价闭包落入互斥对两侧
        out = run(
            equivalent_axioms=[("A", "B")],
            disjoint_axioms=[("B", "C")],
            type_assertions=[("S", "A"), ("S", "C")],
        )
        assert len(out) == 1
        cf = out[0]
        assert cf.rule == "disjoint"
        assert cf.subjects[0] == "S"
        assert set(cf.subjects[1:]) == {"A", "C"}


class TestDisjoint:
    def test_instance_two_disjoint_classes(self):
        out = run(
            disjoint_axioms=[("A", "B")],
            type_assertions=[("S", "A"), ("S", "B")],
        )
        assert len(out) == 1
        assert out[0].rule == "disjoint"
        assert out[0].subjects == ("S", "A", "B")

    def test_disjoint_inherited_to_descendants(self):
        # disjoint(Animal, Machine) ⟹ 后代 Dog 与 Robot 亦互斥
        out = run(
            subclass_axioms=[("Dog", "Animal"), ("Robot", "Machine")],
            disjoint_axioms=[("Animal", "Machine")],
            type_assertions=[("S", "Dog"), ("S", "Robot")],
        )
        assert [cf.rule for cf in out] == ["disjoint"]
        assert out[0].subjects == ("S", "Animal", "Machine")

    def test_single_class_spanning_both_sides(self):
        # 单一断言类 D 多继承 A、B，而 disjoint(A,B) —— 经闭包仍违例
        out = run(
            subclass_axioms=[("D", "A"), ("D", "B")],
            disjoint_axioms=[("A", "B")],
            type_assertions=[("S", "D")],
        )
        assert [cf.rule for cf in out] == ["disjoint"]
        assert out[0].subjects == ("S", "A", "B")

    def test_disjoint_pair_contradicts_hierarchy(self):
        # disjoint(A,B) ∧ A⊑B：类层面矛盾只报一次，实例不重复报
        out = run(
            subclass_axioms=[("A", "B")],
            disjoint_axioms=[("A", "B")],
            type_assertions=[("S", "A")],
        )
        assert len(out) == 1
        assert out[0].rule == "disjoint"
        assert out[0].subjects == ("A", "B")

    def test_consistent_disjoint_no_conflict(self):
        out = run(
            disjoint_axioms=[("A", "B")],
            type_assertions=[("S1", "A"), ("S2", "B")],
        )
        assert out == []


class TestDomainRange:
    def test_domain_violation(self):
        out = run(
            type_assertions=[("s", "Car")],
            property_assertions=[{"property": "p", "subject": "s", "object": "o"}],
            domain_range=[{"property": "p", "domain": "Person", "range": None}],
        )
        assert [cf.rule for cf in out] == ["domain"]
        assert out[0].severity == "violation"
        assert out[0].subjects == ("p", "s", "Person")
        assert "s" in out[0].message and "Person" in out[0].message

    def test_domain_pass_via_subclass(self):
        out = run(
            subclass_axioms=[("Engineer", "Person")],
            type_assertions=[("s", "Engineer")],
            property_assertions=[{"property": "p", "subject": "s", "object": "o"}],
            domain_range=[{"property": "p", "domain": "Person", "range": None}],
        )
        assert out == []

    def test_domain_pass_via_equivalence_linkage(self):
        # A≡B ∧ B⊑Person ⟹ A⊑Person（等价×子类联动放行）
        out = run(
            subclass_axioms=[("B", "Person")],
            equivalent_axioms=[("A", "B")],
            type_assertions=[("s", "A")],
            property_assertions=[{"property": "p", "subject": "s", "object": "o"}],
            domain_range=[{"property": "p", "domain": "Person", "range": None}],
        )
        assert out == []

    def test_range_violation(self):
        out = run(
            type_assertions=[("s", "Person"), ("o", "Person")],
            property_assertions=[{"property": "p", "subject": "s", "object": "o"}],
            domain_range=[{"property": "p", "domain": None, "range": "Org"}],
        )
        assert [cf.rule for cf in out] == ["range"]
        assert out[0].severity == "violation"
        assert out[0].subjects == ("p", "o", "Org")

    def test_range_pass_via_subclass(self):
        out = run(
            subclass_axioms=[("Team", "Org")],
            type_assertions=[("s", "Person"), ("o", "Team")],
            property_assertions=[{"property": "p", "subject": "s", "object": "o"}],
            domain_range=[{"property": "p", "domain": "Person", "range": "Org"}],
        )
        assert out == []

    def test_untyped_endpoints_skipped(self):
        # 端点无类型断言 ⟹ 无法判定，不视为违例
        out = run(
            property_assertions=[{"property": "p", "subject": "s1", "object": "o1"}],
            domain_range=[{"property": "p", "domain": "D", "range": "R"}],
        )
        assert out == []

    def test_domain_none_only_range_checked(self):
        out = run(
            type_assertions=[("o", "Wrong")],
            property_assertions=[{"property": "p", "subject": "s", "object": "o"}],
            domain_range=[{"property": "p", "domain": None, "range": "R"}],
        )
        assert [cf.rule for cf in out] == ["range"]

    def test_unconstrained_property_not_checked(self):
        out = run(
            type_assertions=[("s", "A")],
            property_assertions=[{"property": "free", "subject": "s", "object": "o"}],
            domain_range=[{"property": "other", "domain": "D", "range": None}],
        )
        assert out == []


class TestSubclassCycle:
    def test_three_node_cycle_single_conflict(self):
        out = run(subclass_axioms=[("c-a", "c-b"), ("c-b", "c-c"), ("c-c", "c-a")])
        assert len(out) == 1
        cf = out[0]
        assert cf.rule == "subclass_cycle"
        assert cf.severity == "violation"
        assert cf.subjects == ("c-a", "c-b", "c-c")

    def test_self_loop(self):
        out = run(subclass_axioms=[("A", "A")])
        assert [cf.rule for cf in out] == ["subclass_cycle"]
        assert out[0].subjects == ("A",)

    def test_two_independent_cycles(self):
        out = run(
            subclass_axioms=[
                ("x-a", "x-b"),
                ("x-b", "x-a"),
                ("y-a", "y-b"),
                ("y-b", "y-a"),
            ]
        )
        assert len(out) == 2
        assert {cf.subjects for cf in out} == {("x-a", "x-b"), ("y-a", "y-b")}

    def test_diamond_not_a_cycle(self):
        out = run(subclass_axioms=[("d", "b"), ("d", "c"), ("b", "root"), ("c", "root")])
        assert out == []

    def test_equivalent_reverse_edges_not_a_cycle(self):
        # A⊑B ∧ A≡B（等价蕴含 B⊑A）—— 合法，不报子类环
        out = run(
            subclass_axioms=[("A", "B")],
            equivalent_axioms=[("A", "B")],
        )
        assert out == []


class TestContract:
    def test_frozen_dataclass_field_order(self):
        cf = AxiomConflict("r1", "violation", "m", ("a",))
        assert (cf.rule, cf.severity, cf.message, cf.subjects) == ("r1", "violation", "m", ("a",))
        with pytest.raises(FrozenInstanceError):
            cf.rule = "r2"  # type: ignore[misc]

    def test_combined_scenario_all_rules(self):
        out = run(
            subclass_axioms=[("cyc-a", "cyc-b"), ("cyc-b", "cyc-a")],
            equivalent_axioms=[("eq-1", "eq-2")],
            disjoint_axioms=[("cls-a", "cls-b"), ("eq-1", "eq-2")],
            type_assertions=[
                ("inst-s", "cls-a"),
                ("inst-s", "cls-b"),
                ("inst-t", "cls-x"),
                ("obj-o", "cls-y"),
            ],
            property_assertions=[{"property": "prop-p", "subject": "inst-t", "object": "obj-o"}],
            domain_range=[{"property": "prop-p", "domain": "dom-d", "range": "rng-r"}],
        )
        assert {cf.rule for cf in out} == RULES
        assert all(cf.severity == "violation" for cf in out)
        assert all(cf.rule in RULES for cf in out)

    def test_all_detected_conflicts_are_violations(self):
        # severity 语义：本引擎当前全部产出 violation（warning 保留给闸门分级）
        out = run(
            subclass_axioms=[("a", "b"), ("b", "a"), ("D", "A"), ("D", "B")],
            equivalent_axioms=[("E1", "E2")],
            disjoint_axioms=[("A", "B"), ("E1", "E2")],
            type_assertions=[("S", "D")],
        )
        assert out
        assert {cf.severity for cf in out} == {"violation"}

    def test_duplicate_axioms_deduped(self):
        out = run(
            disjoint_axioms=[("A", "B"), ("A", "B"), ("B", "A")],
            type_assertions=[("S", "A"), ("S", "A"), ("S", "B")],
        )
        assert len(out) == 1
        assert out[0].subjects == ("S", "A", "B")

    def test_deterministic_sorted_output(self):
        kw = dict(
            subclass_axioms=[("z", "z"), ("m-a", "m-b"), ("m-b", "m-a")],
            disjoint_axioms=[("B", "A")],
            type_assertions=[("S", "A"), ("S", "B")],
            property_assertions=[
                {"property": "p", "subject": "S", "object": "O"},
                {"property": "p", "subject": "S", "object": "O"},
            ],
            domain_range=[{"property": "p", "domain": "X", "range": "Y"}],
        )
        first = run(**kw)
        second = run(**kw)
        assert first == second
        assert [cf.rule for cf in first] == sorted(cf.rule for cf in first)
