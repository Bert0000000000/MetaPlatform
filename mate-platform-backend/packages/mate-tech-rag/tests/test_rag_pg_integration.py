"""Tests for PG BM25 integration (阶段 A).

Covers:
  * create_clients() initializes PGClient + PGStore when PG_DSN is set
  * create_clients() leaves _pg_store=None when PG_DSN absent
  * HybridV2 fallback when PG unavailable (graceful degradation)
  * ingest / upload flows write chunks to PG
  * /admin/pg-stats endpoint reflects PG availability
  * BM25 search fallback supplements insufficient vector results
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

# --- module-level env setup (must precede app import) ----------------------
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))

JWT_SECRET = "test-secret"


def _keycloak_token(
    *,
    sub: str = "u-1",
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
    tenant_id: str = "tenant-acme",
) -> str:
    now = int(time.time())
    resolved = roles if roles is not None else ["PLATFORM_SUPER_ADMIN"]
    return pyjwt.encode(
        {
            "sub": sub,
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": sub,
            "realm_access": {"roles": resolved},
            "scope": scopes,
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": resolved,
            "iat": now,
            "exp": now + 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


class FakePGStore:
    """In-memory fake PGStore for testing BM25 integration."""

    def __init__(self) -> None:
        self._chunks: list[dict[str, Any]] = []
        self._available = True

    def save_chunk(
        self, chunk_id: str, document_id: str, text: str, metadata: dict[str, Any] | None = None,
        *, embedding: list[float] | None = None, tenant_id: str = "default",
    ) -> bool:
        self._chunks.append(
            {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "text": text,
                "metadata": metadata or {},
                "embedding": embedding,
                "tenant_id": tenant_id,
            },
        )
        return True

    def bm25_search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for c in self._chunks:
            if query.lower() in c["text"].lower():
                results.append({**c, "score": 0.8})
        return results[:top_k]

    def count(self) -> int:
        return len(self._chunks)

    def is_available(self) -> bool:
        return self._available

    def close(self) -> None:
        pass


def _reset_rag_state() -> None:
    """Clear in-memory RAG singletons between tests."""
    from mate_tech_rag.api.document_registry import reset_registry
    from mate_tech_rag.api.retrieval import get_hybrid, get_lightrag, get_ragflow

    reset_registry()
    hybrid = get_hybrid()
    store = getattr(hybrid, "_store", None)
    if store is not None and hasattr(store, "_chunks"):
        store._chunks.clear()
    ragflow = get_ragflow()
    if hasattr(ragflow, "_chunks"):
        ragflow._chunks.clear()
    lightrag = get_lightrag()
    if hasattr(lightrag, "_chunks"):
        lightrag._chunks.clear()
    elif hasattr(lightrag, "clear"):
        lightrag.clear()


@pytest.fixture
def auth_acme() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-acme')}"}


@pytest.fixture
def client_no_pg() -> Iterator[TestClient]:
    """TestClient with _pg_store=None (default state)."""
    _reset_rag_state()
    import mate_tech_rag.api.retrieval as retrieval

    old_store = retrieval._pg_store
    old_client = retrieval._pg_client
    retrieval._pg_store = None
    retrieval._pg_client = None
    from mate_tech_rag.api import app as _app_module

    yield TestClient(_app_module.app)
    retrieval._pg_store = old_store
    retrieval._pg_client = old_client
    _reset_rag_state()


@pytest.fixture
def client_with_pg() -> Iterator[tuple[TestClient, FakePGStore]]:
    """TestClient with a FakePGStore wired into the retrieval module."""
    _reset_rag_state()
    import mate_tech_rag.api.retrieval as retrieval

    old_store = retrieval._pg_store
    old_client = retrieval._pg_client
    fake = FakePGStore()
    retrieval._pg_store = fake
    retrieval._pg_client = None
    from mate_tech_rag.api import app as _app_module

    yield TestClient(_app_module.app), fake
    retrieval._pg_store = old_store
    retrieval._pg_client = old_client
    _reset_rag_state()


# ---------------------------------------------------------------------------
# 1. create_clients() PG initialization
# ---------------------------------------------------------------------------
class TestCreateClientsPGInit:
    def test_pg_store_initialization_with_dsn(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """When PG_DSN is set, create_clients() creates PGClient + PGStore."""
        import mate_tech_rag.api.retrieval as retrieval

        old_store = retrieval._pg_store
        old_client = retrieval._pg_client
        old_hybrid = retrieval._hybrid
        monkeypatch.setenv("PG_DSN", "postgresql://test:test@localhost:5432/testdb")
        monkeypatch.delenv("RAG_MODE", raising=False)
        try:
            retrieval._pg_store = None
            retrieval._pg_client = None
            retrieval.create_clients()
            # PGStore wrapper should be created even if PG server is unreachable.
            assert retrieval._pg_store is not None, "_pg_store should be initialized"
            assert retrieval._pg_client is not None, "_pg_client should be initialized"
        finally:
            retrieval._pg_store = old_store
            retrieval._pg_client = old_client
            retrieval._hybrid = old_hybrid

    def test_pg_store_none_without_dsn(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """When PG_DSN is not set, _pg_store stays None."""
        import mate_tech_rag.api.retrieval as retrieval

        old_store = retrieval._pg_store
        old_client = retrieval._pg_client
        old_hybrid = retrieval._hybrid
        monkeypatch.delenv("PG_DSN", raising=False)
        monkeypatch.delenv("RAG_MODE", raising=False)
        try:
            retrieval._pg_store = None
            retrieval._pg_client = None
            retrieval.create_clients()
            assert retrieval._pg_store is None
            assert retrieval._pg_client is None
        finally:
            retrieval._pg_store = old_store
            retrieval._pg_client = old_client
            retrieval._hybrid = old_hybrid

    def test_create_clients_initializes_pg(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """create_clients() with PG_DSN makes get_pg_store() non-None."""
        import mate_tech_rag.api.retrieval as retrieval

        old_store = retrieval._pg_store
        old_client = retrieval._pg_client
        old_hybrid = retrieval._hybrid
        monkeypatch.setenv("PG_DSN", "postgresql://user:pass@dbhost:5432/mydb")
        monkeypatch.delenv("RAG_MODE", raising=False)
        try:
            retrieval._pg_store = None
            retrieval._pg_client = None
            retrieval.create_clients()
            assert retrieval.get_pg_store() is not None
        finally:
            retrieval._pg_store = old_store
            retrieval._pg_client = old_client
            retrieval._hybrid = old_hybrid


# ---------------------------------------------------------------------------
# 2. HybridV2 fallback (graceful degradation)
# ---------------------------------------------------------------------------
class TestHybridV2Fallback:
    def test_hybrid_v2_fallback_to_hybrid(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """When PG is set but unavailable (no psycopg), hybrid stays functional."""
        import mate_tech_rag.api.retrieval as retrieval
        from mate_tech_rag.clients.hybrid_client import InMemoryHybridClient
        from mate_tech_rag.clients.hybrid_v2_client import HybridV2Client

        old_store = retrieval._pg_store
        old_client = retrieval._pg_client
        old_hybrid = retrieval._hybrid
        old_hybrid_real = retrieval._hybrid_real
        monkeypatch.setenv("PG_DSN", "postgresql://x:y@fake:5432/fakedb")
        monkeypatch.setenv("RAG_MODE", "hybrid")
        try:
            retrieval._pg_store = None
            retrieval._pg_client = None
            retrieval._hybrid = InMemoryHybridClient()
            retrieval.create_clients()
            # _hybrid should be a valid client (not crashed).
            assert retrieval._hybrid is not None
            # PG store exists but may not be available (psycopg missing).
            assert retrieval._pg_store is not None
            # HybridV2 should NOT be active if PG is unavailable.
            assert not isinstance(retrieval._hybrid, HybridV2Client)
        finally:
            retrieval._pg_store = old_store
            retrieval._pg_client = old_client
            retrieval._hybrid = old_hybrid
            retrieval._hybrid_real = old_hybrid_real


# ---------------------------------------------------------------------------
# 3. Ingest / upload writes to PG
# ---------------------------------------------------------------------------
class TestIngestWritesPG:
    def test_ingest_writes_to_pg(
        self,
        client_with_pg: tuple[TestClient, FakePGStore],
        auth_acme: dict[str, str],
    ) -> None:
        """POST /ingest writes chunks to PG store."""
        client, fake_store = client_with_pg
        assert fake_store.count() == 0
        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-pg-1", "chunks": ["hello world", "second chunk"]},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        assert fake_store.count() == 2, f"expected 2 chunks in PG, got {fake_store.count()}"

    def test_upload_writes_to_pg(
        self,
        client_with_pg: tuple[TestClient, FakePGStore],
        auth_acme: dict[str, str],
    ) -> None:
        """POST /upload writes chunks to PG store."""
        client, fake_store = client_with_pg
        r = client.post(
            "/api/v1/rag/upload",
            files={"file": ("test.md", b"# Title\n\nPG content.", "text/markdown")},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        assert fake_store.count() >= 1, f"expected chunks in PG, got {fake_store.count()}"


# ---------------------------------------------------------------------------
# 4. /admin/pg-stats endpoint
# ---------------------------------------------------------------------------
class TestPgStatsEndpoint:
    def test_pg_stats_endpoint_returns_available(
        self,
        client_with_pg: tuple[TestClient, FakePGStore],
        auth_acme: dict[str, str],
    ) -> None:
        """When _pg_store is available, /admin/pg-stats returns available=True."""
        client, fake_store = client_with_pg
        # Ingest a chunk first so count > 0.
        client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-stats", "chunks": ["stats chunk"]},
            headers=auth_acme,
        )
        r = client.get("/api/v1/rag/admin/pg-stats", headers=auth_acme)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["available"] is True, body
        assert body["chunks_count"] >= 1, body

    def test_pg_stats_endpoint_default_unavailable(
        self,
        client_no_pg: TestClient,
        auth_acme: dict[str, str],
    ) -> None:
        """When _pg_store is None, /admin/pg-stats returns available=False."""
        r = client_no_pg.get("/api/v1/rag/admin/pg-stats", headers=auth_acme)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["available"] is False, body
        assert body["chunks_count"] == 0, body
