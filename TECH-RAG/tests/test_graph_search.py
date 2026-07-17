"""Tests for GraphEnhancedService (P1-RAG-08)."""

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
from app.services.document_service import DocumentService
from app.services.graph_enhanced_service import GraphEnhancedService
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
    kb_name: str = "graph-test-kb",
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


def _post_side_effect_with_graph(
    llmgw_embedding: list[float],
    ont_nodes: list[dict] | None = None,
    ont_edges: list[dict] | None = None,
    ont_relations: list[str] | None = None,
):
    """Build a side_effect for httpx.AsyncClient.post that handles both
    LLMGW embedding calls and ONT graph query calls."""

    ont_nodes = ont_nodes or []
    ont_edges = ont_edges or []
    ont_relations = ont_relations or []

    def side_effect(url, json=None, **kwargs):
        if "llmgw" in str(url):
            return _mock_response({"data": [{"embedding": llmgw_embedding}]})
        elif "ont/graph" in str(url):
            return _mock_response({
                "nodes": ont_nodes,
                "edges": ont_edges,
                "relations": ont_relations,
            })
        return _mock_response({})

    return side_effect


# --------------------------------------------------------- success cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_graph_search_success(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    graph_enhanced_service: GraphEnhancedService,
) -> None:
    """Graph-enhanced search returns chunks with relevance scores and graph context."""

    content = (
        b"Machine learning models for natural language processing. "
        b"Deep learning neural networks for text classification. "
        b"Machine learning is a subset of artificial intelligence."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="graph-basic"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    mock_post.side_effect = _post_side_effect_with_graph(
        llmgw_embedding=[0.9, 0.1, 0.0],
        ont_nodes=[
            {"id": "c1", "label": "Machine Learning", "type": "concept"},
            {"id": "c2", "label": "Deep Learning", "type": "concept"},
        ],
        ont_edges=[
            {"source": "c1", "target": "c2", "relation": "subfield_of"},
        ],
        ont_relations=["subfield_of"],
    )

    result = await graph_enhanced_service.graph_search(
        tenant_id=TENANT,
        query="machine learning",
        kb_id=kb_id,
        depth=1,
        top_k=5,
    )

    assert "chunks" in result
    assert "graphContext" in result
    assert len(result["chunks"]) > 0
    # Each chunk should have relevanceScore.
    for chunk in result["chunks"]:
        assert "relevanceScore" in chunk
        assert "chunkId" in chunk
        assert "content" in chunk
    # Graph context should have nodes, edges, relations.
    graph_ctx = result["graphContext"]
    assert len(graph_ctx["nodes"]) == 2
    assert len(graph_ctx["edges"]) == 1
    assert "subfield_of" in graph_ctx["relations"]


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_graph_search_topk_limit(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    graph_enhanced_service: GraphEnhancedService,
) -> None:
    """topK parameter limits the number of returned chunks."""

    content = (
        b"Search engine optimization techniques for web. "
        b"Search ranking algorithms and page rank. "
        b"Search query processing and indexing. "
        b"Search results relevance scoring methods. "
        b"Search engine crawlers and web scraping."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="graph-topk"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    mock_post.side_effect = _post_side_effect_with_graph(
        llmgw_embedding=[0.9, 0.1, 0.0],
        ont_nodes=[
            {"id": "c1", "label": "Search Engine", "type": "concept"},
        ],
    )

    result = await graph_enhanced_service.graph_search(
        tenant_id=TENANT,
        query="search engine",
        kb_id=kb_id,
        depth=1,
        top_k=2,
    )

    assert len(result["chunks"]) <= 2


# --------------------------------------------------------- edge cases


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_graph_search_empty_kb(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    graph_enhanced_service: GraphEnhancedService,
) -> None:
    """Graph search on an empty KB returns empty chunks and empty graph context."""

    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name="graph-empty-kb")
    )

    mock_post.side_effect = _post_side_effect_with_graph(
        llmgw_embedding=[0.1, 0.2, 0.3],
        ont_nodes=[
            {"id": "c1", "label": "Test", "type": "concept"},
        ],
    )

    result = await graph_enhanced_service.graph_search(
        tenant_id=TENANT,
        query="test",
        kb_id=kb.id,
        depth=1,
        top_k=5,
    )

    assert result["chunks"] == []
    # Graph context may still have nodes from ONT, but no chunks to enrich.
    assert "graphContext" in result


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_graph_search_ont_unavailable_fallback(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    graph_enhanced_service: GraphEnhancedService,
) -> None:
    """When ONT is unavailable, graph search falls back to normal hybrid search."""

    content = (
        b"Artificial intelligence and machine learning. "
        b"Neural networks deep learning models."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="graph-fallback"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    # ONT graph query returns an error.
    def side_effect(url, json=None, **kwargs):
        if "llmgw" in str(url):
            return _mock_response({"data": [{"embedding": [0.9, 0.1, 0.0]}]})
        elif "ont/graph" in str(url):
            return _mock_response({"error": "unavailable"}, status_code=503)
        return _mock_response({})

    mock_post.side_effect = side_effect

    result = await graph_enhanced_service.graph_search(
        tenant_id=TENANT,
        query="machine learning",
        kb_id=kb_id,
        depth=1,
        top_k=5,
    )

    # Should still return chunks (from hybrid search fallback).
    assert len(result["chunks"]) > 0
    # Graph context should be empty (ONT failed).
    assert result["graphContext"]["nodes"] == []
    assert result["graphContext"]["edges"] == []


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_graph_search_ont_connection_error_fallback(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    graph_enhanced_service: GraphEnhancedService,
) -> None:
    """When ONT raises a connection error, graph search still returns results."""

    content = (
        b"Data science and analytics. "
        b"Statistical models for prediction."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="graph-conn-err"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    call_count = [0]

    def side_effect(url, json=None, **kwargs):
        call_count[0] += 1
        if "llmgw" in str(url):
            return _mock_response({"data": [{"embedding": [0.9, 0.1, 0.0]}]})
        elif "ont/graph" in str(url):
            raise httpx.ConnectError("Connection refused")
        return _mock_response({})

    mock_post.side_effect = side_effect

    result = await graph_enhanced_service.graph_search(
        tenant_id=TENANT,
        query="data science",
        kb_id=kb_id,
        depth=2,
        top_k=5,
    )

    assert len(result["chunks"]) > 0
    assert result["graphContext"]["nodes"] == []


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_graph_search_rrf_fusion_combines_results(
    mock_post: AsyncMock,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    graph_enhanced_service: GraphEnhancedService,
) -> None:
    """RRF fusion combines initial and expanded results."""

    content = (
        b"Knowledge graph construction and reasoning. "
        b"Graph neural networks for node classification. "
        b"Ontology engineering and semantic web."
    )
    kb_id, doc_id = await _setup_doc_with_content(
        kb_service, doc_service, chunk_service, content, kb_name="graph-rrf"
    )

    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    await _set_chunk_embeddings(
        chunk_service, doc_id, [[1.0, 0.0, 0.0] for _ in chunks]
    )

    mock_post.side_effect = _post_side_effect_with_graph(
        llmgw_embedding=[0.9, 0.1, 0.0],
        ont_nodes=[
            {"id": "c1", "label": "knowledge graph", "type": "concept"},
            {"id": "c2", "label": "neural networks", "type": "concept"},
        ],
        ont_edges=[
            {"source": "c1", "target": "c2", "relation": "uses"},
        ],
        ont_relations=["uses"],
    )

    result = await graph_enhanced_service.graph_search(
        tenant_id=TENANT,
        query="knowledge graph",
        kb_id=kb_id,
        depth=1,
        top_k=10,
    )

    # Should have results (from RRF fusion of initial + expanded).
    assert len(result["chunks"]) > 0
    # All RRF scores should be positive.
    for chunk in result["chunks"]:
        assert chunk["relevanceScore"] > 0


# --------------------------------------------------------- API controller tests


@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_graph_search_api(
    mock_post: AsyncMock,
    client: httpx.AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /graph-search returns a valid response envelope."""

    # Create a KB.
    resp = await client.post(
        "/api/v1/rag/knowledge-bases",
        json={"name": "graph-api-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    mock_post.side_effect = _post_side_effect_with_graph(
        llmgw_embedding=[0.1, 0.2, 0.3],
        ont_nodes=[],
        ont_edges=[],
        ont_relations=[],
    )

    resp = await client.post(
        "/api/v1/rag/graph-search",
        json={
            "query": "test query",
            "knowledgeBaseId": kb_id,
            "depth": 1,
            "topK": 5,
        },
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == "test-trace-001"
    assert "chunks" in body["data"]
    assert "graphContext" in body["data"]
