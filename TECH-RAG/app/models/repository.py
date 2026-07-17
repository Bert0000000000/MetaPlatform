"""Data access layer for knowledge bases and documents.

Provides abstract repository contracts plus in-memory implementations used
by tests and as the default when no database is configured. SqlAlchemy
implementations are provided for production use.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.models.orm import (
    Base,
    DocumentChunkORM,
    DocumentORM,
    KnowledgeBaseORM,
    SearchEventORM,
)
from app.models.schemas import (
    Document,
    DocumentChunk,
    DocumentStatus,
    EmbeddingStatus,
    KnowledgeBase,
    KnowledgeBaseStatus,
    SearchEvent,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_kb_id() -> str:
    return f"kb-{uuid.uuid4().hex[:24]}"


def _new_doc_id() -> str:
    return f"doc-{uuid.uuid4().hex[:24]}"


def _new_chunk_id() -> str:
    return f"chk-{uuid.uuid4().hex[:24]}"


# ----------------------------------------------------------- KB conversions


def _kb_row_to_model(row: KnowledgeBaseORM) -> KnowledgeBase:
    return KnowledgeBase(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        description=row.description,
        status=KnowledgeBaseStatus(row.status),
        doc_count=row.doc_count or 0,
        search_config=row.search_config,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


# ----------------------------------------------------- Document conversions


def _doc_row_to_model(row: DocumentORM) -> Document:
    return Document(
        id=row.id,
        tenant_id=row.tenant_id,
        kb_id=row.kb_id,
        filename=row.filename,
        file_size=row.file_size or 0,
        file_type=row.file_type,
        storage_path=row.storage_path,
        status=DocumentStatus(row.status),
        chunk_count=row.chunk_count or 0,
        metadata=dict(row.meta or {}),
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


# ------------------------------------------------------- Chunk conversions


def _chunk_row_to_model(row: DocumentChunkORM) -> DocumentChunk:
    return DocumentChunk(
        id=row.id,
        tenant_id=row.tenant_id,
        document_id=row.document_id,
        chunk_index=row.chunk_index,
        content=row.content,
        token_count=row.token_count or 0,
        embedding_status=EmbeddingStatus(row.embedding_status),
        embedding=row.embedding,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


# =====================================================================
# Knowledge Base Repository
# =====================================================================


class KnowledgeBaseRepository(ABC):
    """Abstract repository contract for knowledge bases."""

    @abstractmethod
    async def create(self, kb: KnowledgeBase) -> KnowledgeBase: ...

    @abstractmethod
    async def get(self, kb_id: str, tenant_id: str) -> Optional[KnowledgeBase]: ...

    @abstractmethod
    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[KnowledgeBase]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[KnowledgeBaseStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[KnowledgeBase], int]: ...

    @abstractmethod
    async def update(
        self, kb_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[KnowledgeBase]: ...

    @abstractmethod
    async def delete(self, kb_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def increment_doc_count(
        self, kb_id: str, tenant_id: str, delta: int = 1
    ) -> None: ...


class InMemoryKnowledgeBaseRepository(KnowledgeBaseRepository):
    """Thread-safe in-memory repository (used by tests & default runtime)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], KnowledgeBase] = {}

    async def create(self, kb: KnowledgeBase) -> KnowledgeBase:
        with self._lock:
            if not kb.id:
                kb.id = _new_kb_id()
            kb.created_at = _now()
            kb.updated_at = kb.created_at
            self._store[(kb.tenant_id, kb.id)] = kb
            return kb

    async def get(self, kb_id: str, tenant_id: str) -> Optional[KnowledgeBase]:
        with self._lock:
            return self._store.get((tenant_id, kb_id))

    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[KnowledgeBase]:
        with self._lock:
            for (tid, _), kb in self._store.items():
                if tid == tenant_id and kb.name == name:
                    return kb
            return None

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[KnowledgeBaseStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[KnowledgeBase], int]:
        with self._lock:
            results = [
                kb
                for (tid, _), kb in self._store.items()
                if tid == tenant_id and (status is None or kb.status == status)
            ]
        results.sort(key=lambda k: k.created_at)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, kb_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[KnowledgeBase]:
        with self._lock:
            kb = self._store.get((tenant_id, kb_id))
            if kb is None:
                return None
            updated = kb.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, kb_id)] = updated
            return updated

    async def delete(self, kb_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, kb_id), None) is not None

    async def increment_doc_count(
        self, kb_id: str, tenant_id: str, delta: int = 1
    ) -> None:
        with self._lock:
            kb = self._store.get((tenant_id, kb_id))
            if kb is not None:
                kb.doc_count = max(0, kb.doc_count + delta)
                kb.updated_at = _now()

    # -- test helpers --------------------------------------------------

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class SqlAlchemyKnowledgeBaseRepository(KnowledgeBaseRepository):
    """Async SQLAlchemy 2.0 repository backed by ``rag_knowledge_base`` table."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create(self, kb: KnowledgeBase) -> KnowledgeBase:
        if not kb.id:
            kb.id = _new_kb_id()
        kb.created_at = _now()
        kb.updated_at = kb.created_at
        row = KnowledgeBaseORM(
            id=kb.id,
            tenant_id=kb.tenant_id,
            name=kb.name,
            description=kb.description,
            status=kb.status.value,
            doc_count=kb.doc_count,
            search_config=kb.search_config,
            created_at=kb.created_at,
            updated_at=kb.updated_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return kb

    async def get(self, kb_id: str, tenant_id: str) -> Optional[KnowledgeBase]:
        async with self._session_factory() as session:
            row = await session.get(KnowledgeBaseORM, kb_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _kb_row_to_model(row)

    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[KnowledgeBase]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(KnowledgeBaseORM).where(
                KnowledgeBaseORM.tenant_id == tenant_id,
                KnowledgeBaseORM.name == name,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _kb_row_to_model(row) if row else None

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[KnowledgeBaseStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[KnowledgeBase], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(KnowledgeBaseORM).where(
                KnowledgeBaseORM.tenant_id == tenant_id
            )
            count_base = select(func.count()).select_from(
                KnowledgeBaseORM
            ).where(KnowledgeBaseORM.tenant_id == tenant_id)
            if status is not None:
                base = base.where(KnowledgeBaseORM.status == status.value)
                count_base = count_base.where(KnowledgeBaseORM.status == status.value)
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(KnowledgeBaseORM.created_at)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_kb_row_to_model(r) for r in rows], total

    async def update(
        self, kb_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[KnowledgeBase]:
        async with self._session_factory() as session:
            row = await session.get(KnowledgeBaseORM, kb_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            if "name" in fields:
                row.name = fields["name"]
            if "description" in fields:
                row.description = fields["description"]
            if "status" in fields:
                row.status = fields["status"].value
            if "doc_count" in fields:
                row.doc_count = fields["doc_count"]
            if "search_config" in fields:
                row.search_config = fields["search_config"]
            row.updated_at = _now()
            await session.commit()
            return _kb_row_to_model(row)

    async def delete(self, kb_id: str, tenant_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(KnowledgeBaseORM, kb_id)
            if row is None or row.tenant_id != tenant_id:
                return False
            await session.delete(row)
            await session.commit()
            return True

    async def increment_doc_count(
        self, kb_id: str, tenant_id: str, delta: int = 1
    ) -> None:
        async with self._session_factory() as session:
            row = await session.get(KnowledgeBaseORM, kb_id)
            if row is not None and row.tenant_id == tenant_id:
                row.doc_count = max(0, (row.doc_count or 0) + delta)
                row.updated_at = _now()
                await session.commit()


# =====================================================================
# Document Repository
# =====================================================================


class DocumentRepository(ABC):
    """Abstract repository contract for documents."""

    @abstractmethod
    async def create(self, doc: Document) -> Document: ...

    @abstractmethod
    async def get(self, doc_id: str, tenant_id: str) -> Optional[Document]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        kb_id: str,
        *,
        status: Optional[DocumentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Document], int]: ...

    @abstractmethod
    async def update(
        self, doc_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Document]: ...

    @abstractmethod
    async def delete(self, doc_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def delete_by_kb(self, kb_id: str, tenant_id: str) -> int: ...


class InMemoryDocumentRepository(DocumentRepository):
    """Thread-safe in-memory repository (used by tests & default runtime)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], Document] = {}

    async def create(self, doc: Document) -> Document:
        with self._lock:
            if not doc.id:
                doc.id = _new_doc_id()
            doc.created_at = _now()
            doc.updated_at = doc.created_at
            self._store[(doc.tenant_id, doc.id)] = doc
            return doc

    async def get(self, doc_id: str, tenant_id: str) -> Optional[Document]:
        with self._lock:
            return self._store.get((tenant_id, doc_id))

    async def list(
        self,
        tenant_id: str,
        kb_id: str,
        *,
        status: Optional[DocumentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Document], int]:
        with self._lock:
            results = [
                doc
                for (tid, _), doc in self._store.items()
                if tid == tenant_id
                and doc.kb_id == kb_id
                and (status is None or doc.status == status)
            ]
        results.sort(key=lambda d: d.created_at)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, doc_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Document]:
        with self._lock:
            doc = self._store.get((tenant_id, doc_id))
            if doc is None:
                return None
            updated = doc.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, doc_id)] = updated
            return updated

    async def delete(self, doc_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, doc_id), None) is not None

    async def delete_by_kb(self, kb_id: str, tenant_id: str) -> int:
        with self._lock:
            to_remove = [
                (tid, did)
                for (tid, did), doc in self._store.items()
                if tid == tenant_id and doc.kb_id == kb_id
            ]
            for key in to_remove:
                self._store.pop(key, None)
            return len(to_remove)

    # -- test helpers --------------------------------------------------

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class SqlAlchemyDocumentRepository(DocumentRepository):
    """Async SQLAlchemy 2.0 repository backed by ``rag_document`` table."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    async def create(self, doc: Document) -> Document:
        if not doc.id:
            doc.id = _new_doc_id()
        doc.created_at = _now()
        doc.updated_at = doc.created_at
        row = DocumentORM(
            id=doc.id,
            tenant_id=doc.tenant_id,
            kb_id=doc.kb_id,
            filename=doc.filename,
            file_size=doc.file_size,
            file_type=doc.file_type,
            storage_path=doc.storage_path,
            status=doc.status.value,
            chunk_count=doc.chunk_count,
            meta=doc.metadata,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return doc

    async def get(self, doc_id: str, tenant_id: str) -> Optional[Document]:
        async with self._session_factory() as session:
            row = await session.get(DocumentORM, doc_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _doc_row_to_model(row)

    async def list(
        self,
        tenant_id: str,
        kb_id: str,
        *,
        status: Optional[DocumentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Document], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(DocumentORM).where(
                DocumentORM.tenant_id == tenant_id,
                DocumentORM.kb_id == kb_id,
            )
            count_base = select(func.count()).select_from(DocumentORM).where(
                DocumentORM.tenant_id == tenant_id,
                DocumentORM.kb_id == kb_id,
            )
            if status is not None:
                base = base.where(DocumentORM.status == status.value)
                count_base = count_base.where(DocumentORM.status == status.value)
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(DocumentORM.created_at)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_doc_row_to_model(r) for r in rows], total

    async def update(
        self, doc_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Document]:
        async with self._session_factory() as session:
            row = await session.get(DocumentORM, doc_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            if "filename" in fields:
                row.filename = fields["filename"]
            if "file_size" in fields:
                row.file_size = fields["file_size"]
            if "file_type" in fields:
                row.file_type = fields["file_type"]
            if "storage_path" in fields:
                row.storage_path = fields["storage_path"]
            if "status" in fields:
                row.status = fields["status"].value
            if "chunk_count" in fields:
                row.chunk_count = fields["chunk_count"]
            if "metadata" in fields:
                row.meta = fields["metadata"]
            row.updated_at = _now()
            await session.commit()
            return _doc_row_to_model(row)

    async def delete(self, doc_id: str, tenant_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(DocumentORM, doc_id)
            if row is None or row.tenant_id != tenant_id:
                return False
            await session.delete(row)
            await session.commit()
            return True

    async def delete_by_kb(self, kb_id: str, tenant_id: str) -> int:
        from sqlalchemy import delete, select

        async with self._session_factory() as session:
            stmt = select(DocumentORM).where(
                DocumentORM.tenant_id == tenant_id,
                DocumentORM.kb_id == kb_id,
            )
            rows = (await session.execute(stmt)).scalars().all()
            count = len(rows)
            for row in rows:
                await session.delete(row)
            await session.commit()
            return count


# =====================================================================
# Document Chunk Repository
# =====================================================================


class DocumentChunkRepository(ABC):
    """Abstract repository contract for document chunks."""

    @abstractmethod
    async def create(self, chunk: DocumentChunk) -> DocumentChunk: ...

    @abstractmethod
    async def get(self, chunk_id: str, tenant_id: str) -> Optional[DocumentChunk]: ...

    @abstractmethod
    async def list_by_document(
        self, document_id: str, tenant_id: str
    ) -> list[DocumentChunk]: ...

    @abstractmethod
    async def list_pending_by_document(
        self, document_id: str, tenant_id: str
    ) -> list[DocumentChunk]: ...

    @abstractmethod
    async def list_generated_by_documents(
        self, document_ids: list[str], tenant_id: str
    ) -> list[DocumentChunk]: ...

    @abstractmethod
    async def list_by_documents(
        self, document_ids: list[str], tenant_id: str
    ) -> list[DocumentChunk]: ...

    @abstractmethod
    async def update(
        self, chunk_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DocumentChunk]: ...

    @abstractmethod
    async def delete_by_document(self, document_id: str, tenant_id: str) -> int: ...


class InMemoryDocumentChunkRepository(DocumentChunkRepository):
    """Thread-safe in-memory repository (used by tests & default runtime)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], DocumentChunk] = {}

    async def create(self, chunk: DocumentChunk) -> DocumentChunk:
        with self._lock:
            if not chunk.id:
                chunk.id = _new_chunk_id()
            chunk.created_at = _now()
            chunk.updated_at = chunk.created_at
            self._store[(chunk.tenant_id, chunk.id)] = chunk
            return chunk

    async def get(self, chunk_id: str, tenant_id: str) -> Optional[DocumentChunk]:
        with self._lock:
            return self._store.get((tenant_id, chunk_id))

    async def list_by_document(
        self, document_id: str, tenant_id: str
    ) -> list[DocumentChunk]:
        with self._lock:
            results = [
                chunk
                for (tid, _), chunk in self._store.items()
                if tid == tenant_id and chunk.document_id == document_id
            ]
        results.sort(key=lambda c: c.chunk_index)
        return results

    async def list_pending_by_document(
        self, document_id: str, tenant_id: str
    ) -> list[DocumentChunk]:
        with self._lock:
            results = [
                chunk
                for (tid, _), chunk in self._store.items()
                if tid == tenant_id
                and chunk.document_id == document_id
                and chunk.embedding_status == EmbeddingStatus.PENDING
            ]
        results.sort(key=lambda c: c.chunk_index)
        return results

    async def list_generated_by_documents(
        self, document_ids: list[str], tenant_id: str
    ) -> list[DocumentChunk]:
        with self._lock:
            results = [
                chunk
                for (tid, _), chunk in self._store.items()
                if tid == tenant_id
                and chunk.document_id in document_ids
                and chunk.embedding_status == EmbeddingStatus.GENERATED
            ]
        results.sort(key=lambda c: c.chunk_index)
        return results

    async def list_by_documents(
        self, document_ids: list[str], tenant_id: str
    ) -> list[DocumentChunk]:
        with self._lock:
            results = [
                chunk
                for (tid, _), chunk in self._store.items()
                if tid == tenant_id and chunk.document_id in document_ids
            ]
        results.sort(key=lambda c: c.chunk_index)
        return results

    async def update(
        self, chunk_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DocumentChunk]:
        with self._lock:
            chunk = self._store.get((tenant_id, chunk_id))
            if chunk is None:
                return None
            updated = chunk.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, chunk_id)] = updated
            return updated

    async def delete_by_document(self, document_id: str, tenant_id: str) -> int:
        with self._lock:
            to_remove = [
                (tid, cid)
                for (tid, cid), chunk in self._store.items()
                if tid == tenant_id and chunk.document_id == document_id
            ]
            for key in to_remove:
                self._store.pop(key, None)
            return len(to_remove)

    # -- test helpers --------------------------------------------------

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class SqlAlchemyDocumentChunkRepository(DocumentChunkRepository):
    """Async SQLAlchemy 2.0 repository backed by ``rag_document_chunk`` table."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    async def create(self, chunk: DocumentChunk) -> DocumentChunk:
        if not chunk.id:
            chunk.id = _new_chunk_id()
        chunk.created_at = _now()
        chunk.updated_at = chunk.created_at
        row = DocumentChunkORM(
            id=chunk.id,
            tenant_id=chunk.tenant_id,
            document_id=chunk.document_id,
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            token_count=chunk.token_count,
            embedding_status=chunk.embedding_status.value,
            embedding=chunk.embedding,
            created_at=chunk.created_at,
            updated_at=chunk.updated_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return chunk

    async def get(self, chunk_id: str, tenant_id: str) -> Optional[DocumentChunk]:
        async with self._session_factory() as session:
            row = await session.get(DocumentChunkORM, chunk_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _chunk_row_to_model(row)

    async def list_by_document(
        self, document_id: str, tenant_id: str
    ) -> list[DocumentChunk]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(DocumentChunkORM).where(
                DocumentChunkORM.tenant_id == tenant_id,
                DocumentChunkORM.document_id == document_id,
            ).order_by(DocumentChunkORM.chunk_index)
            rows = (await session.execute(stmt)).scalars().all()
            return [_chunk_row_to_model(r) for r in rows]

    async def list_pending_by_document(
        self, document_id: str, tenant_id: str
    ) -> list[DocumentChunk]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(DocumentChunkORM).where(
                DocumentChunkORM.tenant_id == tenant_id,
                DocumentChunkORM.document_id == document_id,
                DocumentChunkORM.embedding_status == EmbeddingStatus.PENDING.value,
            ).order_by(DocumentChunkORM.chunk_index)
            rows = (await session.execute(stmt)).scalars().all()
            return [_chunk_row_to_model(r) for r in rows]

    async def list_generated_by_documents(
        self, document_ids: list[str], tenant_id: str
    ) -> list[DocumentChunk]:
        from sqlalchemy import select

        if not document_ids:
            return []
        async with self._session_factory() as session:
            stmt = select(DocumentChunkORM).where(
                DocumentChunkORM.tenant_id == tenant_id,
                DocumentChunkORM.document_id.in_(document_ids),
                DocumentChunkORM.embedding_status == EmbeddingStatus.GENERATED.value,
            ).order_by(DocumentChunkORM.chunk_index)
            rows = (await session.execute(stmt)).scalars().all()
            return [_chunk_row_to_model(r) for r in rows]

    async def list_by_documents(
        self, document_ids: list[str], tenant_id: str
    ) -> list[DocumentChunk]:
        from sqlalchemy import select

        if not document_ids:
            return []
        async with self._session_factory() as session:
            stmt = select(DocumentChunkORM).where(
                DocumentChunkORM.tenant_id == tenant_id,
                DocumentChunkORM.document_id.in_(document_ids),
            ).order_by(DocumentChunkORM.chunk_index)
            rows = (await session.execute(stmt)).scalars().all()
            return [_chunk_row_to_model(r) for r in rows]

    async def update(
        self, chunk_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DocumentChunk]:
        async with self._session_factory() as session:
            row = await session.get(DocumentChunkORM, chunk_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            if "content" in fields:
                row.content = fields["content"]
            if "token_count" in fields:
                row.token_count = fields["token_count"]
            if "embedding_status" in fields:
                row.embedding_status = (
                    fields["embedding_status"].value
                    if isinstance(fields["embedding_status"], EmbeddingStatus)
                    else fields["embedding_status"]
                )
            if "embedding" in fields:
                row.embedding = fields["embedding"]
            row.updated_at = _now()
            await session.commit()
            return _chunk_row_to_model(row)

    async def delete_by_document(self, document_id: str, tenant_id: str) -> int:
        from sqlalchemy import delete

        async with self._session_factory() as session:
            stmt = delete(DocumentChunkORM).where(
                DocumentChunkORM.tenant_id == tenant_id,
                DocumentChunkORM.document_id == document_id,
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount or 0


# =====================================================================
# Search Event Repository (P1-RAG-07 Outbox)
# =====================================================================


def _new_event_id() -> str:
    return f"evt-{uuid.uuid4().hex[:24]}"


def _event_row_to_model(row: SearchEventORM) -> SearchEvent:
    return SearchEvent(
        id=row.id,
        tenant_id=row.tenant_id,
        event_type=row.event_type,
        payload=row.payload,
        headers=row.headers,
        status=row.status,
        retry_count=row.retry_count or 0,
        max_retries=row.max_retries or 3,
        next_retry_at=row.next_retry_at,
        created_at=row.created_at if row.created_at else _now(),
        sent_at=row.sent_at,
    )


class SearchEventRepository(ABC):
    """Abstract repository contract for search events (Outbox)."""

    @abstractmethod
    async def create(self, event: SearchEvent) -> SearchEvent: ...

    @abstractmethod
    async def list_pending(
        self, tenant_id: str, limit: int = 100
    ) -> list[SearchEvent]: ...

    @abstractmethod
    async def list_all_pending(self, limit: int = 100) -> list[SearchEvent]: ...

    @abstractmethod
    async def mark_sent(self, event_id: str) -> bool: ...

    @abstractmethod
    async def mark_dead(self, event_id: str) -> bool: ...

    @abstractmethod
    async def increment_retry(self, event_id: str) -> bool: ...

    @abstractmethod
    async def list_by_tenant(
        self, tenant_id: str, limit: int = 100
    ) -> list[SearchEvent]: ...


class InMemorySearchEventRepository(SearchEventRepository):
    """Thread-safe in-memory repository (used by tests & default runtime)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[str, SearchEvent] = {}

    async def create(self, event: SearchEvent) -> SearchEvent:
        with self._lock:
            if not event.id:
                event.id = _new_event_id()
            event.created_at = _now()
            self._store[event.id] = event
            return event

    async def list_pending(
        self, tenant_id: str, limit: int = 100
    ) -> list[SearchEvent]:
        with self._lock:
            results = [
                evt
                for evt in self._store.values()
                if evt.tenant_id == tenant_id and evt.status == "PENDING"
            ]
        results.sort(key=lambda e: e.created_at)
        return results[:limit]

    async def list_all_pending(self, limit: int = 100) -> list[SearchEvent]:
        with self._lock:
            results = [
                evt for evt in self._store.values() if evt.status == "PENDING"
            ]
        results.sort(key=lambda e: e.created_at)
        return results[:limit]

    async def mark_sent(self, event_id: str) -> bool:
        with self._lock:
            evt = self._store.get(event_id)
            if evt is None:
                return False
            evt.status = "SENT"
            evt.sent_at = _now()
            return True

    async def mark_dead(self, event_id: str) -> bool:
        with self._lock:
            evt = self._store.get(event_id)
            if evt is None:
                return False
            evt.status = "DEAD"
            return True

    async def increment_retry(self, event_id: str) -> bool:
        with self._lock:
            evt = self._store.get(event_id)
            if evt is None:
                return False
            evt.retry_count += 1
            evt.next_retry_at = _now()
            return True

    async def list_by_tenant(
        self, tenant_id: str, limit: int = 100
    ) -> list[SearchEvent]:
        with self._lock:
            results = [
                evt for evt in self._store.values()
                if evt.tenant_id == tenant_id
            ]
        results.sort(key=lambda e: e.created_at)
        return results[:limit]

    # -- test helpers --------------------------------------------------

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class SqlAlchemySearchEventRepository(SearchEventRepository):
    """Async SQLAlchemy 2.0 repository backed by ``rag_search_events`` table."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    async def create(self, event: SearchEvent) -> SearchEvent:
        if not event.id:
            event.id = _new_event_id()
        event.created_at = _now()
        row = SearchEventORM(
            id=event.id,
            tenant_id=event.tenant_id,
            event_type=event.event_type,
            payload=event.payload,
            headers=event.headers,
            status=event.status,
            retry_count=event.retry_count,
            max_retries=event.max_retries,
            next_retry_at=event.next_retry_at,
            created_at=event.created_at,
            sent_at=event.sent_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return event

    async def list_pending(
        self, tenant_id: str, limit: int = 100
    ) -> list[SearchEvent]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = (
                select(SearchEventORM)
                .where(
                    SearchEventORM.tenant_id == tenant_id,
                    SearchEventORM.status == "PENDING",
                )
                .order_by(SearchEventORM.created_at)
                .limit(limit)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_event_row_to_model(r) for r in rows]

    async def list_all_pending(self, limit: int = 100) -> list[SearchEvent]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = (
                select(SearchEventORM)
                .where(SearchEventORM.status == "PENDING")
                .order_by(SearchEventORM.created_at)
                .limit(limit)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_event_row_to_model(r) for r in rows]

    async def mark_sent(self, event_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(SearchEventORM, event_id)
            if row is None:
                return False
            row.status = "SENT"
            row.sent_at = _now()
            await session.commit()
            return True

    async def mark_dead(self, event_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(SearchEventORM, event_id)
            if row is None:
                return False
            row.status = "DEAD"
            await session.commit()
            return True

    async def increment_retry(self, event_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(SearchEventORM, event_id)
            if row is None:
                return False
            row.retry_count = (row.retry_count or 0) + 1
            row.next_retry_at = _now()
            await session.commit()
            return True

    async def list_by_tenant(
        self, tenant_id: str, limit: int = 100
    ) -> list[SearchEvent]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = (
                select(SearchEventORM)
                .where(SearchEventORM.tenant_id == tenant_id)
                .order_by(SearchEventORM.created_at)
                .limit(limit)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_event_row_to_model(r) for r in rows]
