"""Hybrid search service (P1-RAG-05).

Combines vector retrieval (RetrievalService) and BM25 keyword search
(KeywordSearchService) using Reciprocal Rank Fusion (RRF).
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.keyword_search_service import KeywordSearchService
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger("techrag")

# RRF constant (standard value from the original paper).
_RRF_K = 60


class HybridSearchService:
    """Hybrid search combining vector and keyword retrieval via RRF."""

    def __init__(
        self,
        retrieval_service: RetrievalService,
        keyword_search_service: KeywordSearchService,
    ) -> None:
        self._retrieval = retrieval_service
        self._keyword = keyword_search_service

    async def hybrid_search(
        self,
        query: str,
        kb_id: str,
        tenant_id: str,
        top_k: int = 5,
        vector_weight: float = 0.7,
    ) -> list[dict[str, Any]]:
        """Perform hybrid search and return RRF-fused results.

        *vector_weight* controls the relative contribution of vector vs.
        keyword results. It is applied as a multiplier on the RRF score
        of each retrieval channel.
        """

        # Fetch a larger pool from each channel to improve fusion quality.
        pool_k = max(top_k * 4, 20)

        # Run both searches (sequentially to keep it simple; could be
        # parallelised with asyncio.gather if needed).
        vector_results = await self._retrieval.search(
            query_text=query,
            kb_id=kb_id,
            tenant_id=tenant_id,
            top_k=pool_k,
        )
        keyword_results = await self._keyword.search(
            query=query,
            kb_id=kb_id,
            tenant_id=tenant_id,
            top_k=pool_k,
        )

        fused = self._rrf_fuse(
            vector_results, keyword_results, vector_weight
        )
        return fused[:top_k]

    # ------------------------------------------------------- RRF fusion

    @staticmethod
    def _rrf_fuse(
        vector_results: list[dict[str, Any]],
        keyword_results: list[dict[str, Any]],
        vector_weight: float,
    ) -> list[dict[str, Any]]:
        """Fuse two ranked lists using Reciprocal Rank Fusion.

        ``rrf_score(d) = vector_weight * 1/(k + rank_v(d))
                       + (1 - vector_weight) * 1/(k + rank_kw(d))``
        """

        scores: dict[str, float] = {}
        meta: dict[str, dict[str, Any]] = {}

        kw_weight = 1.0 - vector_weight

        for rank, r in enumerate(vector_results):
            cid = r["chunkId"]
            rrf = vector_weight * (1.0 / (_RRF_K + rank + 1))
            scores[cid] = scores.get(cid, 0.0) + rrf
            if cid not in meta:
                meta[cid] = r

        for rank, r in enumerate(keyword_results):
            cid = r["chunkId"]
            rrf = kw_weight * (1.0 / (_RRF_K + rank + 1))
            scores[cid] = scores.get(cid, 0.0) + rrf
            if cid not in meta:
                meta[cid] = r

        # Build fused results, using the RRF score as the final score.
        fused: list[dict[str, Any]] = []
        for cid, rrf_score in scores.items():
            entry = dict(meta[cid])
            entry["score"] = float(rrf_score)
            fused.append(entry)

        fused.sort(key=lambda r: r["score"], reverse=True)
        return fused
