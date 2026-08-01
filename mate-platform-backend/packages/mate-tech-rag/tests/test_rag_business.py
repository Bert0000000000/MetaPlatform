"""BUSINESS-SLICES deep business-logic tests for mate-tech-rag.

Covers the P0 business logic added in the deep implementation:
  * Outbox event emission (ADR-0014 step 3): rag.document.uploaded,
    rag.document.ingested, rag.document.parsed, rag.search.executed
  * Tenant-scoped search filtering: tenant A ingests a document, tenant
    B's search returns 0 hits from A's document (cross-tenant isolation)
  * Document lifecycle (INGESTING -> INDEXED | FAILED) via the
    document_registry, including mark_failed on validation error
  * Chunk validation: empty/whitespace-only chunks -> HTTP 400,
    duplicate-chunk deduplication within a single ingest request
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

# --- module-level env setup (must precede app import) ----------------------
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))

from mate_platform.messaging.outbox import InMemoryOutboxWriter  # noqa: E402

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


def _reset_rag_state() -> None:
    """Clear all in-memory RAG singletons between tests."""
    from mate_tech_rag.api.document_registry import reset_registry
    from mate_tech_rag.api.retrieval import get_hybrid, get_lightrag, get_ragflow

    reset_registry()
    # Hybrid store: clear underlying chunk dict.
    hybrid = get_hybrid()
    store = getattr(hybrid, "_store", None)
    if store is not None and hasattr(store, "_chunks"):
        store._chunks.clear()
    # RAGFlow in-memory: clear parsed chunks.
    ragflow = get_ragflow()
    if hasattr(ragflow, "_chunks"):
        ragflow._chunks.clear()
    # LightRAG in-memory: clear if it has a reset/clear method.
    lightrag = get_lightrag()
    if hasattr(lightrag, "_chunks"):
        lightrag._chunks.clear()
    elif hasattr(lightrag, "clear"):
        lightrag.clear()


@pytest.fixture
def outbox() -> InMemoryOutboxWriter:
    return InMemoryOutboxWriter()


@pytest.fixture
def client(outbox: InMemoryOutboxWriter) -> Iterator[TestClient]:
    _reset_rag_state()
    from mate_tech_rag.api import app as _app_module
    _app_module.app.state.outbox_writer = outbox
    yield TestClient(_app_module.app)
    _reset_rag_state()


@pytest.fixture
def auth_acme() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-acme')}"}


@pytest.fixture
def auth_globex() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-globex')}"}


# ---------------------------------------------------------------------------
# 1. Outbox event emission (ADR-0014 step 3)
# ---------------------------------------------------------------------------
class TestOutboxEvents:
    def test_ingest_emits_document_ingested(self, client, auth_acme, outbox):
        """POST /ingest emits rag.document.ingested."""
        r = client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-1",
                "chunks": ["hello world", "second chunk"],
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        types = {rec.event.type for rec in outbox.all_records()}
        assert "rag.document.ingested" in types, types

    def test_search_emits_search_executed(self, client, auth_acme, outbox):
        """POST /search emits rag.search.executed."""
        # First ingest a doc so the tenant owns at least one document.
        client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-s", "chunks": ["searchable text"]},
            headers=auth_acme,
        )
        r = client.post(
            "/api/v1/rag/search",
            json={"query": "searchable", "top_k": 5},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        types = {rec.event.type for rec in outbox.all_records()}
        assert "rag.search.executed" in types, types

    def test_parse_emits_document_parsed(self, client, auth_acme, outbox):
        """POST /parse emits rag.document.parsed."""
        r = client.post(
            "/api/v1/rag/parse",
            json={
                "document_id": "doc-p",
                "content": "This is a paragraph.\n\nSecond paragraph here.",
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        types = {rec.event.type for rec in outbox.all_records()}
        assert "rag.document.parsed" in types, types

    def test_upload_emits_document_uploaded(self, client, auth_acme, outbox):
        """POST /upload emits rag.document.uploaded."""
        r = client.post(
            "/api/v1/rag/upload",
            files={"file": ("test.md", b"# Title\n\nSome content here.", "text/markdown")},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        types = {rec.event.type for rec in outbox.all_records()}
        assert "rag.document.uploaded" in types, types

    def test_outbox_events_carry_tenant_id(self, client, auth_acme, outbox):
        """All emitted events carry the requesting tenant_id (hard rule 3)."""
        client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-t", "chunks": ["tenant tagged"]},
            headers=auth_acme,
        )
        for rec in outbox.all_records():
            assert rec.event.tenant_id == "tenant-acme", rec.event


# ---------------------------------------------------------------------------
# 2. Tenant-scoped search (cross-tenant isolation)
# ---------------------------------------------------------------------------
class TestTenantScopedSearch:
    def test_cross_tenant_search_returns_zero(self, client, auth_acme, auth_globex):
        """Tenant A ingests a doc; tenant B's search returns 0 hits from it."""
        # Tenant acme ingests a document.
        r = client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-acme-secret",
                "chunks": ["acme confidential project orion details"],
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        # Tenant globex searches for the same text -> 0 hits.
        r2 = client.post(
            "/api/v1/rag/search",
            json={"query": "acme confidential", "top_k": 10},
            headers=auth_globex,
        )
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["total"] == 0, body
        # None of the hits should reference acme's document.
        for hit in body["hits"]:
            assert hit["document_id"] != "doc-acme-secret", hit

    def test_same_tenant_search_returns_hits(self, client, auth_acme):
        """Tenant A ingests; tenant A's search returns hits from that doc."""
        client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-acme-visible",
                "chunks": ["visible content for acme tenant"],
            },
            headers=auth_acme,
        )
        r = client.post(
            "/api/v1/rag/search",
            json={"query": "visible content", "top_k": 10},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1, body
        assert all(
            h["document_id"] == "doc-acme-visible" for h in body["hits"]
        ), body

    def test_search_with_no_owned_documents(self, client, auth_globex):
        """A tenant that has never ingested anything gets 0 search hits."""
        r = client.post(
            "/api/v1/rag/search",
            json={"query": "anything", "top_k": 10},
            headers=auth_globex,
        )
        assert r.status_code == 200, r.text
        assert r.json()["total"] == 0, r.json()


# ---------------------------------------------------------------------------
# 3. Document lifecycle (INGESTING -> INDEXED | FAILED)
# ---------------------------------------------------------------------------
class TestDocumentLifecycle:
    def test_ingest_transitions_to_indexed(self, client, auth_acme):
        """Successful ingest transitions the document to INDEXED."""
        from mate_tech_rag.api.document_registry import get_document

        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-lc", "chunks": ["lifecycle chunk"]},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        rec = get_document("tenant-acme", "doc-lc")
        assert rec is not None, "document not registered"
        assert rec.status == "INDEXED", rec.status
        assert rec.chunk_count == 1, rec.chunk_count

    def test_upload_transitions_to_indexed(self, client, auth_acme):
        """Successful upload transitions the document to INDEXED."""
        from mate_tech_rag.api.document_registry import get_document

        r = client.post(
            "/api/v1/rag/upload",
            files={"file": ("lc.md", b"upload lifecycle content", "text/markdown")},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        doc_id = r.json()["document_id"]
        rec = get_document("tenant-acme", doc_id)
        assert rec is not None
        assert rec.status == "INDEXED", rec.status
        assert rec.source == "upload", rec.source

    def test_parse_transitions_to_indexed(self, client, auth_acme):
        """Successful parse transitions the document to INDEXED."""
        from mate_tech_rag.api.document_registry import get_document

        r = client.post(
            "/api/v1/rag/parse",
            json={"document_id": "doc-parse", "content": "parse lifecycle text"},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        rec = get_document("tenant-acme", "doc-parse")
        assert rec is not None
        assert rec.status == "INDEXED", rec.status

    def test_failed_ingest_transitions_to_failed(self, client, auth_acme):
        """An ingest with all-empty chunks fails validation -> FAILED."""
        from mate_tech_rag.api.document_registry import get_document

        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-fail", "chunks": ["  ", ""]},
            headers=auth_acme,
        )
        assert r.status_code == 400, r.text
        rec = get_document("tenant-acme", "doc-fail")
        assert rec is not None, "document not registered before failure"
        assert rec.status == "FAILED", rec.status
        assert "empty" in rec.error.lower(), rec.error

    def test_tenant_document_ids_isolated(self, client, auth_acme, auth_globex):
        """tenant_document_ids only returns the caller's documents."""
        from mate_tech_rag.api.document_registry import tenant_document_ids

        client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-a", "chunks": ["acme doc"]},
            headers=auth_acme,
        )
        client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-g", "chunks": ["globex doc"]},
            headers=auth_globex,
        )
        acme_ids = tenant_document_ids("tenant-acme")
        globex_ids = tenant_document_ids("tenant-globex")
        assert "doc-a" in acme_ids, acme_ids
        assert "doc-g" not in acme_ids, acme_ids
        assert "doc-g" in globex_ids, globex_ids
        assert "doc-a" not in globex_ids, globex_ids


# ---------------------------------------------------------------------------
# 4. Chunk validation
# ---------------------------------------------------------------------------
class TestChunkValidation:
    def test_all_empty_chunks_rejected_400(self, client, auth_acme):
        """All-whitespace chunks are rejected with HTTP 400."""
        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-empty", "chunks": ["   ", ""]},
            headers=auth_acme,
        )
        assert r.status_code == 400, r.text
        assert "empty" in r.json()["detail"].lower(), r.json()

    def test_duplicate_chunks_deduplicated(self, client, auth_acme):
        """Duplicate chunks are deduplicated; only unique chunks indexed."""
        r = client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-dup",
                "chunks": ["same text", "same text", "same text", "different"],
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # 2 unique chunks after dedup.
        assert body["chunk_count"] == 2, body
        assert body["total_chunks"] == 4, body

    def test_partial_empty_chunks_filtered(self, client, auth_acme):
        """Empty chunks among valid ones are filtered, not fatal."""
        r = client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-mixed",
                "chunks": ["valid chunk", "", "  ", "another valid"],
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["chunk_count"] == 2, body
        assert body["total_chunks"] == 4, body

    def test_empty_chunks_marked_failed(self, client, auth_acme):
        """Empty-chunk ingest marks the document FAILED in the registry."""
        from mate_tech_rag.api.document_registry import get_document

        client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-fail2", "chunks": ["   "]},
            headers=auth_acme,
        )
        rec = get_document("tenant-acme", "doc-fail2")
        assert rec is not None
        assert rec.status == "FAILED", rec.status


# ---------------------------------------------------------------------------
# 5. Input validation (schema-level)
# ---------------------------------------------------------------------------
class TestInputValidation:
    def test_empty_query_rejected(self, client, auth_acme):
        """Empty query is rejected by Pydantic min_length=1."""
        r = client.post(
            "/api/v1/rag/search",
            json={"query": "", "top_k": 5},
            headers=auth_acme,
        )
        assert r.status_code == 422, r.text

    def test_empty_document_id_rejected(self, client, auth_acme):
        """Empty document_id is rejected by Pydantic min_length=1."""
        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "", "chunks": ["x"]},
            headers=auth_acme,
        )
        assert r.status_code == 422, r.text

    def test_empty_chunks_list_rejected(self, client, auth_acme):
        """Empty chunks list is rejected by Pydantic min_length=1."""
        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-x", "chunks": []},
            headers=auth_acme,
        )
        assert r.status_code == 422, r.text

    def test_top_k_out_of_range_rejected(self, client, auth_acme):
        """top_k > 100 is rejected by Pydantic le=100."""
        r = client.post(
            "/api/v1/rag/search",
            json={"query": "x", "top_k": 999},
            headers=auth_acme,
        )
        assert r.status_code == 422, r.text
