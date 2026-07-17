"""RAG client tests (P2-AGT-09)."""

from __future__ import annotations

import pytest

from app.clients.rag import RAGClient


@pytest.fixture
def rag_client():
    return RAGClient(base_url="")


class TestRAGClient:
    async def test_mock_search(self, rag_client: RAGClient):
        results = await rag_client.search(
            "采购流程", knowledge_base_ids=["kb-001"], top_k=3
        )
        assert len(results) == 3
        assert "content" in results[0]
        assert "score" in results[0]
        assert "source" in results[0]
        assert results[0]["score"] > results[1]["score"]

    async def test_mock_search_default_kb(self, rag_client: RAGClient):
        results = await rag_client.search("test query", top_k=5)
        assert len(results) == 3  # mock returns max 3
        assert "kb-default" in results[0]["source"]

    async def test_list_knowledge_bases(self, rag_client: RAGClient):
        kbs = await rag_client.list_knowledge_bases()
        assert len(kbs) == 2
        assert kbs[0]["knowledgeBaseId"] == "kb-procurement"
        assert kbs[1]["knowledgeBaseId"] == "kb-finance"

    async def test_format_context(self, rag_client: RAGClient):
        results = [
            {
                "content": "文档内容1",
                "score": 0.95,
                "source": "kb-001",
                "metadata": {},
            },
            {
                "content": "文档内容2",
                "score": 0.85,
                "source": "kb-001",
                "metadata": {},
            },
        ]
        context = rag_client.format_context(results)
        assert "文档内容1" in context
        assert "文档内容2" in context
        assert "0.95" in context

    async def test_format_empty_context(self, rag_client: RAGClient):
        context = rag_client.format_context([])
        assert context == ""
