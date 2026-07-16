"""Tests for EmbeddingService (P1-RAG-03)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.common.errors import LLMGWError
from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    DocumentStatus,
    EmbeddingStatus,
)
from app.services.chunk_service import ChunkService
from app.services.document_service import DocumentService
from app.services.embedding_service import EmbeddingService
from app.services.knowledge_base_service import KnowledgeBaseService

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


async def _setup_chunked_doc(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    content: bytes = b"Hello world. This is a test.",
) -> str:
    """Create KB -> upload doc -> chunk it. Returns document ID."""
    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name="embed-test-kb")
    )
    doc = await doc_service.upload(TENANT, kb.id, "test.txt", content)
    await chunk_service.chunk_document(doc.id, TENANT)
    return doc.id


# --------------------------------------------------------- success cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_generate_embeddings_success(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    embedding_service: EmbeddingService,
) -> None:
    """Generating embeddings for pending chunks succeeds."""

    doc_id = await _setup_chunked_doc(kb_service, doc_service, chunk_service)

    # Mock LLMGW batch response.
    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3], "index": 0}]}
    )

    count = await embedding_service.generate_embeddings(doc_id, TENANT)

    assert count == 1

    # Verify chunks are now GENERATED with embeddings.
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    assert chunks[0].embedding_status == EmbeddingStatus.GENERATED
    embedding = json.loads(chunks[0].embedding)
    assert embedding == [0.1, 0.2, 0.3]

    # Document status should be INDEXED.
    doc = await doc_service.get(TENANT, doc_id)
    assert doc.status == DocumentStatus.INDEXED

    # Verify LLMGW was called with the correct URL.
    mock_post.assert_awaited_once()
    call_args = mock_post.call_args
    assert "/api/v1/llmgw/embeddings/batch" in call_args.args[0]
    assert call_args.kwargs["json"]["modelId"] == "mock-embedding-v1"


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_generate_embeddings_multiple_chunks(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    embedding_service: EmbeddingService,
) -> None:
    """Embedding generation works for multiple chunks."""

    # 2500 chars -> 3 chunks.
    text = "X" * 2500
    doc_id = await _setup_chunked_doc(
        kb_service, doc_service, chunk_service, content=text.encode()
    )

    mock_post.return_value = _mock_response(
        {
            "data": [
                {"embedding": [1.0, 0.0, 0.0], "index": 0},
                {"embedding": [0.0, 1.0, 0.0], "index": 1},
                {"embedding": [0.0, 0.0, 1.0], "index": 2},
            ]
        }
    )

    count = await embedding_service.generate_embeddings(doc_id, TENANT)

    assert count == 3
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    for c in chunks:
        assert c.embedding_status == EmbeddingStatus.GENERATED
        assert c.embedding is not None


# --------------------------------------------------------- failure cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_generate_embeddings_llmgw_failure(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    embedding_service: EmbeddingService,
) -> None:
    """LLMGW HTTP error raises LLMGWError."""

    doc_id = await _setup_chunked_doc(kb_service, doc_service, chunk_service)

    mock_post.return_value = _mock_response(
        {"error": "internal"}, status_code=500
    )

    with pytest.raises(LLMGWError) as exc_info:
        await embedding_service.generate_embeddings(doc_id, TENANT)

    assert int(exc_info.value.code) == 50003

    # Chunks should still be PENDING (not updated).
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    assert chunks[0].embedding_status == EmbeddingStatus.PENDING


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_generate_embeddings_request_error(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    embedding_service: EmbeddingService,
) -> None:
    """LLMGW connection error raises LLMGWError."""

    doc_id = await _setup_chunked_doc(kb_service, doc_service, chunk_service)

    mock_post.side_effect = httpx.ConnectError("Connection refused")

    with pytest.raises(LLMGWError) as exc_info:
        await embedding_service.generate_embeddings(doc_id, TENANT)

    assert int(exc_info.value.code) == 50003


# --------------------------------------------------------- edge cases


async def test_generate_embeddings_no_pending(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    embedding_service: EmbeddingService,
) -> None:
    """Generating embeddings when no pending chunks returns 0."""

    doc_id = await _setup_chunked_doc(kb_service, doc_service, chunk_service)

    # Manually mark all chunks as GENERATED.
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    for c in chunks:
        await chunk_service._chunk_repo.update(
            c.id,
            TENANT,
            {"embedding_status": EmbeddingStatus.GENERATED},
        )

    count = await embedding_service.generate_embeddings(doc_id, TENANT)
    assert count == 0
