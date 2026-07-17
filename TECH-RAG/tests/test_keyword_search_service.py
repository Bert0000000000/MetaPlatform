"""Tests for KeywordSearchService (P1-RAG-05 BM25)."""

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
from app.services.keyword_search_service import KeywordSearchService
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
    kb_name: str = "kw-test-kb",
    filename: str = "test.txt",
) -> tuple[str, str]:
    """Create KB -> upload doc with custom content -> chunk it."""
    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name=kb_name)
    )
    doc = await doc_service.upload(TENANT, kb.id, filename, content)
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
async def test_keyword_search_success(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    keyword_search_service: KeywordSearchService,
) -> None:
    """BM25 search returns results sorted by descending score."""

    content = (
        b"Machine learning models for natural language processing. "
        b"Deep learning neural networks for text classification. "
        b"Machine learning is a subset of artificial intelligence."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="kw-basic"
    )

    results = await keyword_search_service.search(
        query="machine learning",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=5,
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
        assert r["score"] > 0


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_keyword_search_topk_limit(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    keyword_search_service: KeywordSearchService,
) -> None:
    """topK parameter limits the number of returned results."""

    # Create a document with enough text to produce multiple chunks.
    content = (
        b"search engine optimization techniques. "
        b"search ranking algorithms and page rank. "
        b"search query processing and indexing. "
        b"search results relevance scoring methods. "
        b"search engine crawlers and web scraping."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="kw-topk"
    )

    results = await keyword_search_service.search(
        query="search",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=1,
    )

    assert len(results) == 1
    assert results[0]["score"] > 0


# --------------------------------------------------------- edge cases


async def test_keyword_search_empty_kb(
    kb_service: KnowledgeBaseService,
    keyword_search_service: KeywordSearchService,
) -> None:
    """Searching a KB with no documents returns empty results."""

    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name="kw-empty-kb")
    )

    results = await keyword_search_service.search(
        query="test",
        kb_id=kb.id,
        tenant_id=TENANT,
        top_k=5,
    )

    assert results == []


async def test_keyword_search_no_matching_terms(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    keyword_search_service: KeywordSearchService,
) -> None:
    """Searching with terms not present in any chunk returns empty."""

    content = b"The quick brown fox jumps over the lazy dog."
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="kw-no-match"
    )

    results = await keyword_search_service.search(
        query="quantum physics",
        kb_id=kb_id,
        tenant_id=TENANT,
        top_k=5,
    )

    assert results == []
