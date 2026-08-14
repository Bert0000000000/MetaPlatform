"""P0 RAG/DW fixes: latency_ms + tenant-scoped embedding override + employee KB isolation.

Covers four real bugs / gaps landed in this batch:

  1. P0 latency_ms on /ingest and /upload responses.
       Schemas already carry the field; this test locks in that the
       handlers populate it with a non-negative integer.

  2. P0 IngestRequest / ParseRequest accept per-call base_url / api_key
       overrides. The ragflow client exposes an ``override()`` context
       manager that mutates ``_base_url`` / ``_api_key`` for the
       duration of a single parse/ingest call and restores them on exit.
       This test monkey-patches the ragflow singleton with a stub that
       records the URL it sees at parse-time, then exercises both the
       with-override and without-override code paths.

  3. P0 DW upload requires employee_id (no more silent ``dw-kb-default``
       fallback). The kb_id is forwarded to ``RAGClient.upload`` so the
       upstream rag service can register the document under the
       employee's own kb.

  4. P2 LearningPage (frontend) defensiveness — covered by tsc typecheck
       (see apps/web typecheck run).
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
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
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag", "mate-tech-dw"):
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


def _reset_rag_state() -> None:
    """Clear all in-memory RAG singletons between tests."""
    from mate_tech_rag.api import app as rag_app
    from mate_tech_rag.api.document_registry import reset_registry
    from mate_tech_rag.api.retrieval import (
        get_hybrid, get_lightrag, get_ragflow,
    )

    reset_registry()
    rag_app.reset_kb_documents()
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
def auth_acme() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-acme')}"}


@pytest.fixture
def auth_globex() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-globex')}"}


# ---------------------------------------------------------------------------
# 1. P0: latency_ms on /ingest and /upload responses
# ---------------------------------------------------------------------------
class TestLatencyMsReported:
    @pytest.fixture
    def client(self) -> Iterator[TestClient]:
        _reset_rag_state()
        from mate_tech_rag.api import app as _app_module
        yield TestClient(_app_module.app)
        _reset_rag_state()

    def test_ingest_response_carries_latency_ms(self, client, auth_acme):
        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-lat-1", "chunks": ["hello latency"]},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "latency_ms" in body, body
        assert isinstance(body["latency_ms"], int), body
        assert body["latency_ms"] >= 0, body

    def test_upload_response_carries_latency_ms(self, client, auth_acme):
        r = client.post(
            "/api/v1/rag/upload",
            files={"file": ("lat.md", b"# Title\n\nbody text", "text/markdown")},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "latency_ms" in body, body
        assert isinstance(body["latency_ms"], int), body
        assert body["latency_ms"] >= 0, body

    def test_search_response_carries_latency_ms(self, client, auth_acme):
        """Regression guard for the previously-existing SearchResponse latency_ms."""
        client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-lat-2", "chunks": ["latency test chunk"]},
            headers=auth_acme,
        )
        r = client.post(
            "/api/v1/rag/search",
            json={"query": "latency", "top_k": 5},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["latency_ms"] >= 0, body


# ---------------------------------------------------------------------------
# 2. P0: per-request ragflow override (tenant-scoped parsing/embedding)
# ---------------------------------------------------------------------------
class _StubRagflowWithOverride:
    """Stub ragflow client that records _base_url / _api_key at parse-time.

    Mirrors the surface used by ``mate_tech_rag.api.parse.parse_document``
    and the upload handler: ``parse()``, ``parse_bytes()``, and
    ``override()`` (the context manager that temporarily rebinds
    ``_base_url`` / ``_api_key`` for a single call).
    """

    def __init__(self) -> None:
        self._base_url = "http://default-ragflow:9380"
        self._api_key = "default-key"
        self.calls: list[dict] = []

    @contextmanager
    def override(self, *, base_url=None, api_key=None):
        saved_url = self._base_url
        saved_key = self._api_key
        if base_url:
            self._base_url = base_url.rstrip("/")
        if api_key:
            self._api_key = api_key
        try:
            yield self
        finally:
            self._base_url = saved_url
            self._api_key = saved_key

    def parse(self, content, document_id, *, metadata=None):
        self.calls.append(
            {"method": "parse", "url": self._base_url, "api_key": self._api_key}
        )
        return [content] if content.strip() else []

    def parse_bytes(self, raw, document_id, *, filename="", metadata=None):
        self.calls.append(
            {"method": "parse_bytes", "url": self._base_url, "api_key": self._api_key}
        )
        text = raw.decode("utf-8", errors="replace") if raw else ""
        return [text] if text.strip() else []

    def count(self):
        return 0


class TestRagflowPerRequestOverride:
    """Tenant-scoped ragflow endpoint override via IngestRequest/ParseRequest."""

    @pytest.fixture
    def client_with_stub(self) -> Iterator[tuple[TestClient, _StubRagflowWithOverride]]:
        from mate_tech_rag.api import retrieval as _retrieval
        from mate_tech_rag.api import app as _app_module

        _reset_rag_state()
        stub = _StubRagflowWithOverride()
        _retrieval.set_dependencies(ragflow=stub)
        try:
            yield TestClient(_app_module.app), stub
        finally:
            _retrieval.set_dependencies(ragflow=None)
            _reset_rag_state()

    def test_ingest_without_override_uses_default_url(
        self, client_with_stub, auth_acme,
    ):
        """POST /ingest without override fields → ragflow parses at default URL."""
        client, stub = client_with_stub
        # Ingest doesn't call ragflow today, but the override ctx wraps the
        # call site anyway. Verify the no-override path is a clean no-op:
        # no parse call recorded because ingest doesn't parse.
        r = client.post(
            "/api/v1/rag/ingest",
            json={"document_id": "doc-ov-1", "chunks": ["override noop"]},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        assert stub.calls == [], stub.calls

    def test_ingest_with_override_restores_default(
        self, client_with_stub, auth_acme,
    ):
        """POST /ingest with override fields → ctx enters & exits cleanly."""
        client, stub = client_with_stub
        r = client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-ov-2",
                "chunks": ["override applied"],
                "base_url": "http://tenant-ragflow-1:9380",
                "api_key": "tenant-key-1",
                "tenant_id": "tenant-acme",
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        # After the call, the stub's url/key must be restored.
        assert stub._base_url == "http://default-ragflow:9380", stub._base_url
        assert stub._api_key == "default-key", stub._api_key

    def test_parse_with_override_forwards_to_ragflow(
        self, client_with_stub, auth_acme,
    ):
        """POST /parse with override → ragflow.parse() sees overridden url/key."""
        client, stub = client_with_stub
        r = client.post(
            "/api/v1/rag/parse",
            json={
                "document_id": "doc-ov-parse",
                "content": "tenant-scoped parsing payload",
                "base_url": "http://tenant-ragflow-2:9380",
                "api_key": "tenant-key-2",
                "tenant_id": "tenant-acme",
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        assert len(stub.calls) == 1, stub.calls
        call = stub.calls[0]
        assert call["method"] == "parse", call
        assert call["url"] == "http://tenant-ragflow-2:9380", call
        assert call["api_key"] == "tenant-key-2", call
        # After the call, the singleton is restored.
        assert stub._base_url == "http://default-ragflow:9380", stub._base_url
        assert stub._api_key == "default-key", stub._api_key

    def test_parse_without_override_uses_default(
        self, client_with_stub, auth_acme,
    ):
        """POST /parse without override → ragflow.parse() sees default url/key."""
        client, stub = client_with_stub
        r = client.post(
            "/api/v1/rag/parse",
            json={
                "document_id": "doc-ov-parse-default",
                "content": "default parsing payload",
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        assert len(stub.calls) == 1, stub.calls
        call = stub.calls[0]
        assert call["url"] == "http://default-ragflow:9380", call
        assert call["api_key"] == "default-key", call

    def test_ingest_request_accepts_override_fields(self, client_with_stub, auth_acme):
        """IngestRequest schema-level: base_url / api_key / tenant_id are accepted."""
        client, _ = client_with_stub
        r = client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-ov-schema",
                "chunks": ["x"],
                "base_url": "http://x",
                "api_key": "k",
                "tenant_id": "tenant-x",
            },
            headers=auth_acme,
        )
        # 200, not 422 — schema accepts the new fields.
        assert r.status_code == 200, r.text

    def test_parse_request_accepts_override_fields(self, client_with_stub, auth_acme):
        """ParseRequest schema-level: base_url / api_key / tenant_id are accepted."""
        client, _ = client_with_stub
        r = client.post(
            "/api/v1/rag/parse",
            json={
                "document_id": "doc-ov-parse-schema",
                "content": "y",
                "base_url": "http://y",
                "api_key": "k2",
                "tenant_id": "tenant-y",
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# 3. P0: DW upload requires employee_id (no dw-kb-default fallback)
# ---------------------------------------------------------------------------
class _StubRagUploadCapture:
    """Stub RAGClient that records every call to upload."""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    def upload(
        self,
        file_content: bytes,
        filename: str,
        document_id: str,
        content_type: str = "text/plain",
        *,
        kb_id=None,
    ):
        self.calls.append({
            "args": (file_content, filename, document_id, content_type),
            "kb_id": kb_id,
        })
        return {
            "document_id": document_id,
            "filename": filename,
            "size_bytes": len(file_content),
            "chunk_count": 1,
            "indexed_in": ["hybrid"],
            "latency_ms": 0,
        }

    def ingest(self, *args, **kwargs):
        return {"document_id": args[0] if args else "x", "chunk_count": 0, "total_chunks": 0}

    def delete_document(self, doc_id):
        return {"deleted": True, "document_id": doc_id}

    def close(self) -> None:
        pass


@pytest.fixture
def dw_client_with_stub() -> Iterator[tuple[TestClient, _StubRagUploadCapture]]:
    from mate_tech_dw import clients as dw_clients
    from mate_tech_dw.main import create_app as dw_create_app
    from mate_tech_dw.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()
    stub = _StubRagUploadCapture()
    app = dw_create_app()
    # Patch RAGClient.upload at the class level so the dw app picks up the stub.
    original = dw_clients.RAGClient.upload
    dw_clients.RAGClient.upload = stub.upload  # type: ignore[method-assign]
    try:
        yield TestClient(app), stub
    finally:
        dw_clients.RAGClient.upload = original  # type: ignore[method-assign]
        in_memory_repo.reset_store()


class TestDwUploadKbIsolation:
    """P0: dw /documents/upload enforces employee_id and forwards it as kb_id."""

    def test_upload_without_employee_id_returns_400(
        self, dw_client_with_stub, auth_acme,
    ):
        client, stub = dw_client_with_stub
        r = client.post(
            "/api/v1/dw/documents/upload",
            headers=auth_acme,
            files={"file": ("hr.md", b"hello", "text/markdown")},
            # NB: no employee_id form field — must 400.
        )
        assert r.status_code == 400, r.text
        assert "employee_id" in r.json()["detail"], r.json()
        # No RAG call should have been made.
        assert stub.calls == [], stub.calls

    def test_upload_with_empty_employee_id_returns_400(
        self, dw_client_with_stub, auth_acme,
    ):
        client, stub = dw_client_with_stub
        r = client.post(
            "/api/v1/dw/documents/upload",
            headers=auth_acme,
            files={"file": ("hr.md", b"hello", "text/markdown")},
            data={"employee_id": ""},
        )
        assert r.status_code == 400, r.text
        assert "employee_id" in r.json()["detail"], r.json()
        assert stub.calls == [], stub.calls

    def test_upload_with_whitespace_employee_id_returns_400(
        self, dw_client_with_stub, auth_acme,
    ):
        client, stub = dw_client_with_stub
        r = client.post(
            "/api/v1/dw/documents/upload",
            headers=auth_acme,
            files={"file": ("hr.md", b"hello", "text/markdown")},
            data={"employee_id": "   "},
        )
        assert r.status_code == 400, r.text
        assert stub.calls == [], stub.calls

    def test_upload_with_employee_id_forwards_kb_id(
        self, dw_client_with_stub, auth_acme,
    ):
        client, stub = dw_client_with_stub
        r = client.post(
            "/api/v1/dw/documents/upload",
            headers=auth_acme,
            files={"file": ("hr.md", b"hello world", "text/markdown")},
            data={"employee_id": "emp-x"},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        # The DW catalog row carries the kb_id = employee_id.
        assert body["kb_id"] == "emp-x", body
        # The RAG client received the kb_id for tenant-isolated KB ingest.
        assert len(stub.calls) == 1, stub.calls
        call = stub.calls[0]
        assert call["kb_id"] == "emp-x", call
        assert call["args"][1] == "hr.md", call  # filename
        assert call["args"][3] == "text/markdown", call  # content_type

    def test_upload_no_longer_uses_dw_kb_default(
        self, dw_client_with_stub, auth_acme,
    ):
        """Regression: previously ``kb_id = employee_id or "dw-kb-default"``.
        That fallback is gone; an absent employee_id must 400, never silently
        land in the shared ``dw-kb-default`` KB."""
        client, stub = dw_client_with_stub
        r = client.post(
            "/api/v1/dw/documents/upload",
            headers=auth_acme,
            files={"file": ("hr.md", b"hi", "text/markdown")},
        )
        assert r.status_code == 400, r.text
        # No rag call was made.
        assert stub.calls == [], stub.calls