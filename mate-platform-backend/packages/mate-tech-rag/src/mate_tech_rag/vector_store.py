"""Vector store abstraction + InMemory impl (placeholder).

TC-5.6.3 will replace with Milvus collection adapter.
Current: dict[doc_id -> list[Chunk]] + cosine similarity brute-force.
"""
from __future__ import annotations

import math
import threading
import uuid
from dataclasses import dataclass, field
from typing import Protocol

from mate_tech_rag.api.schemas import ChunkHit


@dataclass
class StoredChunk:
    chunk_id: str
    document_id: str
    text: str
    vector: list[float]
    metadata: dict[str, str] = field(default_factory=dict)


class VectorStore(Protocol):
    def add(self, document_id: str, text: str, vector: list[float], metadata: dict[str, str] | None = None) -> str: ...
    def search(self, query_vector: list[float], top_k: int = 10) -> list[tuple[StoredChunk, float]]: ...
    def count(self) -> int: ...


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class InMemoryVectorStore:
    """Thread-safe InMemory vector store."""

    def __init__(self) -> None:
        self._chunks: dict[str, StoredChunk] = {}
        self._lock = threading.Lock()

    def add(self, document_id: str, text: str, vector: list[float], metadata: dict[str, str] | None = None) -> str:
        chunk_id = str(uuid.uuid4())
        with self._lock:
            self._chunks[chunk_id] = StoredChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                text=text,
                vector=list(vector),
                metadata=dict(metadata or {}),
            )
        return chunk_id

    def search(self, query_vector: list[float], top_k: int = 10) -> list[tuple[StoredChunk, float]]:
        with self._lock:
            chunks = list(self._chunks.values())
        if not chunks or not query_vector:
            return []
        scored = [(c, _cosine(query_vector, c.vector)) for c in chunks]
        scored.sort(key=lambda t: t[1], reverse=True)
        return scored[: max(0, top_k)]

    def count(self) -> int:
        with self._lock:
            return len(self._chunks)

    def to_hits(self, results: list[tuple[StoredChunk, float]]) -> list[ChunkHit]:
        return [
            ChunkHit(
                chunk_id=c.chunk_id,
                document_id=c.document_id,
                score=max(0.0, min(1.0, score)),
                text=c.text,
                metadata=c.metadata,
            )
            for c, score in results
        ]
