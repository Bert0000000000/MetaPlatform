"""Citation service (P1-RAG-10).

Locates exact text spans in source documents that match a query, calculates
confidence scores, and generates highlight markers for citation tracing.

Confidence formula: 0.4 * semantic_sim + 0.3 * exact_match_ratio + 0.3 * position_score
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
import numpy as np

from app.common.errors import CitationNotFoundError
from app.config import settings
from app.models.repository import DocumentChunkRepository, DocumentRepository

logger = logging.getLogger("techrag")

# Default embedding model for semantic similarity.
EMBEDDING_MODEL_ID = "mock-embedding-v1"


class CitationService:
    """Citation location and confidence scoring service."""

    def __init__(
        self,
        chunk_repository: DocumentChunkRepository,
        doc_repository: DocumentRepository,
    ) -> None:
        self._chunk_repo = chunk_repository
        self._doc_repo = doc_repository

    async def locate_citations(
        self,
        tenant_id: str,
        query: str,
        chunk_ids: list[str] | None = None,
        search_results: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """Locate citations for a query across specified chunks or search results.

        Either *chunk_ids* or *search_results* should be provided. When both
        are given, chunk_ids takes precedence.
        """

        # Resolve the set of chunks to process.
        if chunk_ids:
            chunks_data = await self._load_chunks_by_ids(tenant_id, chunk_ids)
        elif search_results:
            chunks_data = await self._load_chunks_from_results(
                tenant_id, search_results
            )
        else:
            return []

        if not chunks_data:
            return []

        # Get query embedding for semantic similarity.
        query_embedding = await self._get_query_embedding(query)

        citations: list[dict[str, Any]] = []
        for chunk_info in chunks_data:
            citation = await self._build_citation(
                query, query_embedding, chunk_info
            )
            if citation is not None:
                citations.append(citation)

        return citations

    async def get_citation(
        self, tenant_id: str, chunk_id: str, query: str = ""
    ) -> dict[str, Any]:
        """Get citation detail for a specific chunk."""

        chunk = await self._chunk_repo.get(chunk_id, tenant_id)
        if chunk is None:
            raise CitationNotFoundError(
                f"引用的 chunk 不存在: id={chunk_id}",
                data={"chunkId": chunk_id},
            )

        doc = await self._doc_repo.get(chunk.document_id, tenant_id)
        doc_name = doc.filename if doc else ""

        query_embedding = (
            await self._get_query_embedding(query) if query else None
        )

        chunk_info = {
            "chunk": chunk,
            "document_id": chunk.document_id,
            "document_name": doc_name,
        }

        citation = await self._build_citation(
            query, query_embedding, chunk_info
        )
        if citation is None:
            # Return a basic citation with zero confidence if no match found.
            return {
                "chunkId": chunk.id,
                "documentId": chunk.document_id,
                "documentName": doc_name,
                "textSpan": chunk.content[:200],
                "startOffset": 0,
                "endOffset": min(len(chunk.content), 200),
                "confidenceScore": 0.0,
                "highlightHtml": chunk.content[:200],
            }
        return citation

    async def batch_locate(
        self,
        tenant_id: str,
        query: str,
        chunk_ids: list[str],
    ) -> list[dict[str, Any]]:
        """Batch locate citations for multiple chunks."""

        return await self.locate_citations(
            tenant_id=tenant_id,
            query=query,
            chunk_ids=chunk_ids,
        )

    # ------------------------------------------------------- citation building

    async def _build_citation(
        self,
        query: str,
        query_embedding: np.ndarray | None,
        chunk_info: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Build a single citation with span matching and confidence scoring."""

        chunk = chunk_info["chunk"]
        content = chunk.content
        doc_id = chunk_info["document_id"]
        doc_name = chunk_info["document_name"]

        # Find the best matching text span.
        span_text, start_offset, end_offset = self._find_best_span(
            query, content
        )

        # Calculate confidence score components.
        semantic_sim = self._compute_semantic_similarity(
            query_embedding, chunk
        )
        exact_match_ratio = self._compute_exact_match_ratio(query, content)
        position_score = self._compute_position_score(start_offset, len(content))

        # Confidence: 0.4 * semantic_sim + 0.3 * exact_match_ratio + 0.3 * position_score
        confidence = (
            0.4 * semantic_sim
            + 0.3 * exact_match_ratio
            + 0.3 * position_score
        )

        # Generate highlight HTML.
        highlight_html = self._generate_highlight_html(
            content, start_offset, end_offset
        )

        return {
            "chunkId": chunk.id,
            "documentId": doc_id,
            "documentName": doc_name,
            "textSpan": span_text,
            "startOffset": start_offset,
            "endOffset": end_offset,
            "confidenceScore": float(confidence),
            "highlightHtml": highlight_html,
        }

    # ------------------------------------------------------- span matching

    @staticmethod
    def _find_best_span(
        query: str, content: str
    ) -> tuple[str, int, int]:
        """Find the best matching text span in content for the query.

        Uses a sliding window approach: finds the substring of content
        that has the highest token overlap with the query.
        """

        if not query or not content:
            return content[:200], 0, min(len(content), 200)

        query_tokens = set(
            t for t in re.split(r"[\s\W_]+", query.lower()) if t
        )
        if not query_tokens:
            return content[:200], 0, min(len(content), 200)

        # Split content into sentences for better span boundaries.
        sentences = re.split(r"(?<=[.!?])\s+", content)

        best_score = 0.0
        best_text = content[:200]
        best_start = 0
        best_end = min(len(content), 200)

        current_pos = 0
        # Try individual sentences and pairs of consecutive sentences.
        for i in range(len(sentences)):
            for j in range(i, min(i + 3, len(sentences))):
                span = " ".join(sentences[i : j + 1])
                span_start = content.find(sentences[i], current_pos if i == 0 else 0)
                if span_start == -1:
                    span_start = 0
                span_end = span_start + len(span)

                span_tokens = set(
                    t for t in re.split(r"[\s\W_]+", span.lower()) if t
                )
                if not span_tokens:
                    continue

                overlap = len(query_tokens & span_tokens)
                score = overlap / len(query_tokens)

                if score > best_score:
                    best_score = score
                    best_text = span
                    best_start = span_start
                    best_end = span_end

            if i == 0:
                current_pos += len(sentences[i])

        # If no good match found, return the beginning of the content.
        if best_score == 0:
            best_text = content[:200]
            best_start = 0
            best_end = min(len(content), 200)

        return best_text, best_start, best_end

    # ------------------------------------------------------- confidence components

    @staticmethod
    def _compute_semantic_similarity(
        query_embedding: np.ndarray | None,
        chunk: Any,
    ) -> float:
        """Compute cosine similarity between query and chunk embeddings."""

        if query_embedding is None or not chunk.embedding:
            return 0.0

        try:
            chunk_vec = np.array(
                json.loads(chunk.embedding), dtype=np.float64
            )
        except (json.JSONDecodeError, ValueError):
            return 0.0

        query_norm = np.linalg.norm(query_embedding)
        chunk_norm = np.linalg.norm(chunk_vec)
        if query_norm == 0 or chunk_norm == 0:
            return 0.0

        return float(np.dot(query_embedding, chunk_vec) / (query_norm * chunk_norm))

    @staticmethod
    def _compute_exact_match_ratio(query: str, content: str) -> float:
        """Compute the ratio of query tokens found in content."""

        query_tokens = [t for t in re.split(r"[\s\W_]+", query.lower()) if t]
        if not query_tokens:
            return 0.0

        content_lower = content.lower()
        matched = sum(1 for t in query_tokens if t in content_lower)
        return matched / len(query_tokens)

    @staticmethod
    def _compute_position_score(start_offset: int, content_length: int) -> float:
        """Score based on span position: earlier spans get higher scores."""

        if content_length == 0:
            return 0.0
        ratio = start_offset / content_length
        # Score decreases linearly from 1.0 (start) to 0.0 (end).
        return max(0.0, 1.0 - ratio)

    # ------------------------------------------------------- highlight HTML

    @staticmethod
    def _generate_highlight_html(
        content: str, start: int, end: int
    ) -> str:
        """Generate HTML with the matched span highlighted."""

        if start < 0 or end > len(content) or start >= end:
            return content[:500]

        # Build HTML with <mark> around the matched span.
        # Include some context around the match (up to 100 chars each side).
        context_before = max(0, start - 100)
        context_after = min(len(content), end + 100)

        prefix = content[context_before:start]
        matched = content[start:end]
        suffix = content[end:context_after]

        html = ""
        if context_before > 0:
            html += "..."
        html += prefix
        html += f"<mark>{matched}</mark>"
        html += suffix
        if context_after < len(content):
            html += "..."

        return html

    # ------------------------------------------------------- chunk loading

    async def _load_chunks_by_ids(
        self, tenant_id: str, chunk_ids: list[str]
    ) -> list[dict[str, Any]]:
        """Load chunks and their document metadata by chunk IDs."""

        result: list[dict[str, Any]] = []
        for chunk_id in chunk_ids:
            chunk = await self._chunk_repo.get(chunk_id, tenant_id)
            if chunk is None:
                continue
            doc = await self._doc_repo.get(chunk.document_id, tenant_id)
            result.append({
                "chunk": chunk,
                "document_id": chunk.document_id,
                "document_name": doc.filename if doc else "",
            })
        return result

    async def _load_chunks_from_results(
        self,
        tenant_id: str,
        search_results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Load chunks from search result dicts (containing chunkId)."""

        chunk_ids = [
            r.get("chunkId", "")
            for r in search_results
            if r.get("chunkId")
        ]
        return await self._load_chunks_by_ids(tenant_id, chunk_ids)

    # ------------------------------------------------------- embedding call

    async def _get_query_embedding(self, query_text: str) -> np.ndarray | None:
        """Call LLMGW for query embedding. Returns None on failure."""

        if not query_text:
            return None

        url = f"{settings.llmgw_base_url}/api/v1/llmgw/embeddings"
        payload = {"input": query_text, "modelId": EMBEDDING_MODEL_ID}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=30.0)
                resp.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.debug("Citation query embedding failed: %s", exc)
            return None
        except Exception as exc:
            logger.debug("Citation query embedding error: %s", exc)
            return None

        data = resp.json()
        embedding = data["data"][0]["embedding"]
        return np.array(embedding, dtype=np.float64)
