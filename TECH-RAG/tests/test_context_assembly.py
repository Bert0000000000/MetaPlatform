"""Tests for ContextAssemblyService (P1-RAG-09)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    EmbeddingStatus,
)
from app.services.chunk_service import ChunkService
from app.services.context_assembly_service import ContextAssemblyService
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
            request=httpx.Request("GET", "http://test"),
            response=mock,
        )
    mock.json = MagicMock(return_value=json_data)
    return mock


async def _setup_doc_with_content(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    content: bytes,
    kb_name: str = "ctx-test-kb",
) -> tuple[str, str]:
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


# --------------------------------------------------------- success cases


@patch("httpx.AsyncClient.get", new_callable=AsyncMock)
@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_assemble_with_all_sources(
    mock_post: AsyncMock,
    mock_get: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    context_assembly_service: ContextAssemblyService,
) -> None:
    """Context assembly fuses RAG + ontology + conversation sources."""

    content = (
        b"Machine learning is a subset of artificial intelligence. "
        b"Deep learning uses neural networks for representation learning."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="ctx-all-sources"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    # Mock LLMGW embedding for RAG retrieval.
    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    # Mock ONT concept fetch.
    mock_get.return_value = _mock_response({
        "name": "Machine Learning",
        "description": "A subset of AI focused on learning from data.",
        "entities": [{"name": "Neural Networks"}, {"name": "Deep Learning"}],
    })

    result = await context_assembly_service.assemble(
        tenant_id=TENANT,
        query="machine learning",
        kb_ids=[kb_id],
        conversation_history=[
            {"role": "user", "content": "What is machine learning?"},
            {"role": "assistant", "content": "It is a subset of AI."},
        ],
        ontology_concept_ids=["concept-ml"],
        context_config={"maxTokens": 4096},
    )

    assert "assembledContext" in result
    assert "sources" in result
    assert "tokenCount" in result
    assert len(result["sources"]) > 0
    assert result["tokenCount"] > 0

    # Should have all three source types.
    source_types = {s["type"] for s in result["sources"]}
    assert "ontology" in source_types
    assert "rag" in source_types
    assert "conversation" in source_types

    # Ontology sources should have HIGH priority.
    ont_sources = [s for s in result["sources"] if s["type"] == "ontology"]
    for s in ont_sources:
        assert s["priority"] == "HIGH"

    # RAG sources should have MEDIUM priority.
    rag_sources = [s for s in result["sources"] if s["type"] == "rag"]
    for s in rag_sources:
        assert s["priority"] == "MEDIUM"

    # Conversation sources should have LOW priority.
    conv_sources = [s for s in result["sources"] if s["type"] == "conversation"]
    for s in conv_sources:
        assert s["priority"] == "LOW"


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_assemble_rag_only(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    context_assembly_service: ContextAssemblyService,
) -> None:
    """Context assembly with only RAG sources (no ontology, no conversation)."""

    content = (
        b"Python is a popular programming language for data science. "
        b"It supports various machine learning frameworks."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="ctx-rag-only"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    result = await context_assembly_service.assemble(
        tenant_id=TENANT,
        query="python data science",
        kb_ids=[kb_id],
        conversation_history=None,
        ontology_concept_ids=None,
        context_config={"maxTokens": 4096},
    )

    source_types = {s["type"] for s in result["sources"]}
    assert "rag" in source_types
    assert "ontology" not in source_types
    assert "conversation" not in source_types


# --------------------------------------------------------- token budget


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_assemble_token_budget(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    context_assembly_service: ContextAssemblyService,
) -> None:
    """Token budget management limits total token count."""

    content = (
        b"This is a very long document about artificial intelligence. "
        b"It covers many topics including machine learning, deep learning, "
        b"natural language processing, computer vision, and reinforcement learning. "
        b"Each topic has its own set of algorithms and techniques."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="ctx-budget"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    max_tokens = 50  # Very small budget.
    result = await context_assembly_service.assemble(
        tenant_id=TENANT,
        query="artificial intelligence",
        kb_ids=[kb_id],
        context_config={"maxTokens": max_tokens},
    )

    assert result["tokenCount"] <= max_tokens


# --------------------------------------------------------- edge cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_assemble_empty_kb(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    context_assembly_service: ContextAssemblyService,
) -> None:
    """Context assembly with empty KB returns no RAG sources."""

    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name="ctx-empty-kb")
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    result = await context_assembly_service.assemble(
        tenant_id=TENANT,
        query="test",
        kb_ids=[kb.id],
        context_config={"maxTokens": 4096},
    )

    rag_sources = [s for s in result["sources"] if s["type"] == "rag"]
    assert len(rag_sources) == 0


@patch("httpx.AsyncClient.get", new_callable=AsyncMock)
@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_assemble_ont_unavailable(
    mock_post: AsyncMock,
    mock_get: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    context_assembly_service: ContextAssemblyService,
) -> None:
    """When ONT is unavailable, ontology sources are empty but RAG works."""

    content = b"Knowledge representation and reasoning."
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="ctx-ont-fail"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.9, 0.1, 0.0]}]}
    )

    # ONT concept fetch fails.
    mock_get.side_effect = httpx.ConnectError("Connection refused")

    result = await context_assembly_service.assemble(
        tenant_id=TENANT,
        query="knowledge representation",
        kb_ids=[kb_id],
        ontology_concept_ids=["concept-1"],
        context_config={"maxTokens": 4096},
    )

    # RAG sources should still be present.
    rag_sources = [s for s in result["sources"] if s["type"] == "rag"]
    assert len(rag_sources) > 0
    # Ontology sources should be empty.
    ont_sources = [s for s in result["sources"] if s["type"] == "ontology"]
    assert len(ont_sources) == 0


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_assemble_conversation_only(
    mock_post: AsyncMock,
    context_assembly_service: ContextAssemblyService,
) -> None:
    """Context assembly with only conversation history (no KBs with content)."""

    # Use a non-existent KB to get no RAG results.
    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    result = await context_assembly_service.assemble(
        tenant_id=TENANT,
        query="test",
        kb_ids=["kb-nonexistent"],
        conversation_history=[
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ],
        context_config={"maxTokens": 4096, "includeOntology": False},
    )

    conv_sources = [s for s in result["sources"] if s["type"] == "conversation"]
    assert len(conv_sources) == 2
    assert result["tokenCount"] > 0


# --------------------------------------------------------- API controller tests


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_assemble_context_api(
    mock_post: AsyncMock,
    client: httpx.AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /context/assemble returns a valid response envelope."""

    # Create a KB.
    resp = await client.post(
        "/api/v1/rag/knowledge-bases",
        json={"name": "ctx-api-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    mock_post.return_value = _mock_response(
        {"data": [{"embedding": [0.1, 0.2, 0.3]}]}
    )

    resp = await client.post(
        "/api/v1/rag/context/assemble",
        json={
            "query": "test query",
            "knowledgeBaseIds": [kb_id],
            "conversationHistory": [
                {"role": "user", "content": "What is AI?"},
            ],
            "contextConfig": {"maxTokens": 2048},
        },
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == "test-trace-001"
    assert "assembledContext" in body["data"]
    assert "sources" in body["data"]
    assert "tokenCount" in body["data"]
