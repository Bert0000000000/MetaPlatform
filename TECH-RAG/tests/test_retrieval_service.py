"""Tests for RetrievalService (P1-RAG-04)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.common.errors import LLMGWError
from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    EmbeddingStatus,
)
from app.services.chunk_service import ChunkService
from app.services.document_service import DocumentService
from app.services.knowledge_base_service import KnowledgeBaseService
from app.services.retrieval_service import RetrievalService

TENANT = "tenant-test"


def _mock_response(json_data: dict, status_code: int = 200) -> MagicMock:
    """Build a mock httpx.Response-like object."""
    mock = MagicMock()
    mock.status_code = status_code
    mock.raise_for_status = MagicMock()
    if status_code >= 400:
        mock.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error",
            request=httpx.Request("POST", "http://test"),
            response=mock,
        )
    mock.json = MagicMock(return_value=json_data)
    return mock


async def _setup_doc_with_chunks(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    content: bytes = b"A" * 2500,
    kb_name: str = "retrieval-test-kb",
) -> tuple[str, str]:
    """Create KB -> upload doc -> chunk it. Returns (kb_id, doc_id)."""
    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name=kb_name)
    )
    doc = await doc_service.upload(TENANT, kb.id, "test.txt", content)
    await chunk_service.chunk_document(doc.id, TENANT)
    return kb.id, doc.id


async def _set_chunk_embeddings(
    chunk_service: ChunkService,
    doc_id: str,
    embeddings: list[list[float]],
) -> None:
    """Manually set embeddings on chunks to avoid calling LLMGW."""
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    for chunk, emb in zip(chunks, embeddings):
        await chunk_service._chunk_repo.update(
            chunk.id,
            TENANT,
            {
                "embedding": json.dumps(emb),
                "embedding_status": EmbeddingStatus.GENERATED,
            },
        )


# --------------------------------------------------------- success cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_search_success(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    retrieval_service: RetrievalService,
) -> None:
    """Search returns results sorted by similarity score."""

    kb_id, doc_id = await _setup_doc_with_chunks(
        kb_service, doc_service, chunk_service
    )

    # Set known embeddings for the 3 chunks.
    await _set_chunk_embeddings(
        chunk_service,
        doc_id,
        [
            [1.0, 0.0, 0.0],  # chunk 0
            [0.0, 1.0, 0.0],  # chunk 1
            [0.0, 0.0, 1.0],  # chunk 2
        ],
    )

    # Mock query embedding: closer to chunk 0 than chunk 1.
    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    results = await retrieval_service.search(
        query_text="test query",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=5,
    )

    assert len(results) == 3
    # Results should be sorted by score descending.
    assert results[0]["score"] >= results[1]["score"]
    assert results[1]["score"] >= results[2]["score"]
    # Chunk 0 ([1,0,0]) should be most similar to query [0.9,0.1,0].
    assert results[0]["score"] > results[1]["score"]
    # Each result should have required fields.
    for r in results:
        assert "chunkId" in r
        assert "content" in r
        assert "score" in r
        assert "documentId" in r
        assert "documentName" in r


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_search_topk(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    retrieval_service: RetrievalService,
) -> None:
    """topK parameter limits the number of returned results."""

    kb_id, doc_id = await _setup_doc_with_chunks(
        kb_service, doc_service, chunk_service
    )

    await _set_chunk_embeddings(
        chunk_service,
        doc_id,
        [
            [1.0, 0.0, 0.0],
            [0.8, 0.2, 0.0],
            [0.6, 0.4, 0.0],
        ],
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [1.0, 0.0, 0.0]}]}
    )

    results = await retrieval_service.search(
        query_text="test",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=1,
    )

    assert len(results) == 1


# --------------------------------------------------------- edge cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_search_no_results_empty_kb(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    retrieval_service: RetrievalService,
) -> None:
    """Searching a KB with no documents returns empty results."""

    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name="empty-kb")
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    results = await retrieval_service.search(
        query_text="test",
        kb_id=kb.id,
        tenant_id=TENANT,
        top_k=5,
    )

    assert results == []


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_search_no_results_no_generated_chunks(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    retrieval_service: RetrievalService,
) -> None:
    """Searching a KB with chunks but no GENERATED embeddings returns empty."""

    kb_id, _ = await _setup_doc_with_chunks(
        kb_service, doc_service, chunk_service
    )
    # Chunks are PENDING (not GENERATED), so no results.

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    results = await retrieval_service.search(
        query_text="test",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=5,
    )

    assert results == []


# --------------------------------------------------------- failure cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_search_llmgw_failure(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    retrieval_service: RetrievalService,
) -> None:
    """LLMGW embedding failure raises LLMGWError."""

    kb_id, doc_id = await _setup_doc_with_chunks(
        kb_service, doc_service, chunk_service
    )
    await _set_chunk_embeddings(
        chunk_service,
        doc_id,
        [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
    )

    mock_post.return_value = _mock_response(
        {"error": "unavailable"}, status_code=503
    )

    with pytest.raises(LLMGWError) as exc_info:
        await retrieval_service.search(
            query_text="test",
            kb_id=kb_id,
            tenant_id=TENANT,
            top_k=5,
        )

    assert int(exc_info.value.code) == 50003
