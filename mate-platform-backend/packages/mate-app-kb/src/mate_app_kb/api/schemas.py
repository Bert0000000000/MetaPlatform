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
