"""HTTP clients for downstream services.

Reuses the SEC-IAM-01 + SEC-TENANT-01 contracts:
  - BearerAuth: client_credentials token cache.
  - OutgoingAuthMiddleware: injects Authorization + X-Tenant-Id.

The client constructor takes an optional `tenant_id` so the caller
can scope calls to a specific tenant. In the FastAPI handler, the
`tenant_id` is read from `request.state.ctx.tenant_id` (set by
the auth middleware) and passed to the client.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

from mate_clients.security import BearerAuth, OutgoingAuthMiddleware


class RAGClient:
    """HTTP client for mate-tech-rag /api/v1/rag/*.

    Adds bearer token + X-Tenant-Id via OutgoingAuthMiddleware so
    every outbound call respects the request's tenant binding.
    """

    DEFAULT_URL = "http://localhost:8001"

    def __init__(self, base_url: str | None = None, timeout: float = 60.0, *, auth: BearerAuth | None = None, tenant_id: str = ""):
        self._base_url = (base_url or os.environ.get("RAG_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        # OutgoingAuthMiddleware injects Bearer + X-Tenant-Id on each call.
        if auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)
        # Keep auth/tenant on self for callers that need to switch tenants.
        self._auth = auth
        self._tenant_id = tenant_id

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    def upload(self, file_content: bytes, filename: str, document_id: str, content_type: str = "text/plain") -> dict[str, Any]:
        files = {"file": (filename, file_content, content_type)}
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/upload",
            files=files,
            params={"document_id": document_id},
        )
        r.raise_for_status()
        return r.json()

    def parse(self, document_id: str, content: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/parse",
            json={"document_id": document_id, "content": content, "metadata": metadata or {}},
        )
        r.raise_for_status()
        return r.json()

    def search(self, query: str, top_k: int = 5, mode: str = "AUTO", rerank_strategy: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"query": query, "top_k": top_k, "mode": mode}
        if rerank_strategy:
            body["rerank_strategy"] = rerank_strategy
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/search",
            json=body,
        )
        r.raise_for_status()
        return r.json()

    def stats(self) -> dict[str, Any]:
        r = self._client.get(f"{self._base_url}/api/v1/rag/stats")
        r.raise_for_status()
        return r.json()

    def status(self) -> dict[str, Any]:
        r = self._client.get(f"{self._base_url}/api/v1/rag/status")
        r.raise_for_status()
        return r.json()

    def delete_document(self, document_id: str) -> dict[str, Any]:
        """DELETE /api/v1/rag/documents/{document_id} — P1.7 cascade-delete.

        Returns the RAG DeleteDocumentResponse dict: {deleted, document_id,
        chunks_removed, graph_tuples_removed, lightrag_chunks_removed,
        pg_chunks_removed, catalog_removed, registry_removed}. Falls back to
        a no-op ``{deleted: False, document_id: <id>}`` if the upstream
        returns an unexpected shape (so callers can stay best-effort).
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


class AgentClient:
    """HTTP client for mate-tech-agent /api/v1/agent/*."""

    DEFAULT_URL = "http://localhost:8002"

    def __init__(self, base_url: str | None = None, timeout: float = 60.0, *, auth: BearerAuth | None = None, tenant_id: str = ""):
        self._base_url = (base_url or os.environ.get("AGENT_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        if auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)
        self._auth = auth
        self._tenant_id = tenant_id

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    def chat(self, message: str, scenario: str = "S1", thread_id: str | None = None) -> dict[str, Any]:
        body = {"message": message, "scenario": scenario}
        if thread_id:
            body["thread_id"] = thread_id
        r = self._client.post(f"{self._base_url}/api/v1/agent/chat", json=body)
        r.raise_for_status()
        return r.json()

    def review(self, thread_id: str, approved: bool, feedback: str = "") -> dict[str, Any]:
        r = self._client.post(
            f"{self._base_url}/api/v1/agent/review",
            json={"thread_id": thread_id, "approved": approved, "feedback": feedback},
        )
        r.raise_for_status()
        return r.json()

    def get_state(self, thread_id: str) -> dict[str, Any]:
        r = self._client.get(f"{self._base_url}/api/v1/agent/state/{thread_id}")
        r.raise_for_status()
        return r.json()

    def stream_chat(self, message: str, scenario: str = "S1", thread_id: str | None = None):
        body = {"message": message, "scenario": scenario}
        if thread_id:
            body["thread_id"] = thread_id
        with self._client.stream(
            "POST",
            f"{self._base_url}/api/v1/agent/chat/stream",
            json=body,
        ) as r:
            yield from r.iter_lines()

    def close(self) -> None:
        self._client.close()
