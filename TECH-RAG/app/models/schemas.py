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
    search_config: Optional[str] = None
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
        "searchConfig": kb.search_config,
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


# ----------------------------------------------------------- search config


class SearchConfig(BaseModel):
    """Knowledge-base level search configuration (P1-RAG-06)."""

    topK: int = Field(default=5, ge=1, le=50)
    similarityThreshold: float = Field(default=0.0, ge=0.0, le=1.0)
    vectorWeight: float = Field(default=0.7, ge=0.0, le=1.0)
    rerankEnabled: bool = False
    rerankModel: str = "mock-rerank-v1"


class UpdateSearchConfigRequest(BaseModel):
    """Request body for updating KB search configuration."""

    topK: Optional[int] = Field(default=None, ge=1, le=50)
    similarityThreshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    vectorWeight: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    rerankEnabled: Optional[bool] = None
    rerankModel: Optional[str] = None


# ----------------------------------------------------- keyword/hybrid search


class KeywordSearchRequest(BaseModel):
    """Request body for BM25 keyword search (P1-RAG-05)."""

    query: str = Field(min_length=1, max_length=4096)
    topK: int = Field(default=5, ge=1, le=50)


class HybridSearchRequest(BaseModel):
    """Request body for hybrid (vector + BM25) search with RRF fusion."""

    query: str = Field(min_length=1, max_length=4096)
    topK: int = Field(default=5, ge=1, le=50)
    vectorWeight: float = Field(default=0.7, ge=0.0, le=1.0)
    similarityThreshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    rerankEnabled: Optional[bool] = None


# ----------------------------------------------------------- event schemas


class SearchEvent(BaseModel):
    """Persisted search event record (Outbox pattern, P1-RAG-07)."""

    id: str = ""
    tenant_id: str
    event_type: str
    payload: str
    headers: Optional[str] = None
    status: str = "PENDING"
    retry_count: int = 0
    max_retries: int = 3
    next_retry_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sent_at: Optional[datetime] = None


# ----------------------------------------------------- graph search (P1-RAG-08)


class GraphSearchRequest(BaseModel):
    """Request body for graph-enhanced retrieval (P1-RAG-08)."""

    query: str = Field(min_length=1, max_length=4096)
    knowledgeBaseId: str = Field(min_length=1)
    depth: int = Field(default=1, ge=1, le=3)
    topK: int = Field(default=10, ge=1, le=50)


class GraphNode(BaseModel):
    """A node in the knowledge graph context."""

    id: str
    label: str
    type: str = "concept"
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """An edge (relation) in the knowledge graph context."""

    source: str
    target: str
    relation: str
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphContext(BaseModel):
    """Graph context returned alongside graph-enhanced search results."""

    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    relations: list[str] = Field(default_factory=list)


# ------------------------------------------------- context assembly (P1-RAG-09)


class ConversationTurn(BaseModel):
    """A single turn in the conversation history."""

    role: str = Field(min_length=1)
    content: str = Field(min_length=1)


class ContextConfig(BaseModel):
    """Configuration for context assembly priority and budget."""

    maxTokens: int = Field(default=4096, ge=100, le=100000)
    includeOntology: bool = True
    includeRag: bool = True
    includeConversation: bool = True


class ContextAssemblyRequest(BaseModel):
    """Request body for multi-source context assembly (P1-RAG-09)."""

    query: str = Field(min_length=1, max_length=4096)
    knowledgeBaseIds: list[str] = Field(min_length=1)
    conversationHistory: list[ConversationTurn] = Field(default_factory=list)
    ontologyConceptIds: list[str] = Field(default_factory=list)
    contextConfig: ContextConfig = Field(default_factory=ContextConfig)


class ContextSource(BaseModel):
    """A single source contributing to the assembled context."""

    type: str
    id: str
    content: str
    relevance: float = 0.0
    priority: str = "MEDIUM"


class ContextAssemblyResponse(BaseModel):
    """Response for context assembly."""

    assembledContext: str
    sources: list[ContextSource] = Field(default_factory=list)
    tokenCount: int = 0


# -------------------------------------------------------- citations (P1-RAG-10)


class CitationLocateRequest(BaseModel):
    """Request body for locating citations (P1-RAG-10)."""

    query: str = Field(min_length=1, max_length=4096)
    chunkIds: list[str] = Field(default_factory=list)
    searchResults: list[dict[str, Any]] = Field(default_factory=list)


class CitationBatchRequest(BaseModel):
    """Request body for batch citation location."""

    query: str = Field(min_length=1, max_length=4096)
    chunkIds: list[str] = Field(min_length=1)


class Citation(BaseModel):
    """A single citation with location and confidence information."""

    chunkId: str
    documentId: str
    documentName: str
    textSpan: str
    startOffset: int
    endOffset: int
    confidenceScore: float
    highlightHtml: str
