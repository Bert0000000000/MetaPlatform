"""mate_tech_dw.clients — outbound clients for cross-service aggregation.

The dw domain aggregates over mate-app-kb / mate-tech-rag / mate-tech-agent.
This module adds the real RAG write-path client (document upload → RAG ingest),
mirroring ``mate_app_kb.clients.RAGClient`` (httpx + service-identity bearer +
tenant header). The read-only aggregation methods (list_kb_documents /
list_agent_traces) remain reserved for a later batch.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx

from mate_clients.security import BearerAuth, OutgoingAuthMiddleware


class RAGClient:
    """HTTP client for mate-tech-rag /api/v1/rag/* (document upload → ingest).

    Injects bearer token + X-Tenant-Id via OutgoingAuthMiddleware so the
    outbound upload is tenant-scoped (ADR-0014 step 4 / hard rule 3).
    """

    DEFAULT_URL = "http://localhost:8001"

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 60.0,
        *,
        auth: BearerAuth | None = None,
        tenant_id: str = "",
        static_token: str | None = None,
    ) -> None:
        self._base_url = (base_url or os.environ.get("RAG_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        if tenant_id:
            self._client.headers["X-Tenant-Id"] = tenant_id
        # Dev fast path: a pre-minted HS256 token (INSECURE_SKIP_SIGNATURE) skips
        # the Keycloak client_credentials round-trip that needs a live Keycloak.
        if static_token:
            self._client.headers["Authorization"] = f"Bearer {static_token}"
        elif auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)
        self._auth = auth
        self._tenant_id = tenant_id
        self._static_token = static_token

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        if tenant_id:
            self._client.headers["X-Tenant-Id"] = tenant_id
        if self._auth is not None and tenant_id and not self._static_token:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    def upload(
        self,
        file_content: bytes,
        filename: str,
        document_id: str,
        content_type: str = "text/plain",
        *,
        kb_id: str | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/rag/upload (multipart) → real chunk + embed + 3-index ingest.

        When ``kb_id`` is provided it is forwarded as a query param so the
        upstream rag service can register the document under that kb (per-
        employee KB isolation). Returns the RAG UploadResponse dict:
        {document_id, filename, size_bytes, chunk_count, indexed_in,
        latency_ms}.
        """
        files = {"file": (filename, file_content, content_type)}
        params: dict[str, Any] = {"document_id": document_id}
        if kb_id:
            params["kb_id"] = kb_id
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/upload",
            files=files,
            params=params,
        )
        r.raise_for_status()
        return r.json()

    def ingest(
        self,
        document_id: str,
        chunks: list[str],
        metadata: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/rag/ingest (JSON) → real chunk + embed + 3-index ingest.

        Used by P2.10 to re-ingest a learning-feedback snippet (no file)
        directly into the RAG knowledge base. Returns the RAG IngestResponse
        dict: {document_id, chunk_count, total_chunks}.
        """
        payload: dict[str, Any] = {"document_id": document_id, "chunks": list(chunks)}
        if metadata:
            payload["metadata"] = dict(metadata)
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/ingest",
            json=payload,
        )
        r.raise_for_status()
        return r.json()

    def delete_document(self, document_id: str) -> dict[str, Any]:
        """DELETE /api/v1/rag/documents/{document_id} → cascade-delete in the
        upstream RAG service (vector + graph + lightrag + PG + lifecycle).

        Returns the RAG DeleteDocumentResponse dict: {deleted, document_id,
        chunks_removed, ...}. Returns an empty dict with deleted=False when
        the doc is unknown so callers can treat it as "not found" without a
        hard error.
        """
        r = self._client.delete(
            f"{self._base_url}/api/v1/rag/documents/{document_id}",
        )
        r.raise_for_status()
        try:
            return r.json()
        except Exception:  # noqa: BLE001 — best-effort
            return {"deleted": False, "document_id": document_id}

    def close(self) -> None:
        self._client.close()


@dataclass(frozen=True)
class AsyncDwClient:
    """Reserved outbound client for dw read-only aggregation.

    The upload write-path is covered by RAGClient above; the remaining
    read-only proxy calls (list_kb_documents / list_agent_traces / list_models)
    land in a later batch.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
