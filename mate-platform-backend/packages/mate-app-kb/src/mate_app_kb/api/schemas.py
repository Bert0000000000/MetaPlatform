"""API Schemas for mate-app-kb (business aggregation)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    status: Annotated[str, Field()]
    service: Annotated[str, Field()]
    version: Annotated[str, Field()]


class UploadResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    document_id: Annotated[str, Field()]
    filename: Annotated[str, Field()]
    size_bytes: Annotated[int, Field(ge=0)]
    chunk_count: Annotated[int, Field(ge=0)]
    indexed_in: Annotated[list[str], Field(default_factory=list)]


class SearchRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    query: Annotated[str, Field(min_length=1, max_length=4096)]
    top_k: Annotated[int, Field(ge=1, le=100, default=10)]
    mode: Annotated[Literal["AUTO", "FACTUAL", "ENTITY", "THEMATIC"], Field(default="AUTO")]
    # When omitted, the tenant's saved retrieval-config rerank_strategy is used.
    rerank_strategy: Annotated[Literal["identity", "keyword", "length"] | None, Field(default=None)]


class SearchResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    query: Annotated[str, Field()]
    mode: Annotated[str, Field()]
    total: Annotated[int, Field(ge=0)]
    hits: Annotated[list[dict], Field(default_factory=list)]
    latency_ms: Annotated[int, Field(ge=0)]


class ChatRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    message: Annotated[str, Field(min_length=1, max_length=4096)]
    thread_id: Annotated[str | None, Field(default=None)]
    scenario: Annotated[Literal["S1", "S2", "S3"], Field(default="S1")]


class ChatResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    thread_id: Annotated[str, Field()]
    scenario: Annotated[str, Field()]
    answer: Annotated[str, Field()]
    retrieved_chunks: Annotated[list[dict], Field(default_factory=list)]
    tool_calls: Annotated[list[dict], Field(default_factory=list)]
    latency_ms: Annotated[int, Field(ge=0)]


class StatsResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    total_chunks: Annotated[int, Field(ge=0)]
    embedder_dim: Annotated[int, Field(ge=0)]


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep implementation schemas
# ---------------------------------------------------------------------------

class CollectionCreateRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    name: Annotated[str, Field(min_length=1, max_length=256)]
    description: Annotated[str, Field(default="", max_length=2048)]
    config: Annotated[dict, Field(default_factory=dict)]


class CollectionResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    id: Annotated[str, Field()]
    tenant_id: Annotated[str, Field()]
    name: Annotated[str, Field()]
    description: Annotated[str, Field()]
    document_count: Annotated[int, Field(ge=0)]
    status: Annotated[str, Field()]
    config: Annotated[dict, Field(default_factory=dict)]
    created_at: Annotated[str, Field()]
    updated_at: Annotated[str, Field()]


class DocumentResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    id: Annotated[str, Field()]
    tenant_id: Annotated[str, Field()]
    collection_id: Annotated[str, Field()]
    document_id: Annotated[str, Field()]
    filename: Annotated[str, Field()]
    size_bytes: Annotated[int, Field(ge=0)]
    chunk_count: Annotated[int, Field(ge=0)]
    status: Annotated[str, Field()]
    metadata: Annotated[dict, Field(default_factory=dict)]
    created_at: Annotated[str, Field()]
    updated_at: Annotated[str, Field()]


class SearchLogResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    id: Annotated[str, Field()]
    tenant_id: Annotated[str, Field()]
    query: Annotated[str, Field()]
    mode: Annotated[str, Field()]
    total_hits: Annotated[int, Field(ge=0)]
    latency_ms: Annotated[int, Field(ge=0)]
    created_at: Annotated[str, Field()]


class DocumentTransitionRequest(BaseModel):
    """Transition a document's lifecycle status.

    Allowed transitions:
      uploaded -> indexing -> indexed
      uploaded -> indexing -> failed
      indexed  -> archived
    """
    model_config = ConfigDict(strict=True)
    status: Annotated[Literal["indexing", "indexed", "failed", "archived"], Field()]
    error: Annotated[str | None, Field(default=None, max_length=2048)]
    chunk_count: Annotated[int | None, Field(default=None, ge=0)]


# ---------------------------------------------------------------------------
# Retrieval configuration (knowledge/config page)
# ---------------------------------------------------------------------------
_RetrievalMode = Literal["AUTO", "FACTUAL", "ENTITY", "THEMATIC"]
_RerankStrategy = Literal["identity", "keyword", "length"]
_ChunkStrategy = Literal["recursive", "markdown", "semantic", "sliding"]


class RetrievalConfigUpdate(BaseModel):
    """PUT body for the tenant's global retrieval config."""
    model_config = ConfigDict(extra="forbid")
    mode: Annotated[_RetrievalMode, Field(default="AUTO")]
    rerank_strategy: Annotated[_RerankStrategy, Field(default="identity")]
    top_k: Annotated[int, Field(default=10, ge=1, le=100)]
    similarity_threshold: Annotated[float, Field(default=0.0, ge=0.0, le=1.0)]
    chunk_strategy: Annotated[_ChunkStrategy, Field(default="recursive")]
    chunk_size: Annotated[int, Field(default=512, ge=64, le=2048)]
    chunk_overlap: Annotated[int, Field(default=64, ge=0, le=512)]
    vector_weight: Annotated[float, Field(default=0.7, ge=0.0, le=1.0)]
    keyword_weight: Annotated[float, Field(default=0.3, ge=0.0, le=1.0)]
    reranker_enabled: Annotated[bool, Field(default=True)]
    show_citations: Annotated[bool, Field(default=True)]


class RetrievalConfigResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    tenant_id: Annotated[str, Field()]
    mode: Annotated[str, Field()]
    rerank_strategy: Annotated[str, Field()]
    top_k: Annotated[int, Field()]
    similarity_threshold: Annotated[float, Field()]
    chunk_strategy: Annotated[str, Field()]
    chunk_size: Annotated[int, Field()]
    chunk_overlap: Annotated[int, Field()]
    vector_weight: Annotated[float, Field()]
    keyword_weight: Annotated[float, Field()]
    reranker_enabled: Annotated[bool, Field()]
    show_citations: Annotated[bool, Field()]
    updated_at: Annotated[str, Field()]
