"""Vector retrieval service (P1-RAG-04).

Performs semantic search over document chunks using cosine similarity.
Uses PostgreSQL + numpy as a lightweight vector store (no Milvus required).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
import numpy as np

from app.common.errors import LLMGWError
from app.config import settings
from app.models.repository import DocumentChunkRepository, DocumentRepository
from app.models.schemas import DocumentChunk

logger = logging.getLogger("techrag")

# Default embedding model identifier used when calling LLMGW.
EMBEDDING_MODEL_ID = "mock-embedding-v1"

# Maximum number of documents to scan per KB for retrieval.
_MAX_DOC_SCAN = 10000


class RetrievalService:
    def __init__(
        self,
        chunk_repository: DocumentChunkRepository,
        doc_repository: DocumentRepository,
    ) -> None:
        self._chunk_repo = chunk_repository
        self._doc_repo = doc_repository

    async def search(
        self,
        query_text: str,
        kb_id: str,
        tenant_id: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Search for chunks semantically similar to *query_text*.

        Returns a list of dicts sorted by descending similarity score,
        each containing ``chunkId``, ``content``, ``score``,
        ``documentId`` and ``documentName``.
        """

        query_embedding = await self._get_query_embedding(query_text)

        # Get all documents in the KB.
        docs, _ = await self._doc_repo.list(
            tenant_id, kb_id, page=1, page_size=_MAX_DOC_SCAN
        )
        if not docs:
            return []

        doc_ids = [d.id for d in docs]
        doc_map = {d.id: d for d in docs}

        # Get all GENERATED chunks for these documents.
        chunks = await self._chunk_repo.list_generated_by_documents(
            doc_ids, tenant_id
        )
        if not chunks:
            return []

        # Compute cosine similarity and rank.
        results = self._rank_by_similarity(
            query_embedding, chunks, doc_map
        )
        return results[:top_k]

    # ----------------------------------------------------------- LLMGW call

    async def _get_query_embedding(self, query_text: str) -> np.ndarray:
        """Call LLMGW single embeddings endpoint and return the query vector."""

        url = f"{settings.llmgw_base_url}/api/v1/llmgw/embeddings"
        payload = {"input": query_text, "modelId": EMBEDDING_MODEL_ID}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=30.0)
                resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning("LLMGW query embedding HTTP error: %s", exc)
            raise LLMGWError(
                f"LLMGW embedding 调用失败: HTTP {exc.response.status_code}",
                data={"url": url},
            ) from exc
        except httpx.RequestError as exc:
            logger.warning("LLMGW query embedding request error: %s", exc)
            raise LLMGWError(
                f"LLMGW embedding 请求失败: {exc}",
                data={"url": url},
            ) from exc

        data = resp.json()
        embedding = data["data"][0]["embedding"]
        return np.array(embedding, dtype=np.float64)

    # ------------------------------------------------------- similarity rank

    @staticmethod
    def _rank_by_similarity(
        query_embedding: np.ndarray,
        chunks: list[DocumentChunk],
        doc_map: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Compute cosine similarity and return sorted results."""

        query_norm = np.linalg.norm(query_embedding)
        if query_norm == 0:
            return []

        results: list[dict[str, Any]] = []
        for chunk in chunks:
            if not chunk.embedding:
                continue
            try:
                chunk_vec = np.array(
                    json.loads(chunk.embedding), dtype=np.float64
                )
            except (json.JSONDecodeError, ValueError):
                continue

            chunk_norm = np.linalg.norm(chunk_vec)
            if chunk_norm == 0:
                continue

            score = float(
                np.dot(query_embedding, chunk_vec)
                / (query_norm * chunk_norm)
            )

            doc = doc_map.get(chunk.document_id)
            results.append(
                {
                    "chunkId": chunk.id,
                    "content": chunk.content,
                    "score": score,
                    "documentId": chunk.document_id,
                    "documentName": doc.filename if doc else "",
                }
            )

        results.sort(key=lambda r: r["score"], reverse=True)
        return results
