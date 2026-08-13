"""In-memory repository for the kb domain (P3-W4 TD-5).

Entities: KbCollection, KbDocument, KbSearchLog.
The kb facade persists its own metadata (collections, document index,
search audit log) separate from the underlying RAG/Agent stores.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class KbCollection:
    id: str
    tenant_id: str
    name: str = ""
    description: str = ""
    document_count: int = 0
    status: str = "active"
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class KbDocument:
    id: str
    tenant_id: str
    collection_id: str = ""
    document_id: str = ""
    filename: str = ""
    size_bytes: int = 0
    chunk_count: int = 0
    status: str = "indexed"
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class KbSearchLog:
    id: str
    tenant_id: str
    query: str = ""
    mode: str = "hybrid"
    total_hits: int = 0
    latency_ms: int = 0
    created_at: str = ""


@dataclass(frozen=True)
class KbRetrievalConfig:
    """Tenant-scoped global retrieval configuration (knowledge/config page).

    Persisted as the default retrieval behaviour for the tenant. The fields
    the in-memory RAG backend can actually honour at search time are
    ``mode`` / ``rerank_strategy`` / ``top_k``; the chunking + weight fields
    are stored so the UI round-trips and take effect once the full
    (RAG_MODE=hybrid|graph|full) stack is wired.
    """

    tenant_id: str
    mode: str = "AUTO"
    rerank_strategy: str = "identity"
    top_k: int = 10
    similarity_threshold: float = 0.0
    chunk_strategy: str = "recursive"
    chunk_size: int = 512
    chunk_overlap: int = 64
    vector_weight: float = 0.7
    keyword_weight: float = 0.3
    reranker_enabled: bool = True
    show_citations: bool = True
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_collections(tenant_id: str) -> dict[str, KbCollection]:
    catalog = [
        ("kb-sales", "Sales KB", "Sales knowledge base", 12, "active"),
        ("kb-research", "Research KB", "Research documents", 8, "active"),
        ("kb-ops", "Ops KB", "Operations manual", 5, "active"),
    ]
    return {
        cid: KbCollection(
            id=cid, tenant_id=tenant_id, name=name, description=desc,
            document_count=count, status=st, config={"embedder": "text-embedding-3-small"},
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for cid, name, desc, count, st in catalog
    }


def _seed_documents(tenant_id: str) -> dict[str, KbDocument]:
    catalog = [
        ("doc-1", "kb-sales", "doc-1", "sales_q3.md", 4096, 12, "indexed"),
        ("doc-2", "kb-sales", "doc-2", "sales_guide.md", 8192, 20, "indexed"),
        ("doc-3", "kb-research", "doc-3", "ai_trends.pdf", 16384, 35, "indexed"),
    ]
    return {
        did: KbDocument(
            id=did, tenant_id=tenant_id, collection_id=col, document_id=doid,
            filename=fn, size_bytes=sz, chunk_count=cc, status=st,
            metadata={"source": "upload"},
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for did, col, doid, fn, sz, cc, st in catalog
    }


def _seed_search_logs(tenant_id: str) -> dict[str, KbSearchLog]:
    catalog = [
        ("log-1", "sales trend Q3", "hybrid", 5, 120),
        ("log-2", "AI research papers", "vector", 3, 85),
    ]
    return {
        lid: KbSearchLog(
            id=lid, tenant_id=tenant_id, query=q, mode=m,
            total_hits=th, latency_ms=lm,
            created_at="2026-08-01T00:00:00Z",
        )
        for lid, q, m, th, lm in catalog
    }


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
_COLLECTIONS: dict[str, dict[str, KbCollection]] = {}
_DOCUMENTS: dict[str, dict[str, KbDocument]] = {}
_SEARCH_LOGS: dict[str, dict[str, KbSearchLog]] = {}
_RETRIEVAL_CONFIGS: dict[str, KbRetrievalConfig] = {}


def _ensure_tenant(tenant_id: str) -> None:
    if not tenant_id:
        return
    if tenant_id not in _COLLECTIONS:
        _COLLECTIONS[tenant_id] = _seed_collections(tenant_id)
    if tenant_id not in _DOCUMENTS:
        _DOCUMENTS[tenant_id] = _seed_documents(tenant_id)
    if tenant_id not in _SEARCH_LOGS:
        _SEARCH_LOGS[tenant_id] = _seed_search_logs(tenant_id)


def list_collections(tenant_id: str) -> list[KbCollection]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_COLLECTIONS[tenant_id].values(), key=lambda x: x.id)


def get_collection(tenant_id: str, cid: str) -> KbCollection | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _COLLECTIONS[tenant_id].get(cid)


def list_documents(tenant_id: str) -> list[KbDocument]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_DOCUMENTS[tenant_id].values(), key=lambda x: x.id)


def get_document(tenant_id: str, did: str) -> KbDocument | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _DOCUMENTS[tenant_id].get(did)


def list_search_logs(tenant_id: str) -> list[KbSearchLog]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_SEARCH_LOGS[tenant_id].values(), key=lambda x: x.id)


def get_search_log(tenant_id: str, lid: str) -> KbSearchLog | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _SEARCH_LOGS[tenant_id].get(lid)


def put_collection(tenant_id: str, col: KbCollection) -> KbCollection:
    if not tenant_id:
        return col
    _ensure_tenant(tenant_id)
    _COLLECTIONS[tenant_id][col.id] = col
    return col


def delete_collection(tenant_id: str, cid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if cid not in _COLLECTIONS[tenant_id]:
        return False
    del _COLLECTIONS[tenant_id][cid]
    return True


def put_document(tenant_id: str, doc: KbDocument) -> KbDocument:
    if not tenant_id:
        return doc
    _ensure_tenant(tenant_id)
    _DOCUMENTS[tenant_id][doc.id] = doc
    return doc


def delete_document(tenant_id: str, did: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if did not in _DOCUMENTS[tenant_id]:
        return False
    del _DOCUMENTS[tenant_id][did]
    return True


def put_search_log(tenant_id: str, log: KbSearchLog) -> KbSearchLog:
    if not tenant_id:
        return log
    _ensure_tenant(tenant_id)
    _SEARCH_LOGS[tenant_id][log.id] = log
    return log


def delete_search_log(tenant_id: str, lid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if lid not in _SEARCH_LOGS[tenant_id]:
        return False
    del _SEARCH_LOGS[tenant_id][lid]
    return True


def get_retrieval_config(tenant_id: str) -> KbRetrievalConfig:
    """Return the tenant's retrieval config, creating the default on first access."""
    if not tenant_id:
        return KbRetrievalConfig(tenant_id="")
    cfg = _RETRIEVAL_CONFIGS.get(tenant_id)
    if cfg is None:
        cfg = KbRetrievalConfig(tenant_id=tenant_id)
        _RETRIEVAL_CONFIGS[tenant_id] = cfg
    return cfg


def put_retrieval_config(tenant_id: str, cfg: KbRetrievalConfig) -> KbRetrievalConfig:
    if not tenant_id:
        return cfg
    _RETRIEVAL_CONFIGS[tenant_id] = cfg
    return cfg


def reset_store() -> None:
    _COLLECTIONS.clear()
    _DOCUMENTS.clear()
    _SEARCH_LOGS.clear()
    _RETRIEVAL_CONFIGS.clear()
