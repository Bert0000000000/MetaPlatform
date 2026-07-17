"""Graph-enhanced retrieval service (P1-RAG-08).

Combines hybrid search (vector + BM25) with knowledge-graph reasoning from
TECH-ONT to expand retrieval scope. Uses RRF to fuse initial results with
graph-expanded results.

When TECH-ONT is unavailable, gracefully falls back to normal hybrid search.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.hybrid_search_service import HybridSearchService
from app.services.keyword_search_service import KeywordSearchService

logger = logging.getLogger("techrag")

# RRF constant for fusing initial + expanded results.
_RRF_K = 60


class GraphEnhancedService:
    """Graph-enhanced retrieval combining RAG search with ontology reasoning."""

    def __init__(
        self,
        hybrid_search_service: HybridSearchService,
        keyword_search_service: KeywordSearchService,
    ) -> None:
        self._hybrid = hybrid_search_service
        self._keyword = keyword_search_service

    async def graph_search(
        self,
        tenant_id: str,
        query: str,
        kb_id: str,
        depth: int = 1,
        top_k: int = 10,
    ) -> dict[str, Any]:
        """Perform graph-enhanced search.

        Steps:
        1. Run hybrid search (vector + BM25) to get initial results.
        2. Query TECH-ONT knowledge graph for related concepts/entities.
        3. Use graph relations to expand retrieval (find chunks mentioning
           connected entities).
        4. RRF-fuse expanded results with initial results.
        5. Return enriched results with graph context.

        Falls back to normal hybrid search when ONT is unavailable.
        """

        # Step 1: Initial hybrid search.
        initial_results = await self._hybrid.hybrid_search(
            query=query,
            kb_id=kb_id,
            tenant_id=tenant_id,
            top_k=max(top_k * 2, 20),
        )

        # Step 2: Query ONT knowledge graph.
        graph_context = await self._query_ont_graph(query, depth)

        # If ONT returned no graph data, return initial results as-is.
        if not graph_context["nodes"]:
            return {
                "chunks": self._format_results(initial_results[:top_k]),
                "graphContext": graph_context,
            }

        # Step 3: Expand retrieval using graph entities.
        entity_labels = [
            n["label"] for n in graph_context["nodes"] if n.get("label")
        ]
        expanded_results = await self._expand_retrieval(
            tenant_id, kb_id, entity_labels, top_k
        )

        # Step 4: RRF-fuse initial + expanded results.
        fused = self._rrf_fuse(initial_results, expanded_results)

        return {
            "chunks": self._format_results(fused[:top_k]),
            "graphContext": graph_context,
        }

    # ------------------------------------------------------- ONT graph query

    async def _query_ont_graph(
        self, query: str, depth: int
    ) -> dict[str, Any]:
        """Call TECH-ONT graph query API.

        Returns a dict with ``nodes``, ``edges``, and ``relations``.
        Falls back to empty context when ONT is unavailable.
        """

        if not settings.ont_base_url:
            return {"nodes": [], "edges": [], "relations": []}

        url = f"{settings.ont_base_url}/api/v1/ont/graph/query"
        payload = {"query": query, "depth": depth}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=15.0)
                resp.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("ONT graph query failed, falling back: %s", exc)
            return {"nodes": [], "edges": [], "relations": []}
        except Exception as exc:
            logger.warning("ONT graph query unexpected error: %s", exc)
            return {"nodes": [], "edges": [], "relations": []}

        data = resp.json()
        # Normalise ONT response into our graph context shape.
        return {
            "nodes": data.get("nodes", []),
            "edges": data.get("edges", []),
            "relations": data.get("relations", []),
        }

    # ------------------------------------------------- graph-based expansion

    async def _expand_retrieval(
        self,
        tenant_id: str,
        kb_id: str,
        entity_labels: list[str],
        top_k: int,
    ) -> list[dict[str, Any]]:
        """Search for chunks that mention graph entity labels.

        Uses keyword search to find chunks containing entity labels, which
        effectively expands the retrieval scope beyond the original query.
        """

        if not entity_labels:
            return []

        # Join entity labels into a search query.
        expansion_query = " ".join(entity_labels[:10])

        results = await self._keyword.search(
            query=expansion_query,
            kb_id=kb_id,
            tenant_id=tenant_id,
            top_k=max(top_k * 2, 20),
        )
        return results

    # ----------------------------------------------------------- RRF fusion

    @staticmethod
    def _rrf_fuse(
        initial: list[dict[str, Any]],
        expanded: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Fuse two ranked lists using Reciprocal Rank Fusion (equal weight)."""

        scores: dict[str, float] = {}
        meta: dict[str, dict[str, Any]] = {}

        for rank, r in enumerate(initial):
            cid = r["chunkId"]
            rrf = 1.0 / (_RRF_K + rank + 1)
            scores[cid] = scores.get(cid, 0.0) + rrf
            if cid not in meta:
                meta[cid] = r

        for rank, r in enumerate(expanded):
            cid = r["chunkId"]
            rrf = 0.8 / (_RRF_K + rank + 1)  # Slight discount for expanded.
            scores[cid] = scores.get(cid, 0.0) + rrf
            if cid not in meta:
                meta[cid] = r

        fused: list[dict[str, Any]] = []
        for cid, rrf_score in scores.items():
            entry = dict(meta[cid])
            entry["score"] = float(rrf_score)
            fused.append(entry)

        fused.sort(key=lambda r: r["score"], reverse=True)
        return fused

    # ------------------------------------------------------- result formatting

    @staticmethod
    def _format_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Format search results with relevance_score field."""

        formatted = []
        for r in results:
            entry = dict(r)
            entry["relevanceScore"] = entry.get("score", 0.0)
            formatted.append(entry)
        return formatted
