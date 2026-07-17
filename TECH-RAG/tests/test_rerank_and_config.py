"""Tests for RerankService and retrieval-config endpoints (P1-RAG-06)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    SearchConfig,
    UpdateSearchConfigRequest,
)
from app.services.knowledge_base_service import KnowledgeBaseService
from app.services.rerank_service import RerankService

TENANT = "tenant-test"
TRACE = "test-trace-001"
BASE = "/api/v1/rag"


# ====================================================== RerankService tests


async def test_rerank_reorders_by_jaccard() -> None:
    """Rerank reorders documents by Jaccard similarity to the query."""

    rerank_service = RerankService()

    documents = [
        {
            "chunkId": "chk-1",
            "content": "The quick brown fox jumps over the lazy dog",
            "score": 0.9,
            "documentId": "doc-1",
            "documentName": "doc1.txt",
        },
        {
            "chunkId": "chk-2",
            "content": "Machine learning models for natural language processing",
            "score": 0.5,
            "documentId": "doc-2",
            "documentName": "doc2.txt",
        },
        {
            "chunkId": "chk-3",
            "content": "machine learning is a subset of artificial intelligence",
            "score": 0.7,
            "documentId": "doc-3",
            "documentName": "doc3.txt",
        },
    ]

    results = await rerank_service.rerank(
        query="machine learning artificial intelligence",
        documents=documents,
        top_k=3,
    )

    assert len(results) == 3
    # Documents with more query term overlap should rank higher.
    # chk-2 and chk-3 contain "machine learning", chk-3 also has "artificial intelligence".
    top_ids = [r["chunkId"] for r in results]
    # chk-1 should be last (no overlap with query).
    assert top_ids[-1] == "chk-1"
    # Results should be sorted by new score descending.
    for i in range(len(results) - 1):
        assert results[i]["score"] >= results[i + 1]["score"]
    # originalScore should be preserved.
    for r in results:
        assert "originalScore" in r


async def test_rerank_empty_list() -> None:
    """Rerank with an empty document list returns empty."""

    rerank_service = RerankService()
    results = await rerank_service.rerank(
        query="test",
        documents=[],
        top_k=5,
    )
    assert results == []


async def test_rerank_topk_limit() -> None:
    """Rerank respects the topK parameter."""

    rerank_service = RerankService()

    documents = [
        {"chunkId": f"chk-{i}", "content": f"document number {i}", "score": 0.5}
        for i in range(10)
    ]

    results = await rerank_service.rerank(
        query="document",
        documents=documents,
        top_k=3,
    )

    assert len(results) == 3


# ====================================================== Retrieval-config tests


async def test_get_retrieval_config_defaults(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET retrieval-config returns defaults for a new KB."""

    # Create a KB.
    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json={"name": "config-default-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    resp = await client.get(
        f"{BASE}/knowledge-bases/{kb_id}/retrieval-config",
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    config = body["data"]
    assert config["topK"] == 5
    assert config["similarityThreshold"] == 0.0
    assert config["vectorWeight"] == 0.7
    assert config["rerankEnabled"] is False
    assert config["rerankModel"] == "mock-rerank-v1"


async def test_update_retrieval_config(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """PUT retrieval-config updates and persists the configuration."""

    # Create a KB.
    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json={"name": "config-update-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    # Update config.
    resp = await client.put(
        f"{BASE}/knowledge-bases/{kb_id}/retrieval-config",
        json={
            "topK": 10,
            "rerankEnabled": True,
            "rerankModel": "bge-reranker-v2",
            "vectorWeight": 0.8,
        },
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    config = body["data"]
    assert config["topK"] == 10
    assert config["rerankEnabled"] is True
    assert config["rerankModel"] == "bge-reranker-v2"
    assert config["vectorWeight"] == 0.8

    # Verify persistence via GET.
    resp = await client.get(
        f"{BASE}/knowledge-bases/{kb_id}/retrieval-config",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    config = resp.json()["data"]
    assert config["topK"] == 10
    assert config["rerankEnabled"] is True
    assert config["rerankModel"] == "bge-reranker-v2"


async def test_update_retrieval_config_partial_merge(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """Partial PUT merges with existing config (only provided fields change)."""

    # Create a KB.
    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json={"name": "config-merge-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    # First update: set topK and rerankEnabled.
    resp = await client.put(
        f"{BASE}/knowledge-bases/{kb_id}/retrieval-config",
        json={"topK": 8, "rerankEnabled": True},
        headers=tenant_headers,
    )
    assert resp.status_code == 200

    # Second update: only change vectorWeight.
    resp = await client.put(
        f"{BASE}/knowledge-bases/{kb_id}/retrieval-config",
        json={"vectorWeight": 0.9},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    config = resp.json()["data"]
    # Previous values should be preserved.
    assert config["topK"] == 8
    assert config["rerankEnabled"] is True
    # New value should be applied.
    assert config["vectorWeight"] == 0.9


async def test_get_retrieval_config_kb_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET retrieval-config for a non-existent KB returns 40401."""

    resp = await client.get(
        f"{BASE}/knowledge-bases/kb-nonexistent/retrieval-config",
        headers=tenant_headers,
    )

    assert resp.status_code == 404
    assert resp.json()["code"] == 40401
