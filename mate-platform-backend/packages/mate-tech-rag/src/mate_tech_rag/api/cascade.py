"""Cascade delete helper for mate-tech-rag (P1.7 RAG 增强).

Goal: a DELETE call from upstream (mate-app-kb / mate-tech-dw / direct)
must clear ALL traces of ``document_id`` so that follow-up searches
return 0 hits.

The RAG surface is:
  - index metadata in `mate_tech_rag.repositories.in_memory._DOCUMENTS`
    (catalog of RagDocument dataclasses)
  - lifecycle / ownership in `mate_tech_rag.api.document_registry`
    (controls ``tenant_document_ids`` → drives search hit filtering)
  - content stores (3 singletons, all keyed by ``document_id``):
      - hybrid vector store (Milvus / InMemoryVectorStore)
      - graph entity store (Neo4j / InMemoryGraphRAGClient)
      - lightrag thematic bucket (LightRAG / InMemoryLightRAGClient)
  - PG BM25 store (only if configured via RAG_MODE=hybrid|full +
    PG_DSN set)

The cascade deletion drops chunks from each store, removes the catalog
row, and removes the lifecycle record so the next search returns 0 hits
even if any single store was unavailable.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

_log = logging.getLogger(__name__)


@dataclass
class CascadeDeleteResult:
    """Small summary returned by `delete_document_cascade`."""

    deleted: bool
    document_id: str
    chunks_removed: int = 0
    graph_tuples_removed: int = 0
    lightrag_chunks_removed: int = 0
    pg_chunks_removed: int = 0
    catalog_removed: bool = False
    registry_removed: bool = False

    def as_dict(self) -> dict:
        return {
            "deleted": self.deleted,
            "document_id": self.document_id,
            "chunks_removed": self.chunks_removed,
            "graph_tuples_removed": self.graph_tuples_removed,
            "lightrag_chunks_removed": self.lightrag_chunks_removed,
            "pg_chunks_removed": self.pg_chunks_removed,
            "catalog_removed": self.catalog_removed,
            "registry_removed": self.registry_removed,
        }


def delete_document_cascade(tenant_id: str, document_id: str) -> CascadeDeleteResult:
    """Cascade-delete ``document_id`` from the RAG surface for ``tenant_id``.

    Returns a `CascadeDeleteResult` whose `deleted` flag indicates whether
    any partial work was performed (catalog row OR lifecycle record OR
    at least one chunk removed). If ``deleted`` is False the document was
    not present in any tracking layer (idempotent: nothing to do).
    """
    result = CascadeDeleteResult(deleted=False, document_id=document_id)
    if not document_id:
        return result
    kb_membership_removed = False

    # 1. Drop chunks from the 3 content stores (best-effort).
    try:
        from mate_tech_rag.api.retrieval import (
            get_graph,
            get_hybrid,
            get_lightrag,
            get_pg_store,
        )

        hybrid = get_hybrid()
        if hasattr(hybrid, "delete_by_document"):
            result.chunks_removed = hybrid.delete_by_document(document_id)

        graph = get_graph()
        if hasattr(graph, "delete_by_document"):
            result.graph_tuples_removed = graph.delete_by_document(document_id)

        lightrag = get_lightrag()
        if hasattr(lightrag, "delete_by_document"):
            result.lightrag_chunks_removed = lightrag.delete_by_document(document_id)

        # Optional PG BM25 store.
        pg_store = get_pg_store()
        if pg_store is not None:
            try:
                removed = pg_store.delete_document(document_id)
                result.pg_chunks_removed = int(removed or 0)
            except Exception as exc:  # noqa: BLE001 — best-effort
                _log.debug("PG cascade delete skipped: %s", exc)

        # Persistent kb membership rows (RAG_MODE=pg only) so a re-uploaded
        # document under the same kb_id doesn't keep a stale mapping.
        try:
            from mate_tech_rag.api.retrieval import is_pg_mode

            if is_pg_mode():
                from mate_tech_rag.storage.pg_ext_store import get_kb_document_store

                kb_store = get_kb_document_store()
                if kb_store.is_available():
                    kb_membership_removed = kb_store.delete_by_document(document_id) > 0
        except Exception as exc:  # noqa: BLE001 — best-effort
            _log.debug("cascade: kb_documents delete skipped: %s", exc)
    except Exception as exc:  # noqa: BLE001 — best-effort; index may be uninitialized
        _log.debug("cascade: store iteration failed: %s", exc)

    # 2. Drop catalog row (RagDocument).
    try:
        from mate_tech_rag.repositories import in_memory as mem

        result.catalog_removed = bool(mem.delete_document(tenant_id, document_id))
    except Exception as exc:  # noqa: BLE001 — best-effort
        _log.debug("cascade: catalog delete skipped: %s", exc)

    # 3. Drop lifecycle record (so search filter rejects the doc).
    try:
        from mate_tech_rag.api.document_registry import unregister_document

        result.registry_removed = bool(unregister_document(tenant_id, document_id))
    except Exception as exc:  # noqa: BLE001 — best-effort
        _log.debug("cascade: registry unregister skipped: %s", exc)

    result.deleted = (
        result.catalog_removed
        or result.registry_removed
        or result.chunks_removed > 0
        or result.graph_tuples_removed > 0
        or result.lightrag_chunks_removed > 0
        or result.pg_chunks_removed > 0
        or kb_membership_removed
    )
    return result
