"""PgHybridClient — persistent HybridClient backed entirely by PostgreSQL.

Implements the ``HybridClient`` protocol (add / search / count /
delete_by_document) with kb_chunks as the single source of truth: embeddings
are persisted as JSONB and ranked by cosine in Python (dev scale), BM25 runs
on the CJK-bigram tsvector column. Everything survives restarts — this is
the client behind ``RAG_MODE=pg``.
"""
from __future__ import annotations

import logging
import uuid

from mate_tech_rag.api.schemas import ChunkHit
from mate_tech_rag.clients.pg_client import PGClient

_log = logging.getLogger(__name__)


def _norm(scores: list[float]) -> list[float]:
    """Min-max normalise to [0, 1]; single-item list maps to its own value."""
    if not scores:
        return []
    lo, hi = min(scores), max(scores)
    if hi - lo < 1e-9:
        return [1.0 if hi > 0 else 0.0 for _ in scores]
    return [(s - lo) / (hi - lo) for s in scores]


class PgHybridClient:
    """Vector (cosine over persisted embeddings) + BM25 fusion, all on PG."""

    def __init__(self, pg: PGClient, vector_weight: float = 0.7) -> None:
        self._pg = pg
        self._vector_weight = max(0.0, min(1.0, vector_weight))
        self._bm25_weight = 1.0 - self._vector_weight

    def add(
        self,
        document_id: str,
        text: str,
        vector: list[float],
        metadata: dict[str, str] | None = None,
    ) -> str:
        meta = dict(metadata or {})
        tenant_id = meta.get("tenant_id", "default")
        chunk_id = str(uuid.uuid4())
        self._pg.upsert_chunk(
            chunk_id, document_id, text, meta,
            embedding=vector, tenant_id=tenant_id,
        )
        return chunk_id

    def search(self, query: str, query_vector: list[float], top_k: int = 10) -> list[ChunkHit]:
        pool = max(top_k * 3, 10)
        vec_rows = self._pg.vector_search(query_vector, pool)
        bm25_rows = self._pg.bm25_search(query, pool)

        vec_by_id = {r["chunk_id"]: r for r in vec_rows}
        bm25_by_id = {r["chunk_id"]: r for r in bm25_rows}
        all_ids = list(dict.fromkeys([*vec_by_id.keys(), *bm25_by_id.keys()]))

        vec_scores = _norm([vec_by_id[c]["score"] for c in vec_by_id]) if vec_by_id else []
        bm25_scores = _norm([bm25_by_id[c]["score"] for c in bm25_by_id]) if bm25_by_id else []
        vec_norm = dict(zip(vec_by_id.keys(), vec_scores))
        bm25_norm = dict(zip(bm25_by_id.keys(), bm25_scores))

        fused: list[tuple[float, str]] = []
        for cid in all_ids:
            v = vec_norm.get(cid)
            b = bm25_norm.get(cid)
            if v is not None and b is not None:
                score = self._vector_weight * v + self._bm25_weight * b
            elif v is not None:
                score = self._vector_weight * v
            else:
                score = self._bm25_weight * b if b is not None else 0.0
            fused.append((score, cid))
        fused.sort(key=lambda t: t[0], reverse=True)

        hits: list[ChunkHit] = []
        for score, cid in fused[:top_k]:
            src = vec_by_id.get(cid) or bm25_by_id.get(cid)
            if not src:
                continue
            hits.append(
                ChunkHit(
                    chunk_id=cid,
                    document_id=src["document_id"],
                    score=round(min(max(score, 0.0), 1.0), 4),
                    text=src["text"],
                    metadata={str(k): str(v) for k, v in (src.get("metadata") or {}).items()},
                )
            )
        return hits

    def count(self) -> int:
        return self._pg.count_chunks()

    def delete_by_document(self, document_id: str) -> int:
        return self._pg.delete_by_document(document_id)
