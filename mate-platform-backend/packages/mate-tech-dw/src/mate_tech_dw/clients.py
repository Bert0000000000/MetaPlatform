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
    ) -> dict[str, Any]:
        """POST /api/v1/rag/upload (multipart) → real chunk + embed + 3-index ingest.

        Returns the RAG UploadResponse dict: {document_id, filename, size_bytes,
        chunk_count, indexed_in}.
        """
        files = {"file": (filename, file_content, content_type)}
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/upload",
            files=files,
            params={"document_id": document_id},
        )
        r.raise_for_status()
        return r.json()

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
