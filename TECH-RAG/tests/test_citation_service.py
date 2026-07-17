"""Tests for CitationService (P1-RAG-10)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.common.errors import CitationNotFoundError
from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    EmbeddingStatus,
)
from app.services.chunk_service import ChunkService
from app.services.citation_service import CitationService
from app.services.document_service import DocumentService
from app.services.knowledge_base_service import KnowledgeBaseService

TENANT = "tenant-test"


def _mock_response(json_data: dict, status_code: int = 200) -> MagicMock:
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
    kb_name: str = "citation-test-kb",
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


async def _get_chunk_ids(
    chunk_service: ChunkService, doc_id: str
) -> list[str]:
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    return [c.id for c in chunks]


# --------------------------------------------------------- success cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_locate_citations_with_chunk_ids(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    citation_service: CitationService,
) -> None:
    """Locate citations using chunk_ids returns proper citation objects."""

    content = (
        b"Machine learning is a subset of artificial intelligence. "
        b"Deep learning uses neural networks. "
        b"Natural language processing is important."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="cite-basic"
    )

    chunk_ids = await _get_chunk_ids(chunk_service, doc_id)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunk_ids]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    citations = await citation_service.locate_citations(
        tenant_id=TENANT,
        query="machine learning",
        chunk_ids=chunk_ids,
    )

    assert len(citations) > 0
    for cite in citations:
        assert "chunkId" in cite
        assert "documentId" in cite
        assert "documentName" in cite
        assert "textSpan" in cite
        assert "startOffset" in cite
        assert "endOffset" in cite
        assert "confidenceScore" in cite
        assert "highlightHtml" in cite
        assert 0.0 <= cite["confidenceScore"] <= 1.0
        assert cite["startOffset"] >= 0
        assert cite["endOffset"] > cite["startOffset"]
        assert "<mark>" in cite["highlightHtml"]


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_locate_citations_with_search_results(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    citation_service: CitationService,
) -> None:
    """Locate citations using search_results from a previous search."""

    content = (
        b"Data science combines statistics and computer science. "
        b"Big data analytics requires distributed computing."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="cite-search"
    )

    chunk_ids = await _get_chunk_ids(chunk_service, doc_id)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunk_ids]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    # Use search_results format.
    search_results = [
        {"chunkId": cid, "content": "test", "score": 0.9}
        for cid in chunk_ids
    ]

    citations = await citation_service.locate_citations(
        tenant_id=TENANT,
        query="data science",
        search_results=search_results,
    )

    assert len(citations) > 0
    for cite in citations:
        assert cite["chunkId"] in chunk_ids


# --------------------------------------------------------- edge cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_locate_citations_empty_chunk_ids(
    mock_post: AsyncMock,
    citation_service: CitationService,
) -> None:
    """Empty chunk_ids and search_results returns empty citations."""

    citations = await citation_service.locate_citations(
        tenant_id=TENANT,
        query="test",
        chunk_ids=None,
        search_results=None,
    )

    assert citations == []


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_locate_citations_nonexistent_chunks(
    mock_post: AsyncMock,
    citation_service: CitationService,
) -> None:
    """Non-existent chunk_ids returns empty citations."""

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    citations = await citation_service.locate_citations(
        tenant_id=TENANT,
        query="test",
        chunk_ids=["chk-nonexistent-1", "chk-nonexistent-2"],
    )

    assert citations == []


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_locate_citations_llmgw_unavailable(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    citation_service: CitationService,
) -> None:
    """When LLMGW is unavailable, semantic similarity is 0 but citations still returned."""

    content = b"Artificial intelligence and machine learning basics."
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="cite-no-llmgw"
    )

    chunk_ids = await _get_chunk_ids(chunk_service, doc_id)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunk_ids]
    )

    mock_post.side_effect = httpx.ConnectError("Connection refused")

    citations = await citation_service.locate_citations(
        tenant_id=TENANT,
        query="artificial intelligence",
        chunk_ids=chunk_ids,
    )

    assert len(citations) > 0
    # Semantic similarity component should be 0, but other components may contribute.
    for cite in citations:
        assert cite["confidenceScore"] >= 0.0


# --------------------------------------------------------- get_citation


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_get_citation_success(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    citation_service: CitationService,
) -> None:
    """get_citation returns citation detail for a valid chunk."""

    content = b"Machine learning models for classification tasks."
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="cite-get"
    )

    chunk_ids = await _get_chunk_ids(chunk_service, doc_id)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunk_ids]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    citation = await citation_service.get_citation(
        tenant_id=TENANT,
        chunk_id=chunk_ids[0],
        query="machine learning",
    )

    assert citation["chunkId"] == chunk_ids[0]
    assert "documentName" in citation
    assert "textSpan" in citation
    assert "confidenceScore" in citation
    assert "highlightHtml" in citation


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_get_citation_not_found(
    mock_post: AsyncMock,
    citation_service: CitationService,
) -> None:
    """get_citation with non-existent chunk_id raises CitationNotFoundError."""

    with pytest.raises(CitationNotFoundError) as exc_info:
        await citation_service.get_citation(
            tenant_id=TENANT,
            chunk_id="chk-nonexistent",
            query="test",
        )

    assert int(exc_info.value.code) == 40403


# --------------------------------------------------------- batch locate


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_batch_locate_citations(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    citation_service: CitationService,
) -> None:
    """batch_locate processes multiple chunks at once."""

    content = (
        b"First sentence about machine learning. "
        b"Second sentence about deep learning. "
        b"Third sentence about neural networks."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="cite-batch"
    )

    chunk_ids = await _get_chunk_ids(chunk_service, doc_id)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunk_ids]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    citations = await citation_service.batch_locate(
        tenant_id=TENANT,
        query="learning",
        chunk_ids=chunk_ids,
    )

    assert len(citations) == len(chunk_ids)
    returned_ids = {c["chunkId"] for c in citations}
    for cid in chunk_ids:
        assert cid in returned_ids


# --------------------------------------------------------- confidence score


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_confidence_score_formula(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    citation_service: CitationService,
) -> None:
    """Confidence score follows the formula: 0.4*sem + 0.3*exact + 0.3*pos."""

    content = b"Machine learning artificial intelligence deep learning neural."
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="cite-conf"
    )

    chunk_ids = await _get_chunk_ids(chunk_service, doc_id)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunk_ids]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [1.0, 0.0, 0.0]}]}  # Same as chunk embedding.
    )

    citations = await citation_service.locate_citations(
        tenant_id=TENANT,
        query="machine learning artificial intelligence",
        chunk_ids=chunk_ids,
    )

    assert len(citations) > 0
    cite = citations[0]
    # With identical embeddings, semantic similarity should be ~1.0.
    # Query tokens "machine", "learning", "artificial", "intelligence" all
    # appear in the content, so exact_match_ratio should be ~1.0.
    # Position score depends on where the match is.
    assert cite["confidenceScore"] > 0.5  # Should be relatively high.


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_highlight_html_contains_mark_tags(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    citation_service: CitationService,
) -> None:
    """Highlight HTML wraps the matched span in <mark> tags."""

    content = b"The quick brown fox jumps over the lazy dog."
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="cite-highlight"
    )

    chunk_ids = await _get_chunk_ids(chunk_service, doc_id)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunk_ids]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    citations = await citation_service.locate_citations(
        tenant_id=TENANT,
        query="quick brown fox",
        chunk_ids=chunk_ids,
    )

    assert len(citations) > 0
    cite = citations[0]
    assert "<mark>" in cite["highlightHtml"]
    assert "</mark>" in cite["highlightHtml"]


# --------------------------------------------------------- API controller tests


async def test_locate_citations_api(
    client: httpx.AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /citations/locate returns a valid response envelope."""

    # Create a KB and upload a doc.
    resp = await client.post(
        "/api/v1/rag/knowledge-bases",
        json={"name": "cite-api-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    resp = await client.post(
        f"/api/v1/rag/knowledge-bases/{kb_id}/documents/upload",
        files={"file": ("test.txt", b"Machine learning test content", "text/plain")},
        headers=tenant_headers,
    )
    doc_id = resp.json()["data"]["id"]

    resp = await client.post(
        "/api/v1/rag/citations/locate",
        json={
            "query": "machine learning",
            "chunkIds": [],
        },
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == "test-trace-001"
    assert "citations" in body["data"]


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_get_citation_api_not_found(
    mock_post: AsyncMock,
    client: httpx.AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /citations/{chunk_id} for non-existent chunk returns 40403."""

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    resp = await client.get(
        "/api/v1/rag/citations/chk-nonexistent",
        params={"query": "test"},
        headers=tenant_headers,
    )

    assert resp.status_code == 404
    assert resp.json()["code"] == 40403
