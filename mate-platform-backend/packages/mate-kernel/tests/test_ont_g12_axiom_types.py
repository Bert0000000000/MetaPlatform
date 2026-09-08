"""ONT-G12 第一批 — Axiom 类型集扩展（OWL 2 常用公理）。"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "src")
if _K not in sys.path:
    sys.path.insert(0, _K)

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.reasoning.axiom import Axiom, AxiomKind  # noqa: E402


def _ax(kind: AxiomKind) -> Axiom:
    return Axiom(
        rid=ClassRef(f"ont.t.ax.{kind.value}.demo.v1"),
        kind=kind,
        operands=(ClassRef("ont.t.obj.a.v1"), ClassRef("ont.t.obj.b.v1")),
        rule_ref="builtin",
    )


class TestExtendedKinds:
    def test_all_new_kinds_constructible(self):
        for k in (
            AxiomKind.EQUIVALENT_CLASS, AxiomKind.PROPERTY_DOMAIN,
            AxiomKind.PROPERTY_RANGE, AxiomKind.FUNCTIONAL,
            AxiomKind.INVERSE_FUNCTIONAL, AxiomKind.TRANSITIVE_PROPERTY,
            AxiomKind.SYMMETRIC_PROPERTY, AxiomKind.PROPERTY_CHAIN,
            AxiomKind.HAS_KEY,
        ):
            a = _ax(k)
            assert a.kind is k and a.kind.value == k.value

    def test_frozen_and_hashable(self):
        a = _ax(AxiomKind.PROPERTY_CHAIN)
        try:
            a.kind = AxiomKind.HAS_KEY  # type: ignore[misc]
            raise AssertionError("should be frozen")
        except AttributeError:
            pass
        assert hash(a) == hash(_ax(AxiomKind.PROPERTY_CHAIN))

    def test_legacy_kinds_intact(self):
        for k in ("subclass", "transitivity", "property", "same_as", "disjoint"):
            assert AxiomKind(k).value == k
