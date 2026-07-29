"""Hybrid v2 client: Milvus (vector) + PG (BM25) score fusion (TC-5.6.4 完整版).

Rerank by weighted score fusion: 0.5 * vector_sim + 0.5 * bm25_norm.
"""
from __future__ import annotations

import logging

from mate_tech_rag.api.schemas import ChunkHit
from mate_tech_rag.clients.milvus_client import MilvusHybridClient
from mate_tech_rag.clients.pg_client import PGClient
from mate_tech_rag.vector_store import InMemoryVectorStore

_log = logging.getLogger(__name__)


class HybridV2Client:
    """Real hybrid retrieval: Milvus (vector) + PG (BM25)."""

    def __init__(
        self,
        milvus: MilvusHybridClient | None = None,
        pg: PGClient | None = None,
        vector_weight: float = 0.5,
    ):
        self._milvus = milvus or MilvusHybridClient()
        self._pg = pg or PGClient()
        self._vector_weight = vector_weight
        self._fallback = InMemoryVectorStore()

    def add(self, document_id: str, text: str, vector: list[float], metadata: dict[str, str] | None = None) -> str:
        chunk_id = self._milvus.add(document_id, text, vector, metadata)
        self._pg.upsert_chunk(chunk_id, document_id, text, metadata)
        return chunk_id

    def search(self, query: str, query_vector: list[float], top_k: int = 10) -> list[ChunkHit]:
        # Vector search
        vec_hits = self._milvus.search(query, query_vector, top_k)
        vec_map = {h.chunk_id: (h, 1.0) for h in vec_hits}

        # BM25 search
        bm25_hits = self._pg.bm25_search(query, top_k)

        # Normalize BM25
        max_bm25 = max((h["score"] for h in bm25_hits), default=1.0) or 1.0
        bm25_map = {h["chunk_id"]: h for h in bm25_hits}

        # Fuse
        all_ids = set(vec_map) | set(bm25_map)
        fused = []
        for cid in all_ids:
            vec_hit, vec_score = vec_map.get(cid, (None, 0.0))
            bm25 = bm25_map.get(cid)
            bm25_norm = (bm25["score"] / max_bm25) if bm25 else 0.0
            combined = self._vector_weight * vec_score + (1 - self._vector_weight) * bm25_norm
            base = vec_hit
            if base is None and bm25 is not None:
                base = ChunkHit(
                    chunk_id=cid,
                    document_id=bm25["document_id"],
                    score=combined,
                    text=bm25["text"],
                    metadata={**bm25.get("metadata", {}), "mode": "FACTUAL"},
                )
            elif base is not None:
                base = base.model_copy(update={"score": combined})
            if base is not None:
                fused.append(base)

        fused.sort(key=lambda h: h.score, reverse=True)
        return fused[: max(1, top_k)]

    def count(self) -> int:
        v = self._milvus.count()
        p = self._pg.count_chunks()
        return max(v, p)

    def close(self) -> None:
        self._milvus.close()
        self._pg.close()
