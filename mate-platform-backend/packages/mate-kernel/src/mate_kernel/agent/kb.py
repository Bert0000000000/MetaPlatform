"""AGENT-KB-01: Knowledge Library 数字员工。

7+1 中的「Knowledge Library 员工」—— 把知识库文档（kb.*）链接到 ObjectType，
与 RAG-ONT-01 联合检索：先用 ObjectSet 精确过滤，再用 KB 文档补充上下文。
- KbDocument：文档 / Wiki / FAQ（带 markdown body + linked_class_rids）
- KbIndex：按 ObjectType 反查文档
- 检索：query(ObjectSet) → 文档命中 + chunk 命中（合并去重）

M3 范围：内存版索引；不做文档解析（markdown 入库前已是 chunk）。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.rag.ontology import RagChunk, RagHit, RagIndex, RagQuery, RagRetriever


@dataclass(frozen=True, slots=True)
class KbDocument:
    """kb.<tenant>.doc.<slug>.v<n>"""
    doc_rid: str
    title: str
    body_markdown: str
    linked_class_rids: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def tokens(self) -> set[str]:
        return set(re.findall(r"[\w一-鿿]+", (self.title + " " + self.body_markdown).lower()))


@dataclass(frozen=True, slots=True)
class KbHit:
    document: KbDocument
    score: float
    matched_terms: tuple[str, ...] = ()
    matched_via_class: bool = False  # True = ObjectSet 链接命中；False = 文本


class KnowledgeLibraryAgent:
    """KB 数字员工 = 文档库 + 与 RAG-ONT 联合检索。"""

    def __init__(self, rag: RagIndex | None = None) -> None:
        self.rag = rag or RagIndex()
        self._docs: dict[str, KbDocument] = {}
        # 反向索引
        self._by_class: dict[str, list[str]] = {}

    def add_document(self, doc: KbDocument, manager: Manager) -> None:
        if doc.doc_rid in self._docs:
            raise ValueError(f"doc already exists: {doc.doc_rid}")
        self._docs[doc.doc_rid] = doc
        for cls in doc.linked_class_rids:
            self._by_class.setdefault(cls, []).append(doc.doc_rid)
        manager.track(
            kind=__import__("mate_kernel.manager.protocol", fromlist=["ChangeKind"]).ChangeKind.REGISTER_CLASS,
            target_rid=doc.doc_rid,
            payload={"classes": list(doc.linked_class_rids)},
        )

    def get(self, doc_rid: str) -> KbDocument:
        d = self._docs.get(doc_rid)
        if d is None:
            raise KeyError(f"doc not found: {doc_rid}")
        return d

    def for_class(self, class_rid: ClassRef) -> tuple[KbDocument, ...]:
        rids = self._by_class.get(class_rid.rid, [])
        return tuple(self._docs[r] for r in rids)

    def retrieve(
        self,
        query: str,
        object_set: ObjectSet | None = None,
        top_k: int = 5,
    ) -> list[KbHit]:
        """联合检索：先 class link 命中，再 token overlap。"""
        query_tokens = set(re.findall(r"[\w一-鿿]+", query.lower()))
        if not query_tokens:
            return []
        class_link_rids: set[str] = set()
        if object_set is not None:
            class_link_rids = set(self._by_class.get(object_set.class_rid.rid, []))

        hits: dict[str, KbHit] = {}
        # 1) class link → 命中（高优先级）
        for rid in class_link_rids:
            doc = self._docs[rid]
            hits[rid] = KbHit(
                document=doc,
                score=2.0,
                matched_terms=(),
                matched_via_class=True,
            )
        # 2) token overlap
        for doc in self._docs.values():
            if doc.doc_rid in class_link_rids:
                continue
            overlap = query_tokens & doc.tokens()
            if not overlap:
                continue
            score = len(overlap) / len(query_tokens)
            hits[doc.doc_rid] = KbHit(
                document=doc,
                score=score,
                matched_terms=tuple(sorted(overlap)),
                matched_via_class=False,
            )

        ranked = sorted(hits.values(), key=lambda h: h.score, reverse=True)
        return ranked[:top_k]

    def combined_retrieve(
        self,
        rag_query: RagQuery,
        kb_query: str,
        kb_top_k: int = 5,
    ) -> tuple[list[RagHit], list[KbHit]]:
        """与 RAG-ONT-01 联合：返回 RAG hits + KB hits。"""
        rag_hits = RagRetriever(self.rag).retrieve(rag_query)
        kb_hits = self.retrieve(kb_query, object_set=rag_query.object_set, top_k=kb_top_k)
        return rag_hits, kb_hits


__all__ = [
    "KbDocument",
    "KbHit",
    "KnowledgeLibraryAgent",
]
