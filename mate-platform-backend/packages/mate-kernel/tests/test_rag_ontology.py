"""RAG-ONT-01 RAG-on-Ontology 测试。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.ontology.types.property_ import PropertyFormat
from mate_kernel.rag.ontology import RagIndex, RagQuery, RagRetriever


def _cls(slug: str = "order") -> ClassRef:
    return ClassRef(rid=f"ont.acme.cls.{slug}.v1")


def _prop(slug: str) -> ClassRef:
    return ClassRef(rid=f"ont.acme.prop.{slug}.v1")


def _ind(pk: str, props: dict[str, object]) -> Individual:
    return Individual(
        rid=f"ont.acme.ind.order.{pk}",
        class_rid=_cls(),
        props=tuple((_prop(name), value) for name, value in props.items()),  # type: ignore[arg-type]
        primary_key=pk,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        tenant_id="acme",
    )


class TestRagIndex:
    def _idx(self) -> RagIndex:
        return RagIndex()

    def test_add_individual_creates_chunks(self) -> None:
        idx = self._idx()
        ids = idx.add_individual(_ind("1", {"status": "open", "amount": 100}))
        assert len(ids) == 2
        assert idx.size() == 2

    def test_chunk_inherits_format(self) -> None:
        idx = self._idx()
        idx.add_individual(_ind("1", {"active": True, "name": "rush-order"}))
        chunk_list = list(idx._chunks.values())
        formats = {c.property_format for c in chunk_list}
        assert PropertyFormat.BOOLEAN in formats
        assert PropertyFormat.STRING in formats

    def test_chunk_weight_by_format(self) -> None:
        idx = self._idx()
        idx.add_individual(_ind("1", {"active": True, "name": "rush"}))
        chunks = list(idx._chunks.values())
        weights = sorted([c.weight for c in chunks])
        # BOOLEAN weight < STRING weight
        assert weights[0] < weights[-1]


class TestRagRetriever:
    def _idx_with(self, inds: list[Individual]) -> RagIndex:
        idx = RagIndex()
        for ind in inds:
            idx.add_individual(ind)
        return idx

    def test_token_overlap_match(self) -> None:
        idx = self._idx_with([
            _ind("1", {"note": "this is a rush order"}),
            _ind("2", {"note": "regular order"}),
        ])
        r = RagRetriever(idx)
        hits = r.retrieve(RagQuery(
            object_set=ObjectSet(class_rid=_cls(), filter_expr=""),
            text="rush order",
            top_k=5,
        ))
        assert len(hits) >= 1
        # rank 1 = chunk with most overlap
        assert "1" in hits[0].chunk.individual_rid

    def test_filter_by_class(self) -> None:
        idx = RagIndex()
        idx.add_individual(_ind("1", {"note": "rush invoice"}))
        # query against a *different* class — should return nothing
        r = RagRetriever(idx)
        other_cls = ClassRef(rid="ont.acme.cls.invoice.v1")
        hits = r.retrieve(RagQuery(
            object_set=ObjectSet(class_rid=other_cls, filter_expr=""),
            text="rush",
        ))
        assert hits == []

    def test_top_k_limit(self) -> None:
        idx = self._idx_with([
            _ind(str(i), {"note": "rush"}) for i in range(10)
        ])
        r = RagRetriever(idx)
        hits = r.retrieve(RagQuery(
            object_set=ObjectSet(class_rid=_cls(), filter_expr=""),
            text="rush",
            top_k=3,
        ))
        assert len(hits) == 3

    def test_empty_query_returns_nothing(self) -> None:
        idx = self._idx_with([_ind("1", {"note": "x"})])
        r = RagRetriever(idx)
        hits = r.retrieve(RagQuery(
            object_set=ObjectSet(class_rid=_cls(), filter_expr=""),
            text="",
        ))
        assert hits == []

    def test_no_match_returns_nothing(self) -> None:
        idx = self._idx_with([_ind("1", {"note": "completely unrelated content"})])
        r = RagRetriever(idx)
        hits = r.retrieve(RagQuery(
            object_set=ObjectSet(class_rid=_cls(), filter_expr=""),
            text="rush",
        ))
        assert hits == []

    def test_matched_terms_recorded(self) -> None:
        idx = self._idx_with([_ind("1", {"note": "rush special order"})])
        r = RagRetriever(idx)
        hits = r.retrieve(RagQuery(
            object_set=ObjectSet(class_rid=_cls(), filter_expr=""),
            text="rush order",
        ))
        assert len(hits) == 1
        assert "rush" in hits[0].matched_terms
        assert "order" in hits[0].matched_terms
