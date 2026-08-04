"""API Schemas (Pydantic v2)"""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from mate_common import BaseDTO


class HealthResponse(BaseModel):
    """health check response"""
    model_config = ConfigDict(strict=True, frozen=True)
    status: Annotated[str, Field(description="service status")]
    service: Annotated[str, Field(description="service name")]
    version: Annotated[str, Field(description="version")]


class RetrievalRequest(BaseDTO):
    """retrieval request"""
    query: Annotated[str, Field(min_length=1, max_length=4096, description="query text")]
    top_k: Annotated[int, Field(ge=1, le=100, default=10, description="top k")]
    kb_id: Annotated[str | None, Field(default=None, description="kb id filter")]
    mode: Annotated[str, Field(default="AUTO", description="AUTO FACTUAL ENTITY THEMATIC")]
    rerank_strategy: Annotated[str, Field(default="identity", description="identity / keyword / length")]
    metadata_filter: Annotated[dict[str, str] | None, Field(default=None, description="metadata key-value filters")]


class ChunkHit(BaseModel):
    """single hit (placeholder)"""
    model_config = ConfigDict(strict=True, frozen=True)
    chunk_id: Annotated[str, Field(description="chunk id")]
    document_id: Annotated[str, Field(description="document id")]
    score: Annotated[float, Field(ge=0.0, le=1.0, description="relevance score")]
    text: Annotated[str, Field(description="chunk text")]
    metadata: Annotated[dict[str, str], Field(default_factory=dict, description="metadata")]


class RetrievalResponse(BaseModel):
    """retrieval response"""
    model_config = ConfigDict(strict=True, frozen=True)
    query: Annotated[str, Field(description="original query")]
    hits: Annotated[list[ChunkHit], Field(description="hit list")]
    total: Annotated[int, Field(ge=0, description="hit count")]
    latency_ms: Annotated[int, Field(ge=0, description="latency in ms")]
    mode: Annotated[str, Field(default="FACTUAL", description="actual mode used")]


class IngestRequest(BaseModel):
    """ingest request"""
    model_config = ConfigDict(strict=True)
    document_id: Annotated[str, Field(min_length=1, max_length=64, description="document id")]
    chunks: Annotated[list[str], Field(min_length=1, max_length=1000, description="chunk list")]
    metadata: Annotated[dict[str, str], Field(default_factory=dict, description="doc-level metadata")]


class IngestResponse(BaseModel):
    """ingest response"""
    model_config = ConfigDict(strict=True, frozen=True)
    document_id: Annotated[str, Field(description="document id")]
    chunk_count: Annotated[int, Field(ge=0, description="successfully ingested chunk count")]
    total_chunks: Annotated[int, Field(ge=0, description="requested chunk count")]


class StatsResponse(BaseModel):
    """stats response"""
    model_config = ConfigDict(strict=True, frozen=True)
    total_chunks: Annotated[int, Field(ge=0, description="indexed chunk count")]
    embedder_dim: Annotated[int, Field(ge=0, description="embedder vector dim")]

class ParseRequest(BaseModel):
    """RAGFlow parse request: text content -> chunks -> 3-index fan-out."""
    model_config = ConfigDict(strict=True)
    document_id: Annotated[str, Field(min_length=1, max_length=64, description="document id")]
    content: Annotated[str, Field(min_length=1, max_length=1_000_000, description="raw text content")]
    metadata: Annotated[dict[str, str], Field(default_factory=dict, description="doc-level metadata")]


class ParseResponse(BaseModel):
    """RAGFlow parse response."""
    model_config = ConfigDict(strict=True, frozen=True)
    document_id: Annotated[str, Field(description="document id")]
    chunk_count: Annotated[int, Field(ge=0, description="number of chunks produced")]
    ragflow_parsed: Annotated[int, Field(ge=0, description="chunks parsed by RAGFlow")]
    indexed_in: Annotated[list[str], Field(description="index names chunks were fanned out to")]

class UploadResponse(BaseModel):
    """File upload parse response (multipart endpoint)."""
    model_config = ConfigDict(strict=True, frozen=True)
    document_id: Annotated[str, Field(description="document id")]
    filename: Annotated[str, Field(description="uploaded filename")]
    size_bytes: Annotated[int, Field(ge=0, description="upload size in bytes")]
    chunk_count: Annotated[int, Field(ge=0, description="number of chunks produced")]
    indexed_in: Annotated[list[str], Field(description="index names chunks were fanned out to")]

class EmbedderInfo(BaseModel):
    """Embedder info for diagnostics."""
    model_config = ConfigDict(strict=True, frozen=True)
    provider: Annotated[str, Field(description="embedder provider name")]
    dim: Annotated[int, Field(ge=0, description="embedding dimension")]
    model_name: Annotated[str, Field(default="", description="model name (e.g. text-embedding-3-small)")]


class IndexStatus(BaseModel):
    """Single index status."""
    model_config = ConfigDict(strict=True, frozen=True)
    name: Annotated[str, Field(description="index name")]
    backend: Annotated[str, Field(description="backend type: memory | milvus | neo4j | lightrag")]
    chunk_count: Annotated[int, Field(ge=0, description="current chunk count")]


class SystemStatus(BaseModel):
    """Full system status response."""
    model_config = ConfigDict(strict=True, frozen=True)
    status: Annotated[str, Field(description="service status")]
    service: Annotated[str, Field(description="service name")]
    version: Annotated[str, Field(description="service version")]
    embedder: EmbedderInfo
    indexes: Annotated[list[IndexStatus], Field(description="active indexes")]

class PgStatsResponse(BaseModel):
    """PG connection stats (TC-2.1.1)."""
    model_config = ConfigDict(strict=True, frozen=True)
    available: Annotated[bool, Field(description="whether PG is reachable")]
    chunks_count: Annotated[int, Field(ge=0, description="kb_chunks row count")]
    dsn_host: Annotated[str, Field(default="", description="DSN host (sanitized)")]
