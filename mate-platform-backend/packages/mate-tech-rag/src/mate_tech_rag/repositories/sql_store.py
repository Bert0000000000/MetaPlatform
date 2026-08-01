"""SQL-backed repository for the rag domain (P3-W4 TD-5) — SQLAlchemy 2.0.

Provides read + write for ``RagDocument`` and ``RagIndex``. Dict fields
(``RagDocument.metadata``) are JSON-serialised to TEXT.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import Base, get_session  # noqa: F401

from . import sql_models as models
from .in_memory import RagDocument, RagIndex


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
def _orm_to_document(row: models.RagDocumentORM) -> RagDocument:
    return RagDocument(
        id=row.id,
        tenant_id=row.tenant_id,
        document_id=row.document_id or "",
        filename=row.filename or "",
        chunk_count=row.chunk_count,
        metadata=_json_loads(row.meta),
        status=row.status or "indexed",
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_index(row: models.RagIndexORM) -> RagIndex:
    return RagIndex(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        backend=row.backend or "memory",
        chunk_count=row.chunk_count,
        status=row.status or "active",
        created_at=row.created_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — documents
# ---------------------------------------------------------------------------
def list_documents(tenant_id: str) -> list[RagDocument]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.RagDocumentORM)
        .where(models.RagDocumentORM.tenant_id == tenant_id)
        .order_by(models.RagDocumentORM.id)
    ).scalars().all()
    return [_orm_to_document(r) for r in rows]


def get_document(tenant_id: str, doc_id: str) -> RagDocument | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.RagDocumentORM).where(
            models.RagDocumentORM.tenant_id == tenant_id,
            models.RagDocumentORM.id == doc_id,
        )
    ).scalar_one_or_none()
    return _orm_to_document(row) if row else None


# ---------------------------------------------------------------------------
# Read API — indexes
# ---------------------------------------------------------------------------
def list_indexes(tenant_id: str) -> list[RagIndex]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.RagIndexORM)
        .where(models.RagIndexORM.tenant_id == tenant_id)
        .order_by(models.RagIndexORM.id)
    ).scalars().all()
    return [_orm_to_index(r) for r in rows]


def get_index(tenant_id: str, index_id: str) -> RagIndex | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.RagIndexORM).where(
            models.RagIndexORM.tenant_id == tenant_id,
            models.RagIndexORM.id == index_id,
        )
    ).scalar_one_or_none()
    return _orm_to_index(row) if row else None


# ---------------------------------------------------------------------------
# Write API — documents
# ---------------------------------------------------------------------------
def put_document(tenant_id: str, doc: RagDocument) -> RagDocument:
    if not tenant_id:
        return doc
    s = _session()
    meta_str = _json_dumps(doc.metadata)
    existing = s.get(models.RagDocumentORM, doc.id)
    if existing:
        existing.document_id = doc.document_id
        existing.filename = doc.filename
        existing.chunk_count = doc.chunk_count
        existing.meta = meta_str
        existing.status = doc.status
        existing.updated_at = doc.updated_at
    else:
        s.add(models.RagDocumentORM(
            id=doc.id, tenant_id=tenant_id, document_id=doc.document_id,
            filename=doc.filename, chunk_count=doc.chunk_count,
            meta=meta_str, status=doc.status,
            created_at=doc.created_at, updated_at=doc.updated_at,
        ))
    s.commit()
    return doc


def delete_document(tenant_id: str, doc_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.RagDocumentORM).where(
            models.RagDocumentORM.tenant_id == tenant_id,
            models.RagDocumentORM.id == doc_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    s.delete(row)
    s.commit()
    return True


# ---------------------------------------------------------------------------
# Write API — indexes
# ---------------------------------------------------------------------------
def put_index(tenant_id: str, idx: RagIndex) -> RagIndex:
    if not tenant_id:
        return idx
    s = _session()
    existing = s.get(models.RagIndexORM, idx.id)
    if existing:
        existing.name = idx.name
        existing.backend = idx.backend
        existing.chunk_count = idx.chunk_count
        existing.status = idx.status
        existing.created_at = idx.created_at
    else:
        s.add(models.RagIndexORM(
            id=idx.id, tenant_id=tenant_id, name=idx.name,
            backend=idx.backend, chunk_count=idx.chunk_count,
            status=idx.status, created_at=idx.created_at,
        ))
    s.commit()
    return idx


def delete_index(tenant_id: str, index_id: str) -> bool:
    if not tenant_id:
        return False
    s = _session()
    row = s.execute(
        select(models.RagIndexORM).where(
            models.RagIndexORM.tenant_id == tenant_id,
            models.RagIndexORM.id == index_id,
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
    counts["documents"] = len(
        [put_document(tenant_id, d) for d in mem.list_documents(tenant_id)]
    )
    counts["indexes"] = len(
        [put_index(tenant_id, i) for i in mem.list_indexes(tenant_id)]
    )
    return counts
