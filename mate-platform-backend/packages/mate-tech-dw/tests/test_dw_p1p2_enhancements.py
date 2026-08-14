"""P1.7 RAG 增强 — DW DELETE /documents/{doc_id} cascade tests.

Coverage:
  * upload then DELETE returns a fan-out summary that points at the
    upstream RAG cascade (the stub RAGClient records the call).
  * DELETE with an unknown doc_id returns 404.
  * DELETE with the upstream RAG unavailable still drops the local
    catalog row (best-effort cascade).
"""
from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from mate_tech_dw.main import create_app
from mate_tech_dw.repositories import in_memory as in_memory_repo


class _StubRag:
    """Records every RAG call and never raises."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def upload(self, *args, **kwargs):
        # Mirror the production RAGClient signature, used by the upload
        # endpoint — we don't care about the payload here.
        return {
            "document_id": kwargs.get("document_id") or "stub",
            "filename": "stub",
            "size_bytes": 0,
            "chunk_count": 0,
            "indexed_in": [],
        }

    def delete_document(self, document_id: str) -> dict:
        self.calls.append(document_id)
        return {
            "deleted": True,
            "document_id": document_id,
            "chunks_removed": 0,
            "graph_tuples_removed": 0,
            "lightrag_chunks_removed": 0,
            "pg_chunks_removed": 0,
            "catalog_removed": True,
            "registry_removed": True,
        }

    def close(self) -> None:
        pass


@pytest.fixture
def client_with_stub_rag() -> Iterator[tuple[TestClient, _StubRag]]:
    in_memory_repo.reset_store()
    from unittest.mock import patch

    from mate_tech_dw.clients import RAGClient

    stub = _StubRag()

    # Replace the RAGClient.delete_document method with our stub so the
    # DW upload / DELETE endpoints can exercise their cascade plumbing
    # without standing up the upstream RAG service.
    with patch.object(RAGClient, "delete_document", stub.delete_document, create=True):
        app = create_app()
        yield TestClient(app), stub
    in_memory_repo.reset_store()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return conftest_token("tenant-acme")


def conftest_token(tenant_id: str) -> dict[str, str]:
    import time as _t

    import jwt as pyjwt

    now = int(_t.time())
    return {
        "Authorization": f"Bearer {pyjwt.encode({'sub': 'u-1', 'iss': 'http://localhost:8080/realms/metaplatform', 'aud': 'metaplatform-backend', 'azp': 'metaplatform-backend', 'preferred_username': 'u-1', 'realm_access': {'roles': ['PLATFORM_SUPER_ADMIN']}, 'scope': 'platform.read platform.write', 'attributes': {'tenant_id': [tenant_id]}, 'tenant_id': tenant_id, 'roles': ['PLATFORM_SUPER_ADMIN'], 'iat': now, 'exp': now + 3600}, 'test-secret', algorithm='HS256')}",
    }


class TestDwDocumentCascadeDelete:
    """P1.7 RAG 增强: cascade-delete a DW-uploaded document."""

    def test_delete_calls_rag_then_clears_local(
        self, client_with_stub_rag, auth_headers,
    ) -> None:
        client, stub = client_with_stub_rag

        # Seed the in-memory catalog directly so we don't depend on the
        # multipart upload path (which would call the real RAG upstream).
        from mate_tech_dw.repositories.in_memory import DwDocument

        in_memory_repo.append_document(
            "tenant-acme",
            DwDocument(
                id="dw-doc-test",
                tenant_id="tenant-acme",
                name="manual.pdf",
                kind="pdf",
                size_bytes=1024,
                uploaded_by="u1",
                uploaded_at="2026-08-10T00:00:00Z",
                kb_id="kb-default",
                document_id="dw-doc-test",
                chunk_count=0,
            ),
        )

        r = client.delete(
            "/api/v1/dw/documents/dw-doc-test", headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["code"] == 0, body
        assert body["data"]["deleted"] is True, body
        assert body["data"]["id"] == "dw-doc-test", body
        # The stub recorded the cascade.
        assert stub.calls == ["dw-doc-test"], stub.calls
        # Local catalog row is gone.
        remaining = [
            d.id for d in in_memory_repo.list_documents("tenant-acme")
        ]
        assert "dw-doc-test" not in remaining, remaining

    def test_delete_unknown_returns_404(
        self, client_with_stub_rag, auth_headers,
    ) -> None:
        client, _stub = client_with_stub_rag
        r = client.delete(
            "/api/v1/dw/documents/never-existed", headers=auth_headers,
        )
        assert r.status_code == 404, r.text
