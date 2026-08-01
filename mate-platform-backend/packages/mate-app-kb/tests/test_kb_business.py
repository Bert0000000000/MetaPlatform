"""BUSINESS-SLICES deep tests for mate-app-kb.

Covers the P0 business logic added in the second batch:
  - Collection CRUD (POST/GET/DELETE /collections)
  - Document lifecycle state machine (uploaded -> indexing -> indexed/failed/archived)
  - Document management (list/get/delete with filters)
  - Search audit log (search writes a log entry)
  - Retrieval scoring (dedup by document_id, sort by score desc)
  - Outbox event emission (kb.collection.created / deleted, kb.document.*)
  - Cross-tenant isolation

Test setup follows test_kb_path_alias.py: install_auth is mocked, a
fake middleware injects a RequestContext with a real tenant_id, and
require_tenant runs naturally (no mock) so the tenant guard is real.
"""
from __future__ import annotations

import os
import sys
import time
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

from mate_platform.messaging.outbox import InMemoryOutboxWriter


_VALID_BPMN = ""  # not used in kb tests; placeholder to avoid linter


def _make_tenant_ctx(tenant: str = "tenant-acme"):
    """Build a RequestContext with a real tenant_id for the fake middleware."""
    from mate_platform.tenancy import (
        AuthMethod,
        RequestContext,
        TenantId,
        UserId,
    )

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
def outbox():
    return InMemoryOutboxWriter()


@pytest.fixture
def client(outbox):
    """TestClient with mocked auth + real require_tenant + fresh store."""
    from fastapi.testclient import TestClient

    from mate_app_kb.api.app import create_app
    from mate_app_kb.clients import AgentClient, RAGClient
    from mate_app_kb.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()

    fake_rag = RAGClient()
    fake_rag.search = lambda query, top_k=5, mode="AUTO": {
        "query": query,
        "mode": mode,
        "total": 2,
        "hits": [
            {"document_id": "doc-a", "score": 0.9, "content": "alpha beta"},
            {"document_id": "doc-b", "score": 0.7, "content": "gamma delta"},
        ],
    }
    fake_rag.stats = lambda: {"total_chunks": 7, "embedder_dim": 1536}

    fake_agent = AgentClient()
    fake_agent.chat = lambda message, scenario="S1", thread_id=None: {
        "thread_id": thread_id or "t-1",
        "scenario": scenario,
        "answer": f"echo:{message}",
        "retrieved_chunks": [],
        "tool_calls": [],
    }

    # Only mock install_auth — let require_tenant run naturally.
    with patch("mate_app_kb.api.app.install_auth"):
        app = create_app(rag=fake_rag, agent=fake_agent)
        app.state.outbox_writer = outbox

        async def fake_middleware(request, call_next):
            request.state.ctx = _make_tenant_ctx()
            return await call_next(request)

        app.middleware("http")(fake_middleware)
        yield TestClient(app)

    in_memory_repo.reset_store()


@pytest.fixture
def client_tenant_b(outbox):
    """TestClient bound to a different tenant (tenant-globex)."""
    from fastapi.testclient import TestClient

    from mate_app_kb.api.app import create_app
    from mate_app_kb.clients import AgentClient, RAGClient
    from mate_app_kb.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()

    fake_rag = RAGClient()
    fake_rag.search = lambda query, top_k=5, mode="AUTO": {
        "query": query, "mode": mode, "total": 0, "hits": [],
    }
    fake_rag.stats = lambda: {"total_chunks": 0, "embedder_dim": 0}

    with patch("mate_app_kb.api.app.install_auth"):
        app = create_app(rag=fake_rag, agent=AgentClient())
        app.state.outbox_writer = outbox

        async def fake_middleware(request, call_next):
            request.state.ctx = _make_tenant_ctx("tenant-globex")
            return await call_next(request)

        app.middleware("http")(fake_middleware)
        yield TestClient(app)

    in_memory_repo.reset_store()


def _seed_doc(tenant_id: str, doc_id: str, status: str = "uploaded"):
    """Insert a document directly into the in-memory store for lifecycle tests."""
    from mate_app_kb.repositories.in_memory import KbDocument, put_document

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    put_document(tenant_id, KbDocument(
        id=doc_id, tenant_id=tenant_id, collection_id="kb-sales",
        document_id=doc_id, filename="test.md", size_bytes=100,
        chunk_count=0, status=status, metadata={"source": "test"},
        created_at=now, updated_at=now,
    ))


# ---------------------------------------------------------------------------
# Collection CRUD
# ---------------------------------------------------------------------------
def test_create_collection(client) -> None:
    """POST /collections creates a collection with active status."""
    r = client.post(
        "/api/v1/kb/collections",
        json={"name": "New KB", "description": "test collection", "config": {}},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "New KB"
    assert body["status"] == "active"
    assert body["document_count"] == 0


def test_create_collection_emits_outbox(client, outbox) -> None:
    """POST /collections emits kb.collection.created."""
    client.post(
        "/api/v1/kb/collections",
        json={"name": "Event KB", "description": ""},
    )
    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "kb.collection.created" in types


def test_list_collections(client) -> None:
    """GET /collections returns tenant-scoped collections."""
    r = client.get("/api/v1/kb/collections")
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) >= 3  # 3 seeded collections
    assert all(c["tenant_id"] == "tenant-acme" for c in body)


def test_get_collection_by_id(client) -> None:
    """GET /collections/{cid} returns the collection."""
    r = client.get("/api/v1/kb/collections/kb-sales")
    assert r.status_code == 200, r.text
    assert r.json()["id"] == "kb-sales"


def test_get_collection_not_found(client) -> None:
    """GET /collections/{cid} with unknown id -> 404."""
    r = client.get("/api/v1/kb/collections/nope")
    assert r.status_code == 404, r.text


def test_delete_collection(client) -> None:
    """DELETE /collections/{cid} removes the collection."""
    r = client.delete("/api/v1/kb/collections/kb-ops")
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == "kb-ops"
    # Verify it's gone.
    r2 = client.get("/api/v1/kb/collections/kb-ops")
    assert r2.status_code == 404


def test_delete_collection_not_found(client) -> None:
    """DELETE /collections/{cid} with unknown id -> 404."""
    r = client.delete("/api/v1/kb/collections/nope")
    assert r.status_code == 404, r.text


def test_delete_collection_emits_outbox(client, outbox) -> None:
    """DELETE /collections/{cid} emits kb.collection.deleted."""
    client.delete("/api/v1/kb/collections/kb-ops")
    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "kb.collection.deleted" in types


# ---------------------------------------------------------------------------
# Document management + filters
# ---------------------------------------------------------------------------
def test_list_documents_filtered_by_collection(client) -> None:
    """GET /documents?collection_id= filters by collection."""
    r = client.get("/api/v1/kb/documents", params={"collection_id": "kb-sales"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) >= 2  # doc-1 and doc-2 are in kb-sales
    assert all(d["collection_id"] == "kb-sales" for d in body)


def test_list_documents_filtered_by_status(client) -> None:
    """GET /documents?status= filters by lifecycle status."""
    r = client.get("/api/v1/kb/documents", params={"status": "indexed"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) >= 3  # all seeded docs are indexed
    assert all(d["status"] == "indexed" for d in body)


def test_get_document_by_id(client) -> None:
    """GET /documents/{did} returns the document."""
    r = client.get("/api/v1/kb/documents/doc-1")
    assert r.status_code == 200, r.text
    assert r.json()["id"] == "doc-1"


def test_get_document_not_found(client) -> None:
    """GET /documents/{did} with unknown id -> 404."""
    r = client.get("/api/v1/kb/documents/nope")
    assert r.status_code == 404, r.text


def test_delete_document(client) -> None:
    """DELETE /documents/{did} removes the document."""
    r = client.delete("/api/v1/kb/documents/doc-1")
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == "doc-1"
    # Verify it's gone.
    assert client.get("/api/v1/kb/documents/doc-1").status_code == 404


def test_delete_document_emits_outbox(client, outbox) -> None:
    """DELETE /documents/{did} emits kb.document.deleted."""
    client.delete("/api/v1/kb/documents/doc-1")
    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "kb.document.deleted" in types


# ---------------------------------------------------------------------------
# Document lifecycle state machine
# ---------------------------------------------------------------------------
def test_transition_uploaded_to_indexing(client) -> None:
    """uploaded -> indexing succeeds."""
    _seed_doc("tenant-acme", "lifecycle-1", "uploaded")
    r = client.patch(
        "/api/v1/kb/documents/lifecycle-1/status",
        json={"status": "indexing"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "indexing"


def test_transition_indexing_to_indexed(client) -> None:
    """indexing -> indexed succeeds with chunk_count."""
    _seed_doc("tenant-acme", "lifecycle-2", "indexing")
    r = client.patch(
        "/api/v1/kb/documents/lifecycle-2/status",
        json={"status": "indexed", "chunk_count": 42},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "indexed"
    assert r.json()["chunk_count"] == 42


def test_transition_indexing_to_failed(client) -> None:
    """indexing -> failed succeeds with error message."""
    _seed_doc("tenant-acme", "lifecycle-3", "indexing")
    r = client.patch(
        "/api/v1/kb/documents/lifecycle-3/status",
        json={"status": "failed", "error": "parse timeout"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "failed"
    assert r.json()["metadata"]["error"] == "parse timeout"


def test_transition_indexed_to_archived(client) -> None:
    """indexed -> archived succeeds (seeded doc-1 is indexed)."""
    r = client.patch(
        "/api/v1/kb/documents/doc-1/status",
        json={"status": "archived"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "archived"


def test_transition_failed_to_indexing_retry(client) -> None:
    """failed -> indexing succeeds (retry after failure)."""
    _seed_doc("tenant-acme", "lifecycle-4", "failed")
    r = client.patch(
        "/api/v1/kb/documents/lifecycle-4/status",
        json={"status": "indexing"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "indexing"


def test_transition_invalid_path(client) -> None:
    """uploaded -> indexed is not a valid transition (409)."""
    _seed_doc("tenant-acme", "lifecycle-5", "uploaded")
    r = client.patch(
        "/api/v1/kb/documents/lifecycle-5/status",
        json={"status": "indexed"},
    )
    assert r.status_code == 409, r.text
    assert "invalid transition" in r.json()["detail"]


def test_transition_archived_is_terminal(client) -> None:
    """archived -> indexing is not a valid transition (409)."""
    _seed_doc("tenant-acme", "lifecycle-6", "archived")
    r = client.patch(
        "/api/v1/kb/documents/lifecycle-6/status",
        json={"status": "indexing"},
    )
    assert r.status_code == 409, r.text


def test_transition_document_not_found(client) -> None:
    """PATCH /documents/{did}/status with unknown id -> 404."""
    r = client.patch(
        "/api/v1/kb/documents/nope/status",
        json={"status": "indexing"},
    )
    assert r.status_code == 404, r.text


def test_transition_emits_outbox(client, outbox) -> None:
    """PATCH /documents/{did}/status emits kb.document.transitioned."""
    _seed_doc("tenant-acme", "lifecycle-7", "uploaded")
    client.patch(
        "/api/v1/kb/documents/lifecycle-7/status",
        json={"status": "indexing"},
    )
    events = [rec.event for rec in outbox.all_records()]
    transitioned = [e for e in events if e.type == "kb.document.transitioned"]
    assert len(transitioned) >= 1
    assert transitioned[0].payload["from"] == "uploaded"
    assert transitioned[0].payload["to"] == "indexing"


# ---------------------------------------------------------------------------
# Search audit log + scoring
# ---------------------------------------------------------------------------
def test_search_writes_audit_log(client) -> None:
    """POST /search writes a search log entry visible via GET /search/logs."""
    r_search = client.post(
        "/api/v1/kb/search",
        json={"query": "hello world", "top_k": 5, "mode": "AUTO"},
    )
    assert r_search.status_code == 200, r_search.text

    r_logs = client.get("/api/v1/kb/search/logs")
    assert r_logs.status_code == 200, r_logs.text
    logs = r_logs.json()
    # At least one log entry for this search query.
    assert any("hello world" in l["query"] for l in logs), logs


def test_search_emits_outbox(client, outbox) -> None:
    """POST /search emits kb.search.executed."""
    client.post(
        "/api/v1/kb/search",
        json={"query": "test query", "top_k": 5, "mode": "AUTO"},
    )
    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "kb.search.executed" in types


def test_search_scoring_dedup_and_sort(client) -> None:
    """Search scoring deduplicates by document_id and sorts by score desc."""
    from fastapi.testclient import TestClient
    from mate_app_kb.api.app import create_app
    from mate_app_kb.clients import AgentClient, RAGClient
    from mate_app_kb.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()
    fake_rag = RAGClient()
    # Two hits for the same document_id (dedup keeps highest score).
    fake_rag.search = lambda query, top_k=5, mode="AUTO": {
        "query": query, "mode": mode, "total": 3,
        "hits": [
            {"document_id": "doc-x", "score": 0.5, "content": "alpha"},
            {"document_id": "doc-x", "score": 0.9, "content": "alpha"},
            {"document_id": "doc-y", "score": 0.7, "content": "beta"},
        ],
    }
    fake_rag.stats = lambda: {"total_chunks": 0, "embedder_dim": 0}

    with patch("mate_app_kb.api.app.install_auth"):
        app = create_app(rag=fake_rag, agent=AgentClient())
        app.state.outbox_writer = InMemoryOutboxWriter()
        async def fake_mw(request, call_next):
            request.state.ctx = _make_tenant_ctx()
            return await call_next(request)
        app.middleware("http")(fake_mw)
        c = TestClient(app)

        r = c.post(
            "/api/v1/kb/search",
            json={"query": "alpha", "top_k": 10, "mode": "AUTO"},
        )
        assert r.status_code == 200, r.text
        hits = r.json()["hits"]
        # Dedup: 2 unique documents (doc-x, doc-y).
        assert len(hits) == 2, hits
        # Sort: highest score first (doc-x 0.9 > doc-y ~0.7).
        assert hits[0]["document_id"] == "doc-x"
        assert hits[0]["score"] >= hits[1]["score"]

    in_memory_repo.reset_store()


# ---------------------------------------------------------------------------
# Cross-tenant isolation
# ---------------------------------------------------------------------------
def test_collection_tenant_isolation(client, client_tenant_b) -> None:
    """Tenant A's collections are invisible to tenant B."""
    # Tenant acme creates a collection.
    r_acme = client.post(
        "/api/v1/kb/collections",
        json={"name": "Acme Private KB", "description": ""},
    )
    assert r_acme.status_code == 201
    acme_cid = r_acme.json()["id"]

    # Tenant globex cannot see it.
    r_globex = client_tenant_b.get(f"/api/v1/kb/collections/{acme_cid}")
    assert r_globex.status_code == 404
