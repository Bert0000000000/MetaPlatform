"""Hybrid v2 client: Milvus (vector) + PG (BM25) score fusion (TC-5.6.4 完整版).

Rerank by weighted score fusion: 0.5 * vector_sim + 0.5 * bm25_norm.

P1.6 architecture hook: ``InMemoryHybridV2Client`` is a fully in-memory
implementation of the same score-fusion contract, allowing unit tests and
dev environments to exercise the fusion math (vector * vector_weight +
bm25 * keyword_weight) without standing up Milvus or PG. Activated by
``RAG_MODE=hybrid_v2`` (forced in-memory) or as graceful degradation
when both Milvus and PG are unreachable.
"""
from __future__ import annotations

import logging
import math
import threading
from collections import Counter

from mate_tech_rag.api.schemas import ChunkHit
from mate_tech_rag.clients.milvus_client import MilvusHybridClient
from mate_tech_rag.clients.pg_client import PGClient
from mate_tech_rag.tokenize import tokenize_for_match
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


# ---------------------------------------------------------------------------
# InMemoryHybridV2Client (P1.6 — dev / test mock with full score fusion math)
# ---------------------------------------------------------------------------
class InMemoryHybridV2Client:
    """Pure in-memory HybridV2: VectorStore (cosine) + BM25 score fusion.

    Mirrors the score-fusion contract of ``HybridV2Client``:

        combined_score = vector_weight * norm(vector_score)
                       + (1 - vector_weight) * norm(bm25_score)

    Both scores are min-max normalized to ``[0, 1]`` so the weights are
    meaningful. When only one side has hits for a chunk, that side's
    normalized score contributes 0 from the other side — preserving the
    "vector OR bm25" semantic rather than collapsing to simple addition.

    Parameters
    ----------
    vector_weight : float
        Weight in ``[0, 1]``; default 0.5 (matches the real HybridV2 default).
    k1, b : float
        Standard BM25 saturation + length-normalization parameters.
    """

    DEFAULT_K1 = 1.2
    DEFAULT_B = 0.75

    def __init__(
        self,
        *,
        vector_weight: float = 0.5,
        k1: float = DEFAULT_K1,
        b: float = DEFAULT_B,
    ) -> None:
        if not 0.0 <= vector_weight <= 1.0:
            raise ValueError("vector_weight must be in [0, 1]")
        self._vector_weight = vector_weight
        self._keyword_weight = 1.0 - vector_weight
        self._k1 = k1
        self._b = b
        self._store = InMemoryVectorStore()
        # BM25 index: chunk_id -> (text, token_counts, doc_len)
        self._bm25: dict[str, tuple[str, Counter, int]] = {}
        self._doc_lens: list[int] = []
        self._avg_doc_len: float = 0.0
        self._df: Counter = Counter()
        self._lock = threading.Lock()

    # -- index API ---------------------------------------------------------
    def add(
        self,
        document_id: str,
        text: str,
        vector: list[float],
        metadata: dict[str, str] | None = None,
    ) -> str:
        """Add a chunk to both vector store and BM25 index."""
        chunk_id = self._store.add(document_id, text, vector, metadata)
        tokens = tokenize_for_match(text)
        token_counts = Counter(tokens)
        with self._lock:
            self._bm25[chunk_id] = (text, token_counts, len(tokens))
            self._doc_lens.append(len(tokens))
            for term in token_counts:
                self._df[term] += 1
            n = len(self._doc_lens)
            self._avg_doc_len = sum(self._doc_lens) / n if n else 0.0
        return chunk_id

    # -- retrieval ---------------------------------------------------------
    def _bm25_score(self, chunk_id: str, query_tokens: list[str]) -> float:
        """Compute raw BM25 score for ``chunk_id`` given ``query_tokens``."""
        if not query_tokens:
            return 0.0
        _, token_counts, doc_len = self._bm25[chunk_id]
        if doc_len == 0:
            return 0.0
        n = len(self._doc_lens)
        if n == 0:
            return 0.0
        avgdl = self._avg_doc_len or 1.0
        score = 0.0
        for term in query_tokens:
            if term not in token_counts:
                continue
            f = token_counts[term]
            df = self._df.get(term, 0)
            # IDF (Lucene-style, +1 to avoid log(0)).
            idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
            denom = f + self._k1 * (1 - self._b + self._b * doc_len / avgdl)
            score += idf * (f * (self._k1 + 1)) / (denom or 1.0)
        return float(score)

    def _bm25_search(self, query: str, top_k: int) -> list[dict]:
        """Score every indexed chunk by BM25; return top_k descending."""
        query_tokens = list(tokenize_for_match(query))
        if not query_tokens:
            return []
        with self._lock:
            ids = list(self._bm25.keys())
            scored = [(cid, self._bm25_score(cid, query_tokens)) for cid in ids]
        scored.sort(key=lambda t: t[1], reverse=True)
        out: list[dict] = []
        for cid, score in scored[: max(0, top_k)]:
            if score <= 0:
                break
            text, _, _ = self._bm25[cid]
            stored = self._store._chunks.get(cid)  # type: ignore[attr-defined]
            if stored is None:
                continue
            out.append(
                {
                    "chunk_id": cid,
                    "document_id": stored.document_id,
                    "text": text,
                    "metadata": dict(stored.metadata),
                    "score": float(score),
                }
            )
        return out

    @staticmethod
    def _minmax(scores: dict[str, float]) -> dict[str, float]:
        """Min-max normalize a dict of scores to ``[0, 1]`` (constant -> 1.0)."""
        if not scores:
            return {}
        vals = list(scores.values())
        lo, hi = min(vals), max(vals)
        if hi == lo:
            return {k: 1.0 for k in scores}
        span = hi - lo
        return {k: (v - lo) / span for k, v in scores.items()}

    def search(
        self,
        query: str,
        query_vector: list[float],
        top_k: int = 10,
    ) -> list[ChunkHit]:
        """Vector + BM25 score fusion. Mirrors ``HybridV2Client.search`` semantics."""
        effective_top_k = max(1, top_k)

        # 1. Vector side.
        vec_results = self._store.search(query_vector, effective_top_k)
        vec_raw: dict[str, float] = {c.chunk_id: score for c, score in vec_results}

        # 2. BM25 side.
        bm25_hits = self._bm25_search(query, effective_top_k)
        bm25_raw: dict[str, float] = {h["chunk_id"]: h["score"] for h in bm25_hits}

        # 3. Normalize each side independently to [0, 1] so weights are meaningful.
        vec_norm = self._minmax(vec_raw)
        bm25_norm = self._minmax(bm25_raw)

        # 4. Union of chunk ids from both sides; fuse with weighted sum.
        all_ids = set(vec_norm) | set(bm25_norm)
        fused: list[ChunkHit] = []
        for cid in all_ids:
            v = vec_norm.get(cid, 0.0)
            k = bm25_norm.get(cid, 0.0)
            combined = self._vector_weight * v + self._keyword_weight * k
            stored = self._store._chunks.get(cid)  # type: ignore[attr-defined]
            if stored is None:
                continue
            fused.append(
                ChunkHit(
                    chunk_id=cid,
                    document_id=stored.document_id,
                    score=combined,
                    text=stored.text,
                    metadata={**stored.metadata, "mode": "FACTUAL"},
                )
            )

        fused.sort(key=lambda h: h.score, reverse=True)
        return fused[:effective_top_k]

    def count(self) -> int:
        return self._store.count()

    def close(self) -> None:
        pass
