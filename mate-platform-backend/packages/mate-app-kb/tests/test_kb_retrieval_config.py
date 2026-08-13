"""Tests for the tenant-scoped retrieval configuration (knowledge/config page).

Covers:
  * GET /api/v1/kb/retrieval-config returns defaults on first access
  * PUT /api/v1/kb/retrieval-config persists + GET round-trips
  * unknown fields rejected (extra=forbid), invalid enum rejected
  * cross-tenant isolation (tenant A config invisible to tenant B)
  * /search applies the saved rerank_strategy when the request omits it,
    and an explicit request rerank_strategy overrides the config
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-app-kb"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_platform.messaging.outbox import InMemoryOutboxWriter  # noqa: E402


def _make_tenant_ctx(tenant: str = "tenant-acme"):
    from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId

    return RequestContext(
        request_id="r1", trace_id="trace-1", tenant_id=TenantId(tenant),
        user_id=UserId("u1"), roles=frozenset(), permissions=frozenset(),
        client_id="test", auth_method=AuthMethod.USER,
    )


def _build_client(tenant: str, captured: dict | None = None) -> TestClient:
    """Build a TestClient bound to ``tenant``; record RAG search calls if captured."""
    from fastapi.testclient import TestClient

    from mate_app_kb.api.app import create_app
    from mate_app_kb.clients import AgentClient, RAGClient
    from mate_app_kb.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()
    fake_rag = RAGClient()

    def _search(query, top_k=5, mode="AUTO", rerank_strategy=None):
        if captured is not None:
            captured["rerank_strategy"] = rerank_strategy
            captured["mode"] = mode
        return {
            "query": query, "mode": mode, "total": 1,
            "hits": [{"document_id": "doc-a", "score": 0.9, "content": "alpha"}],
        }

    fake_rag.search = _search
    fake_rag.stats = lambda: {"total_chunks": 1, "embedder_dim": 16}
    fake_agent = AgentClient()
    fake_agent.chat = lambda message, scenario="S1", thread_id=None: {
        "thread_id": "t-1", "scenario": scenario, "answer": "ok",
        "retrieved_chunks": [], "tool_calls": [],
    }

    with patch("mate_app_kb.api.app.install_auth"):
        app = create_app(rag=fake_rag, agent=fake_agent)
        app.state.outbox_writer = InMemoryOutboxWriter()

        async def fake_middleware(request, call_next):
            request.state.ctx = _make_tenant_ctx(tenant)
            return await call_next(request)

        app.middleware("http")(fake_middleware)
        return TestClient(app)


@pytest.fixture
def client():
    c = _build_client("tenant-acme")
    yield c
    from mate_app_kb.repositories import in_memory as in_memory_repo
    in_memory_repo.reset_store()


class TestRetrievalConfigCRUD:
    def test_get_returns_defaults(self, client: TestClient) -> None:
        r = client.get("/api/v1/kb/retrieval-config")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tenant_id"] == "tenant-acme"
        assert body["mode"] == "AUTO"
        assert body["rerank_strategy"] == "identity"
        assert body["chunk_strategy"] == "recursive"
        assert body["top_k"] == 10

    def test_put_then_get_round_trips(self, client: TestClient) -> None:
        payload = {
            "mode": "FACTUAL", "rerank_strategy": "keyword", "top_k": 5,
            "similarity_threshold": 0.2, "chunk_strategy": "semantic",
            "chunk_size": 256, "chunk_overlap": 32,
            "vector_weight": 0.6, "keyword_weight": 0.4,
            "reranker_enabled": True, "show_citations": False,
        }
        r = client.put("/api/v1/kb/retrieval-config", json=payload)
        assert r.status_code == 200, r.text
        body = client.get("/api/v1/kb/retrieval-config").json()
        assert body["rerank_strategy"] == "keyword"
        assert body["mode"] == "FACTUAL"
        assert body["chunk_strategy"] == "semantic"
        assert body["top_k"] == 5
        assert body["show_citations"] is False
        assert body["updated_at"]

    def test_put_rejects_unknown_field(self, client: TestClient) -> None:
        r = client.put("/api/v1/kb/retrieval-config", json={"mode": "AUTO", "bogus": "x"})
        assert r.status_code == 422, r.text

    def test_put_rejects_invalid_enum(self, client: TestClient) -> None:
        r = client.put("/api/v1/kb/retrieval-config", json={"rerank_strategy": "cross-encoder"})
        assert r.status_code == 422, r.text

    def test_cross_tenant_isolation(self, client: TestClient) -> None:
        client.put("/api/v1/kb/retrieval-config", json={"rerank_strategy": "keyword", "mode": "FACTUAL"})
        # A client bound to a different tenant sees its own defaults.
        other = _build_client("tenant-globex")
        body = other.get("/api/v1/kb/retrieval-config").json()
        assert body["tenant_id"] == "tenant-globex"
        assert body["rerank_strategy"] == "identity"
        assert body["mode"] == "AUTO"
        from mate_app_kb.repositories import in_memory as in_memory_repo
        in_memory_repo.reset_store()


class TestSearchWiring:
    def test_search_uses_saved_rerank_strategy(self) -> None:
        """When the request omits rerank_strategy, the saved config one is applied."""
        captured: dict = {}
        client = _build_client("tenant-acme", captured=captured)
        client.put("/api/v1/kb/retrieval-config", json={"rerank_strategy": "keyword", "mode": "FACTUAL"})
        r = client.post("/api/v1/kb/search", json={"query": "hello", "top_k": 5, "mode": "AUTO"})
        assert r.status_code == 200, r.text
        assert captured.get("rerank_strategy") == "keyword", captured
        # Request mode wins over the configured mode.
        assert captured.get("mode") == "AUTO", captured
        from mate_app_kb.repositories import in_memory as in_memory_repo
        in_memory_repo.reset_store()

    def test_explicit_rerank_overrides_config(self) -> None:
        """An explicit rerank_strategy on the request wins over the saved config."""
        captured: dict = {}
        client = _build_client("tenant-acme", captured=captured)
        client.put("/api/v1/kb/retrieval-config", json={"rerank_strategy": "keyword"})
        r = client.post(
            "/api/v1/kb/search",
            json={"query": "hi", "top_k": 5, "mode": "AUTO", "rerank_strategy": "length"},
        )
        assert r.status_code == 200, r.text
        assert captured.get("rerank_strategy") == "length", captured
        from mate_app_kb.repositories import in_memory as in_memory_repo
        in_memory_repo.reset_store()
