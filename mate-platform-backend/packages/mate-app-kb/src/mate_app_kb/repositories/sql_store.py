"""SQL-backed repository for the kb domain (P3-W4 TD-5) — SQLAlchemy 2.0.

Provides read + write for ``KbCollection``, ``KbDocument``, ``KbSearchLog``
plus the tenant retrieval-config + version snapshots (KB_STORE=sql). Dict
fields (``KbCollection.config``, ``KbDocument.metadata``) are
JSON-serialised to TEXT. The ``metadata`` attribute is stored as ``meta``
to avoid the SQLAlchemy-reserved ``metadata`` name.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from mate_tech_db.base import Base, get_session  # noqa: F401

from . import sql_models as models
from .in_memory import (
    KbCollection,
    KbDocument,
    KbRetrievalConfig,
    KbRetrievalConfigSnapshot,
    KbSearchLog,
)

# Parity with in_memory._SNAPSHOT_LIMIT — history is FIFO-capped at 10.
_SNAPSHOT_LIMIT = 10


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _json_dumps(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _json_loads(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}


# ---------------------------------------------------------------------------
# ORM -> dataclass helpers
# ---------------------------------------------------------------------------
def _orm_to_collection(row: models.KbCollectionORM) -> KbCollection:
    return KbCollection(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        description=row.description or "",
        document_count=row.document_count or 0,
        status=row.status or "active",
        config=_json_loads(row.config),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_document(row: models.KbDocumentORM) -> KbDocument:
    return KbDocument(
        id=row.id,
        tenant_id=row.tenant_id,
        collection_id=row.collection_id or "",
        document_id=row.document_id or "",
        filename=row.filename or "",
        size_bytes=row.size_bytes or 0,
        chunk_count=row.chunk_count or 0,
        status=row.status or "indexed",
        metadata=_json_loads(row.meta),
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_search_log(row: models.KbSearchLogORM) -> KbSearchLog:
    return KbSearchLog(
        id=row.id,
        tenant_id=row.tenant_id,
        query=row.query or "",
        mode=row.mode or "hybrid",
        total_hits=row.total_hits or 0,
        latency_ms=row.latency_ms or 0,
        created_at=row.created_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — collections
# ---------------------------------------------------------------------------
def list_collections(tenant_id: str) -> list[KbCollection]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.KbCollectionORM)
        .where(models.KbCollectionORM.tenant_id == tenant_id)
        .order_by(models.KbCollectionORM.id)
    ).scalars().all()
    return [_orm_to_collection(r) for r in rows]


def get_collection(tenant_id: str, cid: str) -> KbCollection | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.KbCollectionORM).where(
            models.KbCollectionORM.tenant_id == tenant_id,
            models.KbCollectionORM.id == cid,
        )
    ).scalar_one_or_none()
    return _orm_to_collection(row) if row else None


# ---------------------------------------------------------------------------
# Read API — documents
# ---------------------------------------------------------------------------
def list_documents(tenant_id: str) -> list[KbDocument]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.KbDocumentORM)
        .where(models.KbDocumentORM.tenant_id == tenant_id)
        .order_by(models.KbDocumentORM.id)
    ).scalars().all()
    return [_orm_to_document(r) for r in rows]


def get_document(tenant_id: str, did: str) -> KbDocument | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.KbDocumentORM).where(
            models.KbDocumentORM.tenant_id == tenant_id,
            models.KbDocumentORM.id == did,
        )
    ).scalar_one_or_none()
    return _orm_to_document(row) if row else None


# ---------------------------------------------------------------------------
# Read API — search logs
# ---------------------------------------------------------------------------
def list_search_logs(tenant_id: str) -> list[KbSearchLog]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.KbSearchLogORM)
        .where(models.KbSearchLogORM.tenant_id == tenant_id)
        .order_by(models.KbSearchLogORM.id)
    ).scalars().all()
    return [_orm_to_search_log(r) for r in rows]


def get_search_log(tenant_id: str, lid: str) -> KbSearchLog | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.KbSearchLogORM).where(
            models.KbSearchLogORM.tenant_id == tenant_id,
            models.KbSearchLogORM.id == lid,
        )
    ).scalar_one_or_none()
    return _orm_to_search_log(row) if row else None


# ---------------------------------------------------------------------------
# Write API — collections
# ---------------------------------------------------------------------------
def put_collection(tenant_id: str, col: KbCollection) -> KbCollection:
    if not tenant_id:
        return col
    s = _session()
    config_str = _json_dumps(col.config)
    existing = s.get(models.KbCollectionORM, col.id)
    if existing:
        existing.name = col.name
        existing.description = col.description
        existing.document_count = col.document_count
        existing.status = col.status
        existing.config = config_str
        existing.updated_at = col.updated_at
    else:
        s.add(models.KbCollectionORM(
            id=col.id, tenant_id=tenant_id, name=col.name,
            description=col.description, document_count=col.document_count,
            status=col.status, config=config_str,
            created_at=col.created_at, updated_at=col.updated_at,
        ))
    s.commit()
    return col


def delete_collection(tenant_id: str, cid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.KbCollectionORM).where(
            models.KbCollectionORM.tenant_id == tenant_id,
            models.KbCollectionORM.id == cid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — documents
# ---------------------------------------------------------------------------
def put_document(tenant_id: str, doc: KbDocument) -> KbDocument:
    if not tenant_id:
        return doc
    s = _session()
    meta_str = _json_dumps(doc.metadata)
    existing = s.get(models.KbDocumentORM, doc.id)
    if existing:
        existing.collection_id = doc.collection_id
        existing.document_id = doc.document_id
        existing.filename = doc.filename
        existing.size_bytes = doc.size_bytes
        existing.chunk_count = doc.chunk_count
        existing.status = doc.status
        existing.meta = meta_str
        existing.updated_at = doc.updated_at
    else:
        s.add(models.KbDocumentORM(
            id=doc.id, tenant_id=tenant_id, collection_id=doc.collection_id,
            document_id=doc.document_id, filename=doc.filename,
            size_bytes=doc.size_bytes, chunk_count=doc.chunk_count,
            status=doc.status, meta=meta_str,
            created_at=doc.created_at, updated_at=doc.updated_at,
        ))
    s.commit()
    return doc


def delete_document(tenant_id: str, did: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.KbDocumentORM).where(
            models.KbDocumentORM.tenant_id == tenant_id,
            models.KbDocumentORM.id == did,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — search logs
# ---------------------------------------------------------------------------
def put_search_log(tenant_id: str, log: KbSearchLog) -> KbSearchLog:
    if not tenant_id:
        return log
    s = _session()
    existing = s.get(models.KbSearchLogORM, log.id)
    if existing:
        existing.query = log.query
        existing.mode = log.mode
        existing.total_hits = log.total_hits
        existing.latency_ms = log.latency_ms
        existing.created_at = log.created_at
    else:
        s.add(models.KbSearchLogORM(
            id=log.id, tenant_id=tenant_id, query=log.query,
            mode=log.mode, total_hits=log.total_hits,
            latency_ms=log.latency_ms, created_at=log.created_at,
        ))
    s.commit()
    return log


def delete_search_log(tenant_id: str, lid: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.KbSearchLogORM).where(
            models.KbSearchLogORM.tenant_id == tenant_id,
            models.KbSearchLogORM.id == lid,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# ORM -> dataclass helpers — retrieval config + snapshots
# ---------------------------------------------------------------------------
# NOTE: all columns below are non-nullable Mapped[str|int|float|bool], so no
# None guards are needed; string ``or`` fallbacks only guard empty strings
# (same style as the collection/document mappers above).
def _orm_to_retrieval_config(row: models.KbRetrievalConfigORM) -> KbRetrievalConfig:
    return KbRetrievalConfig(
        tenant_id=row.tenant_id,
        mode=row.mode or "AUTO",
        rerank_strategy=row.rerank_strategy or "identity",
        top_k=row.top_k,
        similarity_threshold=row.similarity_threshold,
        chunk_strategy=row.chunk_strategy or "recursive",
        chunk_size=row.chunk_size,
        chunk_overlap=row.chunk_overlap,
        vector_weight=row.vector_weight,
        keyword_weight=row.keyword_weight,
        reranker_enabled=bool(row.reranker_enabled),
        show_citations=bool(row.show_citations),
        version=row.version,
        updated_at=row.updated_at or "",
    )


def _orm_to_snapshot(row: models.KbRetrievalConfigSnapshotORM) -> KbRetrievalConfigSnapshot:
    return KbRetrievalConfigSnapshot(
        id=row.id,
        tenant_id=row.tenant_id,
        version=row.version,
        mode=row.mode or "AUTO",
        rerank_strategy=row.rerank_strategy or "identity",
        top_k=row.top_k,
        similarity_threshold=row.similarity_threshold,
        chunk_strategy=row.chunk_strategy or "recursive",
        chunk_size=row.chunk_size,
        chunk_overlap=row.chunk_overlap,
        vector_weight=row.vector_weight,
        keyword_weight=row.keyword_weight,
        reranker_enabled=bool(row.reranker_enabled),
        show_citations=bool(row.show_citations),
        snapshot_at=row.snapshot_at or "",
    )


def _apply_retrieval_config(row: models.KbRetrievalConfigORM, cfg: KbRetrievalConfig) -> None:
    row.version = cfg.version
    row.mode = cfg.mode
    row.rerank_strategy = cfg.rerank_strategy
    row.top_k = cfg.top_k
    row.similarity_threshold = cfg.similarity_threshold
    row.chunk_strategy = cfg.chunk_strategy
    row.chunk_size = cfg.chunk_size
    row.chunk_overlap = cfg.chunk_overlap
    row.vector_weight = cfg.vector_weight
    row.keyword_weight = cfg.keyword_weight
    row.reranker_enabled = cfg.reranker_enabled
    row.show_citations = cfg.show_citations
    row.updated_at = cfg.updated_at


def _apply_snapshot(
    row: models.KbRetrievalConfigSnapshotORM, snap: KbRetrievalConfigSnapshot,
) -> None:
    row.tenant_id = snap.tenant_id
    row.version = snap.version
    row.mode = snap.mode
    row.rerank_strategy = snap.rerank_strategy
    row.top_k = snap.top_k
    row.similarity_threshold = snap.similarity_threshold
    row.chunk_strategy = snap.chunk_strategy
    row.chunk_size = snap.chunk_size
    row.chunk_overlap = snap.chunk_overlap
    row.vector_weight = snap.vector_weight
    row.keyword_weight = snap.keyword_weight
    row.reranker_enabled = snap.reranker_enabled
    row.show_citations = snap.show_citations
    row.snapshot_at = snap.snapshot_at


# ---------------------------------------------------------------------------
# Retrieval config — get / put (semantics mirror in_memory 1:1)
# ---------------------------------------------------------------------------
def get_retrieval_config(tenant_id: str) -> KbRetrievalConfig:
    """Return the tenant's config, materialising the default row on first access.

    Same semantics as ``in_memory.get_retrieval_config``: a missing tenant
    gets the default ``KbRetrievalConfig`` (``version=1``, blank
    ``updated_at`` — the API layer uses both to detect the first user
    save), which is persisted so the "never customised" state survives
    restarts. An empty ``tenant_id`` returns a transient default without
    touching the database.
    """
    if not tenant_id:
        return KbRetrievalConfig(tenant_id="")
    s = _session()
    row = s.get(models.KbRetrievalConfigORM, tenant_id)
    if row is None:
        cfg = KbRetrievalConfig(tenant_id=tenant_id)
        s.add(models.KbRetrievalConfigORM(
            tenant_id=tenant_id,
            version=cfg.version, mode=cfg.mode,
            rerank_strategy=cfg.rerank_strategy, top_k=cfg.top_k,
            similarity_threshold=cfg.similarity_threshold,
            chunk_strategy=cfg.chunk_strategy, chunk_size=cfg.chunk_size,
            chunk_overlap=cfg.chunk_overlap, vector_weight=cfg.vector_weight,
            keyword_weight=cfg.keyword_weight,
            reranker_enabled=cfg.reranker_enabled,
            show_citations=cfg.show_citations, updated_at=cfg.updated_at,
        ))
        s.commit()
        return cfg
    return _orm_to_retrieval_config(row)


def put_retrieval_config(tenant_id: str, cfg: KbRetrievalConfig) -> KbRetrievalConfig:
    """Upsert the tenant's config row and return ``cfg`` unchanged.

    Version bookkeeping stays in the API layer (``put_retrieval_cfg``);
    this function is a pure upsert, exactly like the in-memory one.
    """
    if not tenant_id:
        return cfg
    s = _session()
    existing = s.get(models.KbRetrievalConfigORM, tenant_id)
    if existing is not None:
        _apply_retrieval_config(existing, cfg)
    else:
        row = models.KbRetrievalConfigORM(tenant_id=tenant_id)
        _apply_retrieval_config(row, cfg)
        s.add(row)
    s.commit()
    return cfg


# ---------------------------------------------------------------------------
# Retrieval config — version snapshots (P1.8 history, FIFO cap 10)
# ---------------------------------------------------------------------------
def put_retrieval_config_snapshot(
    tenant_id: str, snapshot: KbRetrievalConfigSnapshot,
) -> KbRetrievalConfigSnapshot:
    """Append a snapshot to the tenant's history (FIFO-capped at 10).

    Same contract as ``in_memory.put_retrieval_config_snapshot``: callers
    snapshot the PRIOR config before saving the new one. Ordering follows
    the per-tenant insertion counter (``seq``) — not ``version`` and not
    ``snapshot_at`` — so the FIFO trim and newest-last listing behave like
    the in-memory append list. The ``{tenant}:{version}`` PK means a
    re-put of the same version refreshes that row in place (keeping its
    original seq) instead of duplicating it; the API never re-snapshots a
    version, so this is unobservable in practice.
    """
    if not tenant_id:
        return snapshot
    s = _session()
    existing = s.get(models.KbRetrievalConfigSnapshotORM, snapshot.id)
    if existing is not None:
        _apply_snapshot(existing, snapshot)
    else:
        next_seq = (s.execute(
            select(func.max(models.KbRetrievalConfigSnapshotORM.seq)).where(
                models.KbRetrievalConfigSnapshotORM.tenant_id == tenant_id
            )
        ).scalar() or 0) + 1
        row = models.KbRetrievalConfigSnapshotORM(id=snapshot.id, seq=next_seq)
        _apply_snapshot(row, snapshot)
        s.add(row)
    s.commit()
    # FIFO trim — keep the most recent _SNAPSHOT_LIMIT snapshots.
    rows = s.execute(
        select(models.KbRetrievalConfigSnapshotORM)
        .where(models.KbRetrievalConfigSnapshotORM.tenant_id == tenant_id)
        .order_by(models.KbRetrievalConfigSnapshotORM.seq)
    ).scalars().all()
    overflow = len(rows) - _SNAPSHOT_LIMIT
    if overflow > 0:
        for stale in rows[:overflow]:
            s.delete(stale)
        s.commit()
    return snapshot


def list_retrieval_config_snapshots(
    tenant_id: str, limit: int | None = None,
) -> list[KbRetrievalConfigSnapshot]:
    """Return the tenant's snapshot history, oldest first (newest last).

    ``limit`` caps the number of records returned, keeping the NEWEST
    ``max(1, limit)`` entries — identical to the in-memory
    ``history[-max(1, int(limit)):]`` slicing.
    """
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.KbRetrievalConfigSnapshotORM)
        .where(models.KbRetrievalConfigSnapshotORM.tenant_id == tenant_id)
        .order_by(models.KbRetrievalConfigSnapshotORM.seq)
    ).scalars().all()
    items = [_orm_to_snapshot(r) for r in rows]
    if limit is not None:
        return items[-max(1, int(limit)):]
    return items


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Copy the in-memory demo catalog (collections / documents / search
    logs) into SQL. Intentionally does NOT seed the retrieval config or
    snapshots: the default config row is materialised lazily by the first
    ``get_retrieval_config`` call, so seeding can never overwrite a
    tenant's saved config (or resurrect a "never customised" default over
    a user-saved row after a restart).
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["collections"] = len(
        [put_collection(tenant_id, c) for c in mem.list_collections(tenant_id)]
    )
    counts["documents"] = len(
        [put_document(tenant_id, d) for d in mem.list_documents(tenant_id)]
    )
    counts["search_logs"] = len(
        [put_search_log(tenant_id, l) for l in mem.list_search_logs(tenant_id)]
    )
    return counts
