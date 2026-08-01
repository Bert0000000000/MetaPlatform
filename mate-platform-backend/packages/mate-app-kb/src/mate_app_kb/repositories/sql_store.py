"""SQL-backed repository for the kb domain (P3-W4 TD-5) — SQLAlchemy 2.0.

Provides read + write for ``KbCollection``, ``KbDocument``, and ``KbSearchLog``.
Dict fields (``KbCollection.config``, ``KbDocument.metadata``) are
JSON-serialised to TEXT. The ``metadata`` attribute is stored as ``meta``
to avoid the SQLAlchemy-reserved ``metadata`` name.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import Base, get_session  # noqa: F401

from . import sql_models as models
from .in_memory import KbCollection, KbDocument, KbSearchLog


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
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
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
