"""HybridClient（FACTUAL 检索：Milvus + BM25 融合）。

v3.0 Plan D：Milvus（向量）+ PG tsvector（BM25）= 事实型检索。
当前实现：InMemory 模拟（与原 vector_store 复用）。
"""
from __future__ import annotations

import threading
from typing import Protocol

from mate_tech_rag.api.schemas import ChunkHit
from mate_tech_rag.vector_store import InMemoryVectorStore, VectorStore


class HybridClient(Protocol):
    def search(self, query: str, query_vector: list[float], top_k: int = 10) -> list[ChunkHit]: ...
    def add(self, document_id: str, text: str, vector: list[float], metadata: dict[str, str] | None = None) -> str: ...
    def count(self) -> int: ...


class InMemoryHybridClient:
    """单存储 InMemory 实现。Milvus + BM25 接入在 TC-5.6.4 实施。"""

    def __init__(self) -> None:
        self._store: VectorStore = InMemoryVectorStore()
        self._lock = threading.Lock()

    def search(self, query: str, query_vector: list[float], top_k: int = 10) -> list[ChunkHit]:
        results = self._store.search(query_vector, top_k)
        return self._store.to_hits(results)

    def add(
        self,
        document_id: str,
        text: str,
        vector: list[float],
        metadata: dict[str, str] | None = None,
    ) -> str:
        return self._store.add(document_id, text, vector, metadata)

    def count(self) -> int:
        return self._store.count()
