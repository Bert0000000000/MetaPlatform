"""Strategy base classes (HybridStrategy / GraphStrategy / ThematicStrategy)."""
from __future__ import annotations

import time

from mate_tech_rag.clients.graphrag_client import GraphRAGClient
from mate_tech_rag.clients.hybrid_client import HybridClient
from mate_tech_rag.clients.lightrag_client import LightRAGClient
from mate_tech_rag.embedder import Embedder
from mate_tech_rag.router import RetrievalMode, RetrievalResult


class HybridStrategy:
    """FACTUAL: Milvus + BM25 hybrid."""
    mode = RetrievalMode.FACTUAL

    def __init__(self, hybrid_client: HybridClient, embedder: Embedder) -> None:
        self._client = hybrid_client
        self._embedder = embedder

    def search(self, query: str, top_k: int) -> RetrievalResult:
        start = time.perf_counter()
        vec = self._embedder.embed(query)
        hits = self._client.search(query, vec, top_k)
        return RetrievalResult(
            mode=self.mode,
            hits=hits,
            latency_ms=int((time.perf_counter() - start) * 1000),
        )


class GraphStrategy:
    """ENTITY: Neo4j entity graph (GraphRAG)."""
    mode = RetrievalMode.ENTITY

    def __init__(self, graph_client: GraphRAGClient) -> None:
        self._client = graph_client

    def search(self, query: str, top_k: int) -> RetrievalResult:
        start = time.perf_counter()
        hits = self._client.query(query, top_k)
        return RetrievalResult(
            mode=self.mode,
            hits=hits,
            latency_ms=int((time.perf_counter() - start) * 1000),
        )


class ThematicStrategy:
    """THEMATIC: LightRAG thematic graph."""
    mode = RetrievalMode.THEMATIC

    def __init__(self, lightrag_client: LightRAGClient) -> None:
        self._client = lightrag_client

    def search(self, query: str, top_k: int) -> RetrievalResult:
        start = time.perf_counter()
        hits = self._client.query(query, top_k)
        return RetrievalResult(
            mode=self.mode,
            hits=hits,
            latency_ms=int((time.perf_counter() - start) * 1000),
        )