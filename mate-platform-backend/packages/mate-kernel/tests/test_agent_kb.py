"""AGENT-KB-01 Knowledge Library 数字员工测试。"""

from __future__ import annotations

import pytest

from mate_kernel.agent.kb import KbDocument, KnowledgeLibraryAgent
from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.rag.ontology import RagIndex, RagQuery


def _ctx() -> ManagerContext:
    return ManagerContext(user_id="alice", tenant_id="acme", session_id="s-1")


def _cls(slug: str = "order") -> ClassRef:
    return ClassRef(rid=f"ont.acme.cls.{slug}.v1")


def _doc(rid: str, body: str, classes: tuple[str, ...] = (), title: str = "") -> KbDocument:
    return KbDocument(
        doc_rid=rid,
        title=title or rid.split(".")[3],
        body_markdown=body,
        linked_class_rids=classes,
    )


class TestKbDocument:
    def test_tokens(self) -> None:
        d = _doc("kb.acme.doc.x.v1", "rush order special handling")
        assert "rush" in d.tokens()
        assert "special" in d.tokens()


class TestKnowledgeLibraryAgent:
    def _a(self) -> KnowledgeLibraryAgent:
        return KnowledgeLibraryAgent()

    def test_add_and_get(self) -> None:
        a = self._a()
        d = _doc("kb.acme.doc.x.v1", "body")
        a.add_document(d, Manager(_ctx()))
        assert a.get(d.doc_rid) is d

    def test_add_duplicate_raises(self) -> None:
        a = self._a()
        d = _doc("kb.acme.doc.x.v1", "body")
        a.add_document(d, Manager(_ctx()))
        with pytest.raises(ValueError, match="already exists"):
            a.add_document(d, Manager(_ctx()))

    def test_for_class(self) -> None:
        a = self._a()
        cls = _cls()
        a.add_document(_doc("kb.acme.doc.a.v1", "a", classes=(cls.rid,)), Manager(_ctx()))
        a.add_document(_doc("kb.acme.doc.b.v1", "b", classes=(cls.rid,)), Manager(_ctx()))
        a.add_document(_doc("kb.acme.doc.c.v1", "c"), Manager(_ctx()))
        docs = a.for_class(cls)
        assert len(docs) == 2

    def test_retrieve_class_linked_priority(self) -> None:
        a = self._a()
        cls = _cls()
        # linked doc → 优先级 2.0；text-only doc 最高 1.0
        a.add_document(_doc("kb.acme.doc.linked.v1", "unrelated text", classes=(cls.rid,)), Manager(_ctx()))
        a.add_document(_doc("kb.acme.doc.text.v1", "order management guide"), Manager(_ctx()))
        hits = a.retrieve("order guide", object_set=ObjectSet(class_rid=cls, filter_expr=""))
        assert len(hits) == 2
        # class-link 优先
        assert hits[0].matched_via_class is True
        assert hits[0].document.doc_rid == "kb.acme.doc.linked.v1"

    def test_retrieve_text_only(self) -> None:
        a = self._a()
        a.add_document(_doc("kb.acme.doc.a.v1", "rush order priority"), Manager(_ctx()))
        a.add_document(_doc("kb.acme.doc.b.v1", "totally unrelated"), Manager(_ctx()))
        hits = a.retrieve("rush order")
        assert len(hits) == 1
        assert hits[0].document.doc_rid == "kb.acme.doc.a.v1"
        assert "rush" in hits[0].matched_terms

    def test_retrieve_empty_query(self) -> None:
        a = self._a()
        a.add_document(_doc("kb.acme.doc.x.v1", "anything"), Manager(_ctx()))
        assert a.retrieve("") == []

    def test_combined_retrieve(self) -> None:
        a = self._a()
        cls = _cls()
        a.add_document(_doc("kb.acme.doc.a.v1", "rush order policy", classes=(cls.rid,)), Manager(_ctx()))
        rag = RagIndex()
        hits_rag, hits_kb = a.combined_retrieve(
            rag_query=RagQuery(object_set=ObjectSet(class_rid=cls, filter_expr=""), text="rush"),
            kb_query="rush",
        )
        assert hits_kb[0].matched_via_class is True


class TestSelectorRoutedToKb:
    def test_kb_rid_routes_to_kb(self) -> None:
        from mate_kernel.agent.orchestrator import AgentRole, AgentSelector
        assert AgentSelector().select("kb.acme.doc.manual.v1") == AgentRole.KNOWLEDGE
