"""Tenant-scoped document registry for the RAG domain (BUSINESS-SLICES).

Tracks which tenant owns which ``document_id`` and the document
lifecycle (``INGESTING -> INDEXED | FAILED``). This is the
business-logic layer that enforces ADR-0014 cross-tenant isolation on
top of the shared in-memory vector-store clients: even though the
underlying InMemoryHybridClient / GraphRAGClient are global
singletons, the registry lets the search handler filter hits to only
those documents the requesting tenant owns.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass


@dataclass
class DocumentRecord:
    """Lifecycle record for an ingested document."""

    tenant_id: str
    document_id: str
    status: str  # INGESTING | INDEXED | FAILED
    chunk_count: int = 0
    size_bytes: int = 0
    filename: str = ""
    source: str = ""  # upload | ingest | parse
    created_at: float = 0.0
    updated_at: float = 0.0
    error: str = ""


_REGISTRY: dict[str, dict[str, DocumentRecord]] = {}
_lock = threading.Lock()


def _now() -> float:
    return time.time()


def register_document(
    tenant_id: str,
    document_id: str,
    *,
    filename: str = "",
    size_bytes: int = 0,
    source: str = "ingest",
) -> DocumentRecord:
    """Register a new document in INGESTING state."""
    with _lock:
        store = _REGISTRY.setdefault(tenant_id, {})
        now = _now()
        rec = DocumentRecord(
            tenant_id=tenant_id,
            document_id=document_id,
            status="INGESTING",
            filename=filename,
            size_bytes=size_bytes,
            source=source,
            created_at=now,
            updated_at=now,
        )
        store[document_id] = rec
        return rec


def mark_indexed(
    tenant_id: str, document_id: str, chunk_count: int
) -> DocumentRecord | None:
    """Transition a document to INDEXED after successful fan-out."""
    with _lock:
        store = _REGISTRY.setdefault(tenant_id, {})
        rec = store.get(document_id)
        if rec is None:
            return None
        rec.status = "INDEXED"
        rec.chunk_count = chunk_count
        rec.updated_at = _now()
        return rec


def mark_failed(
    tenant_id: str, document_id: str, error: str
) -> DocumentRecord | None:
    """Transition a document to FAILED."""
    with _lock:
        store = _REGISTRY.setdefault(tenant_id, {})
        rec = store.get(document_id)
        if rec is None:
            return None
        rec.status = "FAILED"
        rec.error = error
        rec.updated_at = _now()
        return rec


def get_document(tenant_id: str, document_id: str) -> DocumentRecord | None:
    with _lock:
        return _REGISTRY.get(tenant_id, {}).get(document_id)


def list_documents(tenant_id: str) -> list[DocumentRecord]:
    with _lock:
        store = _REGISTRY.setdefault(tenant_id, {})
        return sorted(store.values(), key=lambda r: r.created_at)


def owns_document(tenant_id: str, document_id: str) -> bool:
    with _lock:
        return document_id in _REGISTRY.get(tenant_id, {})


def tenant_document_ids(tenant_id: str) -> set[str]:
    """Return the set of document_ids owned by ``tenant_id``."""
    with _lock:
        return set(_REGISTRY.get(tenant_id, {}).keys())


def document_count(tenant_id: str) -> int:
    with _lock:
        return len(_REGISTRY.get(tenant_id, {}))


def reset_registry() -> None:
    """Drop all records. Used by tests to keep cases isolated."""
    with _lock:
        _REGISTRY.clear()
