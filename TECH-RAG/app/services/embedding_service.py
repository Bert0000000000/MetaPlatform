"""Embedding generation service (P1-RAG-03).

Calls TECH-LLMGW to generate vector embeddings for document chunks and
persists them back to the ``rag_document_chunk`` table.
"""

from __future__ import annotations

import json
import logging

import httpx

from app.common.errors import EmbeddingFailedError, LLMGWError
from app.config import settings
from app.models.repository import DocumentChunkRepository, DocumentRepository
from app.models.schemas import DocumentStatus, EmbeddingStatus

logger = logging.getLogger("techrag")

# Default embedding model identifier used when calling LLMGW.
EMBEDDING_MODEL_ID = "mock-embedding-v1"


class EmbeddingService:
    def __init__(
        self,
        chunk_repository: DocumentChunkRepository,
        doc_repository: DocumentRepository,
    ) -> None:
        self._chunk_repo = chunk_repository
        self._doc_repo = doc_repository

    async def generate_embeddings(
        self, document_id: str, tenant_id: str
    ) -> int:
        """Generate embeddings for all PENDING chunks of a document.

        Returns the number of chunks that were embedded.
        """

        chunks = await self._chunk_repo.list_pending_by_document(
            document_id, tenant_id
        )
        if not chunks:
            return 0

        inputs = [c.content for c in chunks]
        embeddings = await self._call_llmgw_batch(inputs)

        if len(embeddings) != len(chunks):
            raise EmbeddingFailedError(
                f"LLMGW 返回的 embedding 数量不匹配: expected={len(chunks)}, got={len(embeddings)}",
                data={
                    "documentId": document_id,
                    "expected": len(chunks),
                    "actual": len(embeddings),
                },
            )

        for chunk, embedding in zip(chunks, embeddings):
            await self._chunk_repo.update(
                chunk.id,
                tenant_id,
                {
                    "embedding": json.dumps(embedding),
                    "embedding_status": EmbeddingStatus.GENERATED,
                },
            )

        await self._doc_repo.update(
            document_id,
            tenant_id,
            {"status": DocumentStatus.INDEXED},
        )

        return len(chunks)

    # ----------------------------------------------------------- LLMGW call

    async def _call_llmgw_batch(self, inputs: list[str]) -> list[list[float]]:
        """Call LLMGW batch embeddings endpoint and return vectors."""

        url = f"{settings.llmgw_base_url}/api/v1/llmgw/embeddings/batch"
        payload = {"inputs": inputs, "modelId": EMBEDDING_MODEL_ID}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=30.0)
                resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning("LLMGW batch embeddings HTTP error: %s", exc)
            raise LLMGWError(
                f"LLMGW 批量 embedding 调用失败: HTTP {exc.response.status_code}",
                data={"url": url},
            ) from exc
        except httpx.RequestError as exc:
            logger.warning("LLMGW batch embeddings request error: %s", exc)
            raise LLMGWError(
                f"LLMGW 批量 embedding 请求失败: {exc}",
                data={"url": url},
            ) from exc

        data = resp.json()
        # Sort by index to ensure ordering matches input order.
        items = sorted(data.get("data", []), key=lambda d: d.get("index", 0))
        return [item["embedding"] for item in items]
