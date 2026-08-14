"""P1.7 RAG 增强 — cascade delete + KB retrieval-config snapshot tests.

Coverage:
  * KB DELETE /api/v1/kb/documents/{did} cascades to the upstream RAG
    service and returns the fan-out summary
  * KB retrieval-config snapshot history: PUT 3 times → GET history
    returns 2 snapshots with timestamps
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import jwt as pyjwt
import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in (
    "mate-platform",
    "mate-clients",
    "mate-common",
    "mate-tech-rag",
    "mate-tech-db",
    "mate-tech-msg",
    "mate-app-kb",
):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")

from mate_platform.messaging.outbox import InMemoryOutboxWriter  # noqa: E402

JWT_SECRET = "test-secret"


# ---------------------------------------------------------------------------
# P1.7: cascade delete — KB DELETE → RAG cascade
# ---------------------------------------------------------------------------
def _make_tenant_ctx(tenant: str):
    from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId

    return RequestContext(
        request_id="r1",
        trace_id="trace-1",
        tenant_id=TenantId(tenant),
        user_id=UserId("u1"),
        roles=frozenset(),
        permissions=frozenset(),
        client_id="test",
        auth_method=AuthMethod.USER,
    )


@pytest.fixture
def kb_outbox() -> InMemoryOutboxWriter:
    return InMemoryOutboxWriter()


class TestKbRetrievalConfigHistory:
    """P1.8: retrieval-config snapshot history."""

    def test_put_3_times_yields_2_snapshots(self) -> None:
        from fastapi.testclient import TestClient
        from unittest.mock import patch

        from mate_app_kb.api.app import create_app
        from mate_app_kb.clients import AgentClient, RAGClient
        from mate_app_kb.repositories import in_memory as in_memory_repo

        in_memory_repo.reset_store()

        fake_rag = RAGClient()
        fake_rag.search = lambda *a, **k: {"hits": []}
        fake_rag.stats = lambda: {"total_chunks": 0, "embedder_dim": 16}
        fake_agent = AgentClient()
        fake_agent.chat = lambda **k: {"thread_id": "t", "answer": ""}

        with patch("mate_app_kb.api.app.install_auth"):
            app = create_app(rag=fake_rag, agent=fake_agent)
            app.state.outbox_writer = InMemoryOutboxWriter()

            async def mw(request, call_next):
                request.state.ctx = _make_tenant_ctx("tenant-acme")
                return await call_next(request)

            app.middleware("http")(mw)
            client = TestClient(app)

        # PUT three times.
        for i, strategy in enumerate(["identity", "keyword", "length"]):
            r = client.put(
                "/api/v1/kb/retrieval-config",
                json={
                    "mode": "FACTUAL",
                    "rerank_strategy": strategy,
                    "top_k": 5 + i,
                    "similarity_threshold": 0.0,
                    "chunk_strategy": "recursive",
                    "chunk_size": 256,
                    "chunk_overlap": 32,
                    "vector_weight": 0.7,
                    "keyword_weight": 0.3,
                    "reranker_enabled": True,
                    "show_citations": True,
                },
            )
            assert r.status_code == 200, r.text

        hist = client.get("/api/v1/kb/retrieval-config/history")
        assert hist.status_code == 200, hist.text
        history_body = hist.json()
        # Standard ApiResponse wrapper: {code, message, data: {items, total}}
        history = history_body["data"]["items"]
        # 1st PUT (the user's first save) becomes version 2 and has no
        # prior snapshot; 2nd PUT snapshots version 2; 3rd PUT snapshots
        # version 3 → 2 snapshots total.
        assert len(history) == 2, history
        versions = sorted(s["version"] for s in history)
        assert versions == [2, 3], versions
        # Every snapshot has the snapshot_at timestamp populated.
        for s in history:
            assert s["snapshot_at"], s

        in_memory_repo.reset_store()

    def test_version_increments_per_save(self) -> None:
        from fastapi.testclient import TestClient
        from unittest.mock import patch

        from mate_app_kb.api.app import create_app
        from mate_app_kb.clients import AgentClient, RAGClient
        from mate_app_kb.repositories import in_memory as in_memory_repo

        in_memory_repo.reset_store()
        fake_rag = RAGClient()
        fake_rag.search = lambda *a, **k: {"hits": []}
        fake_rag.stats = lambda: {"total_chunks": 0, "embedder_dim": 16}
        fake_agent = AgentClient()
        fake_agent.chat = lambda **k: {"thread_id": "t", "answer": ""}

        with patch("mate_app_kb.api.app.install_auth"):
            app = create_app(rag=fake_rag, agent=fake_agent)
            app.state.outbox_writer = InMemoryOutboxWriter()

            async def mw(request, call_next):
                request.state.ctx = _make_tenant_ctx("tenant-acme")
                return await call_next(request)

            app.middleware("http")(mw)
            client = TestClient(app)

        r1 = client.put(
            "/api/v1/kb/retrieval-config",
            json={"rerank_strategy": "keyword", "mode": "FACTUAL"},
        )
        assert r1.status_code == 200, r1.text
        assert r1.json()["version"] == 2

        r2 = client.put(
            "/api/v1/kb/retrieval-config",
            json={"rerank_strategy": "length", "mode": "AUTO"},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["version"] == 3

        in_memory_repo.reset_store()


class TestKBCascadeDelete:
    """P1.7: KB DELETE /documents/{did} cascades to the upstream RAG.

    The cascade is best-effort via the in-process
    ``mate_tech_rag.api.cascade.delete_document_cascade`` fallback when
    the RAGClient does not expose a ``delete_document`` method; we
    simulate the call path here with a stub ``RAGClient`` that records
    whether the cascade was attempted.
    """

    def test_delete_calls_rag_then_clears_local(self) -> None:
        from fastapi.testclient import TestClient
        from unittest.mock import patch

        from mate_app_kb.api.app import create_app
        from mate_app_kb.clients import AgentClient, RAGClient
        from mate_app_kb.repositories import in_memory as in_memory_repo

        in_memory_repo.reset_store()
        cascade_calls: list[str] = []

        class _StubRag(RAGClient):
            def delete_document(self, doc_id: str) -> dict:
                cascade_calls.append(doc_id)
                return {
                    "deleted": True,
                    "document_id": doc_id,
                    "chunks_removed": 4,
                    "graph_tuples_removed": 1,
                    "lightrag_chunks_removed": 4,
                    "pg_chunks_removed": 0,
                    "catalog_removed": False,
                    "registry_removed": False,
                }

            def search(self, *a, **k):
                return {"hits": []}

            def stats(self):
                return {"total_chunks": 0, "embedder_dim": 16}

        fake_rag = _StubRag()
        fake_agent = AgentClient()
        fake_agent.chat = lambda **k: {"thread_id": "t", "answer": ""}

        with patch("mate_app_kb.api.app.install_auth"):
            app = create_app(rag=fake_rag, agent=fake_agent)
            app.state.outbox_writer = InMemoryOutboxWriter()

            async def mw(request, call_next):
                request.state.ctx = _make_tenant_ctx("tenant-acme")
                return await call_next(request)

            app.middleware("http")(mw)
            client = TestClient(app)

        r = client.delete("/api/v1/kb/documents/doc-1")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] == "doc-1"
        assert body["rag"]["deleted"] is True
        assert body["rag"]["chunks_removed"] == 4
        assert cascade_calls == ["doc-1"]

        in_memory_repo.reset_store()

    def test_delete_unknown_returns_404(self) -> None:
        from fastapi.testclient import TestClient
        from unittest.mock import patch

        from mate_app_kb.api.app import create_app
        from mate_app_kb.clients import AgentClient, RAGClient
        from mate_app_kb.repositories import in_memory as in_memory_repo

        in_memory_repo.reset_store()
        fake_rag = RAGClient()
        fake_rag.search = lambda *a, **k: {"hits": []}
        fake_rag.stats = lambda: {"total_chunks": 0, "embedder_dim": 16}
        fake_agent = AgentClient()
        fake_agent.chat = lambda **k: {"thread_id": "t", "answer": ""}

        with patch("mate_app_kb.api.app.install_auth"):
            app = create_app(rag=fake_rag, agent=fake_agent)
            app.state.outbox_writer = InMemoryOutboxWriter()

            async def mw(request, call_next):
                request.state.ctx = _make_tenant_ctx("tenant-acme")
                return await call_next(request)

            app.middleware("http")(mw)
            client = TestClient(app)

        r = client.delete("/api/v1/kb/documents/no-such-doc")
        assert r.status_code == 404, r.text

        in_memory_repo.reset_store()

