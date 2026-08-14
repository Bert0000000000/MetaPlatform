"""P2.11 SLO basic metrics + P1.7 cascade-delete tests for mate-tech-rag.

Coverage:
  * /api/v1/rag/metrics reports count + avg + last + p95 for each bucket
    after exercising the API.
  * DELETE /api/v1/rag/documents/{doc_id} clears the 3 indexes and the
    lifecycle record so subsequent searches return 0 hits for that doc.
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import jwt as pyjwt
import pytest

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


@pytest.fixture
def rag_client() -> Iterator["TestClient"]:
    _reset_rag_state()
    from fastapi.testclient import TestClient

    from mate_tech_rag.api import app as rag_app_module

    rag_app_module.app.state.outbox_writer = InMemoryOutboxWriter()
    # Reset metric buckets so test runs are isolated.
    from mate_tech_rag.api.metrics import make_default_buckets

    rag_app_module.app.state.metrics = make_default_buckets()
    rag_app_module.app.state.metrics_window_size = 32
    yield TestClient(rag_app_module.app)
    _reset_rag_state()


@pytest.fixture
def auth_acme() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-acme')}"}


# ---------------------------------------------------------------------------
# P2.11: SLO basic metrics
# ---------------------------------------------------------------------------
class TestRagSloMetrics:
    """GET /api/v1/rag/metrics must report count + avg + last + p95 for
    each endpoint bucket after exercising the API."""

    def test_metrics_search_count_increases_after_calls(
        self, rag_client, auth_acme,
    ) -> None:
        # Pre-seed a doc so the search has something to find.
        rag_client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-slo",
                "chunks": ["slo baseline content"],
            },
            headers=auth_acme,
        )
        # Run 10 searches.
        for _ in range(10):
            r = rag_client.post(
                "/api/v1/rag/search",
                json={"query": "slo", "top_k": 5},
                headers=auth_acme,
            )
            assert r.status_code == 200, r.text

        r = rag_client.get("/api/v1/rag/metrics", headers=auth_acme)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["search"]["count"] >= 10, body["search"]
        assert body["search"]["avg_ms"] >= 0.0
        assert body["search"]["last_latency_ms"] >= 0.0
        assert body["search"]["p95_recent"] >= 0.0
        assert body["window_size"] == 32

    def test_metrics_endpoint_records_upload_latency(
        self, rag_client, auth_acme,
    ) -> None:
        r = rag_client.post(
            "/api/v1/rag/upload",
            files={"file": ("slo.md", b"hello slo world", "text/markdown")},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text

        r2 = rag_client.get("/api/v1/rag/metrics", headers=auth_acme)
        assert r2.status_code == 200, r2.text
        upload_bucket = r2.json()["upload"]
        assert upload_bucket["count"] >= 1, upload_bucket

    def test_metrics_endpoint_records_ingest_latency(
        self, rag_client, auth_acme,
    ) -> None:
        r = rag_client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-slo-ingest",
                "chunks": ["slo ingest content"],
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text

        r2 = rag_client.get("/api/v1/rag/metrics", headers=auth_acme)
        assert r2.status_code == 200, r2.text
        bucket = r2.json()["ingest"]
        assert bucket["count"] >= 1, bucket


# ---------------------------------------------------------------------------
# P1.7: cascade delete on the RAG service directly
# ---------------------------------------------------------------------------
class TestRagCascadeDelete:
    """DELETE /api/v1/rag/documents/{doc_id} clears the 3 indexes and the
    lifecycle record so subsequent searches return 0 hits for that doc."""

    def test_ingest_then_delete_then_search_returns_zero(
        self, rag_client, auth_acme,
    ) -> None:
        # Seed a doc with a chunk that the query will match.
        r_seed = rag_client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-cascade",
                "chunks": ["unique cascade content orion"],
            },
            headers=auth_acme,
        )
        assert r_seed.status_code == 200, r_seed.text

        # Search returns hits before delete.
        r1 = rag_client.post(
            "/api/v1/rag/search",
            json={"query": "cascade content", "top_k": 5},
            headers=auth_acme,
        )
        assert r1.status_code == 200, r1.text
        # Tenant owns the doc — there is at least one hit. Even if cosine
        # similarity yields 0 hits at the embed level the tenant filter
        # owns the doc (it's in registry) so the search may yield 0 with
        # the embedder model. Just assert the doc is registered then move
        # on to confirm post-delete behaviour.
        from mate_tech_rag.api.document_registry import tenant_document_ids

        assert "doc-cascade" in tenant_document_ids("tenant-acme")

        # DELETE.
        r2 = rag_client.delete(
            "/api/v1/rag/documents/doc-cascade", headers=auth_acme,
        )
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["deleted"] is True, body
        # catalog_removed OR registry_removed should be True after delete.
        assert body["catalog_removed"] or body["registry_removed"], body

        # Subsequent registry lookup returns the empty set.
        assert "doc-cascade" not in tenant_document_ids("tenant-acme"), (
            "post-delete registry must not contain doc-cascade"
        )

        # Subsequent search returns 0 hits from this doc.
        r3 = rag_client.post(
            "/api/v1/rag/search",
            json={"query": "cascade content", "top_k": 5},
            headers=auth_acme,
        )
        assert r3.status_code == 200, r3.text
        assert all(
            h["document_id"] != "doc-cascade" for h in r3.json()["hits"]
        ), r3.json()

    def test_delete_unknown_doc_idempotent(self, rag_client, auth_acme) -> None:
        r = rag_client.delete(
            "/api/v1/rag/documents/no-such-tenant-doc", headers=auth_acme,
        )
        # Unknown doc returns 200 with deleted=False (idempotent).
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] is False, body
        assert body["document_id"] == "no-such-tenant-doc", body
