"""In-memory repository for the rag domain (P3-W4 TD-5).

Data shape:
    _DOCUMENTS / _INDEXES:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = entity dataclass

The store is tenant-scoped: callers MUST pass the tenant binding
and lookups reject entities that don't belong to that tenant.

Seed data:
    >= 3 documents, >= 3 indexes per tenant.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Entity dataclasses
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class RagDocument:
    id: str
    tenant_id: str
    document_id: str
    filename: str = ""
    chunk_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)
    status: str = "indexed"  # indexed / parsing / failed
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class RagIndex:
    id: str
    tenant_id: str
    name: str
    backend: str = "memory"  # memory / milvus / neo4j / lightrag
    chunk_count: int = 0
    status: str = "active"
    created_at: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_documents(tenant_id: str) -> dict[str, RagDocument]:
    catalog: list[tuple[str, str, str, int, str]] = [
        ("doc-1", "doc-1", "manual.md", 12, "indexed"),
        ("doc-2", "doc-2", "faq.md", 8, "indexed"),
        ("doc-3", "doc-3", "spec.md", 20, "parsing"),
    ]
    return {
        did: RagDocument(
            id=did, tenant_id=tenant_id, document_id=did_doc,
            filename=fname, chunk_count=cc, status=st,
            metadata={"source": "seed"},
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for did, did_doc, fname, cc, st in catalog
    }


def _seed_indexes(tenant_id: str) -> dict[str, RagIndex]:
    catalog: list[tuple[str, str, str, int]] = [
        ("idx-hybrid", "hybrid", "milvus", 40),
        ("idx-graph", "graph", "neo4j", 40),
        ("idx-lightrag", "lightrag", "lightrag", 40),
    ]
    return {
        iid: RagIndex(
            id=iid, tenant_id=tenant_id, name=name,
            backend=backend, chunk_count=cc,
            created_at="2026-08-01T00:00:00Z",
        )
        for iid, name, backend, cc in catalog
    }


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
_DOCUMENTS: dict[str, dict[str, RagDocument]] = {}
_INDEXES: dict[str, dict[str, RagIndex]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    if not tenant_id:
        return
    if tenant_id not in _DOCUMENTS:
        _DOCUMENTS[tenant_id] = _seed_documents(tenant_id)
    if tenant_id not in _INDEXES:
        _INDEXES[tenant_id] = _seed_indexes(tenant_id)


# ---------------------------------------------------------------------------
# Public read API — documents
# ---------------------------------------------------------------------------
def list_documents(tenant_id: str) -> list[RagDocument]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_DOCUMENTS[tenant_id].values(), key=lambda x: x.id)


def get_document(tenant_id: str, doc_id: str) -> RagDocument | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _DOCUMENTS[tenant_id].get(doc_id)


# ---------------------------------------------------------------------------
# Public read API — indexes
# ---------------------------------------------------------------------------
def list_indexes(tenant_id: str) -> list[RagIndex]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_INDEXES[tenant_id].values(), key=lambda x: x.id)


def get_index(tenant_id: str, index_id: str) -> RagIndex | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _INDEXES[tenant_id].get(index_id)


# ---------------------------------------------------------------------------
# Public write API — documents
# ---------------------------------------------------------------------------
def put_document(tenant_id: str, doc: RagDocument) -> RagDocument:
    if not tenant_id:
        return doc
    _ensure_tenant(tenant_id)
    _DOCUMENTS[tenant_id][doc.id] = doc
    return doc


def delete_document(tenant_id: str, doc_id: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if doc_id not in _DOCUMENTS[tenant_id]:
        return False
    del _DOCUMENTS[tenant_id][doc_id]
    return True


# ---------------------------------------------------------------------------
# Public write API — indexes
# ---------------------------------------------------------------------------
def put_index(tenant_id: str, idx: RagIndex) -> RagIndex:
    if not tenant_id:
        return idx
    _ensure_tenant(tenant_id)
    _INDEXES[tenant_id][idx.id] = idx
    return idx


def delete_index(tenant_id: str, index_id: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if index_id not in _INDEXES[tenant_id]:
        return False
    del _INDEXES[tenant_id][index_id]
    return True


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------
def reset_store() -> None:
    _DOCUMENTS.clear()
    _INDEXES.clear()
