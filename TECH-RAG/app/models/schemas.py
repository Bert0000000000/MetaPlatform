"""Pydantic schemas for the Knowledge Base & Document domain."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class KnowledgeBaseStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class DocumentStatus(str, Enum):
    """Document lifecycle status.

    UPLOADED -> PARSING -> CHUNKED -> INDEXED  (happy path)
    Any stage may transition to FAILED.
    """

    UPLOADED = "UPLOADED"
    PARSING = "PARSING"
    CHUNKED = "CHUNKED"
    INDEXED = "INDEXED"
    FAILED = "FAILED"


class EmbeddingStatus(str, Enum):
    """Embedding generation status for a document chunk."""

    PENDING = "PENDING"
    GENERATED = "GENERATED"
    FAILED = "FAILED"


class KnowledgeBase(BaseModel):
    """Persisted knowledge base record."""

    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    status: KnowledgeBaseStatus = KnowledgeBaseStatus.ACTIVE
    doc_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Document(BaseModel):
    """Persisted document record."""

    id: str
    tenant_id: str
    kb_id: str
    filename: str
    file_size: int = 0
    file_type: str
    storage_path: str
    status: DocumentStatus = DocumentStatus.UPLOADED
    chunk_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ----------------------------------------------------------- request schemas


class CreateKnowledgeBaseRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=1024)


class UpdateKnowledgeBaseRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=1024)
    status: Optional[KnowledgeBaseStatus] = None


# ------------------------------------------------------------ response schemas


def to_kb_detail(kb: KnowledgeBase) -> dict[str, Any]:
    return {
        "id": kb.id,
        "tenantId": kb.tenant_id,
        "name": kb.name,
        "description": kb.description,
        "status": kb.status.value if isinstance(kb.status, KnowledgeBaseStatus) else kb.status,
        "docCount": kb.doc_count,
        "createdAt": kb.created_at,
        "updatedAt": kb.updated_at,
    }


def to_kb_list_item(kb: KnowledgeBase) -> dict[str, Any]:
    return to_kb_detail(kb)


def to_doc_detail(doc: Document) -> dict[str, Any]:
    return {
        "id": doc.id,
        "tenantId": doc.tenant_id,
        "kbId": doc.kb_id,
        "filename": doc.filename,
        "fileSize": doc.file_size,
        "fileType": doc.file_type,
        "storagePath": doc.storage_path,
        "status": doc.status.value if isinstance(doc.status, DocumentStatus) else doc.status,
        "chunkCount": doc.chunk_count,
        "metadata": doc.metadata,
        "createdAt": doc.created_at,
        "updatedAt": doc.updated_at,
    }


def to_doc_list_item(doc: Document) -> dict[str, Any]:
    return to_doc_detail(doc)


# ----------------------------------------------------------- chunk schemas


class DocumentChunk(BaseModel):
    """Persisted document chunk record."""

    id: str
    tenant_id: str
    document_id: str
    chunk_index: int
    content: str
    token_count: int = 0
    embedding_status: EmbeddingStatus = EmbeddingStatus.PENDING
    embedding: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ----------------------------------------------------------- search schemas


class SearchRequest(BaseModel):
    """Request body for knowledge base vector search."""

    query: str = Field(min_length=1, max_length=4096)
    topK: int = Field(default=5, ge=1, le=50)


def to_chunk_detail(chunk: DocumentChunk) -> dict[str, Any]:
    return {
        "id": chunk.id,
        "tenantId": chunk.tenant_id,
        "documentId": chunk.document_id,
        "chunkIndex": chunk.chunk_index,
        "content": chunk.content,
        "tokenCount": chunk.token_count,
        "embeddingStatus": chunk.embedding_status.value
        if isinstance(chunk.embedding_status, EmbeddingStatus)
        else chunk.embedding_status,
        "createdAt": chunk.created_at,
        "updatedAt": chunk.updated_at,
    }


def to_chunk_list_item(chunk: DocumentChunk) -> dict[str, Any]:
    return to_chunk_detail(chunk)
