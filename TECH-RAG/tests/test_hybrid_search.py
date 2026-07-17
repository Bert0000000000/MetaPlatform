"""Tests for HybridSearchService (P1-RAG-05 RRF fusion)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    EmbeddingStatus,
)
from app.services.chunk_service import ChunkService
from app.services.document_service import DocumentService
from app.services.hybrid_search_service import HybridSearchService
from app.services.knowledge_base_service import KnowledgeBaseService

TENANT = "tenant-test"


def _mock_response(json_data: dict, status_code: int = 200):
    from unittest.mock import MagicMock
    import httpx

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


async def _setup_doc_with_content(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    content: bytes,
    kb_name: str = "hybrid-test-kb",
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
async def test_hybrid_search_success(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    hybrid_search_service: HybridSearchService,
) -> None:
    """Hybrid search combines vector and keyword results via RRF."""

    content = (
        b"Machine learning models for natural language processing. "
        b"Deep learning neural networks for text classification. "
        b"Machine learning is a subset of artificial intelligence."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="hybrid-basic"
    )

    # Set known embeddings so vector search returns results.
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service,
        doc_id,
        [[1.0, 0.0, 0.0] for _ in chunks],
    )

    # Mock query embedding.
    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    results = await hybrid_search_service.hybrid_search(
        query="machine learning",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=5,
        vector_weight=0.7,
    )

    assert len(results) > 0
    # Results should be sorted by score descending.
    for i in range(len(results) - 1):
        assert results[i]["score"] >= results[i + 1]["score"]
    # Each result should have required fields.
    for r in results:
        assert "chunkId" in r
        assert "content" in r
        assert "score" in r
        assert "documentId" in r
        assert "documentName" in r


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_hybrid_search_topk_limit(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    hybrid_search_service: HybridSearchService,
) -> None:
    """topK parameter limits the number of fused results."""

    content = (
        b"Search engine optimization techniques for web. "
        b"Search ranking algorithms and page rank. "
        b"Search query processing and indexing. "
        b"Search results relevance scoring methods. "
        b"Search engine crawlers and web scraping."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="hybrid-topk"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service,
        doc_id,
        [[1.0, 0.0, 0.0] for _ in chunks],
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    results = await hybrid_search_service.hybrid_search(
        query="search engine",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=2,
        vector_weight=0.5,
    )

    assert len(results) <= 2


# --------------------------------------------------------- edge cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_hybrid_search_empty_kb(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    hybrid_search_service: HybridSearchService,
) -> None:
    """Hybrid search on an empty KB returns empty results."""

    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name="hybrid-empty-kb")
    )

    # Mock the LLMGW embedding call (vector search fetches embedding
    # before checking for docs, so we must mock even for empty KB).
    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    results = await hybrid_search_service.hybrid_search(
        query="test",
        kb_id=kb.id,
        tenant_id=TENANT,
        top_k=5,
    )

    assert results == []


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_hybrid_search_rrf_fusion_combines_channels(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    hybrid_search_service: HybridSearchService,
) -> None:
    """RRF fusion produces results that appear in either channel."""

    content = (
        b"Artificial intelligence and machine learning. "
        b"Neural networks deep learning models."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="hybrid-rrf"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service,
        doc_id,
        [[1.0, 0.0, 0.0] for _ in chunks],
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    results = await hybrid_search_service.hybrid_search(
        query="machine learning",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=10,
        vector_weight=0.5,
    )

    # All chunks should appear in the fused results since both channels
    # return them.
    assert len(results) > 0
    # RRF scores should be positive.
    for r in results:
        assert r["score"] > 0
