"""RAG HTTP tool (calls mate-tech-rag /api/v1/rag/search)."""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from mate_platform.auth import build_service_identity

_log = logging.getLogger(__name__)


class RAGTool:
    DEFAULT_URL = "http://localhost:8001"

    def __init__(self, base_url: str | None = None, timeout: float = 30.0) -> None:
        self._base_url = (base_url or os.environ.get("RAG_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        self._service_identity = None

    def _headers(self, tenant_id: str, access_token: str = "") -> dict[str, str]:
        """Build authenticated service-to-service headers for RAG.

        Agent requests are tenant-bound before entering the graph. The RAG
        call must carry both a Keycloak client-credentials token and that
        tenant binding; an unauthenticated internal HTTP call is not a valid
        service boundary.
        """
        forwarded = access_token.strip()
        if forwarded.lower().startswith("bearer "):
            forwarded = forwarded[7:].strip()
        if forwarded:
            token = forwarded
        else:
            client_id = os.environ.get("SERVICE_CLIENT_ID", "")
            client_secret = os.environ.get("SERVICE_CLIENT_SECRET", "")
            static_token = os.environ.get("RAG_ACCESS_TOKEN", "")
            if client_id and client_secret:
                if self._service_identity is None:
                    self._service_identity = build_service_identity()
                token = self._service_identity.token()
            elif static_token:
                token = static_token
            else:
                raise RuntimeError(
                    "RAG service credentials are not configured; refusing an "
                    "unauthenticated agent-to-RAG request"
                )
        headers = {"Authorization": f"Bearer {token}"}
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id
        return headers

    def search(
        self,
        query: str,
        top_k: int = 5,
        mode: str = "AUTO",
        tenant_id: str = "",
        access_token: str = "",
    ) -> list[dict[str, Any]]:
        try:
            r = self._client.post(
                f"{self._base_url}/api/v1/rag/search",
                json={"query": query, "top_k": top_k, "mode": mode},
                headers=self._headers(tenant_id, access_token),
            )
            r.raise_for_status()
            return list(r.json().get("hits", []))
        except Exception as exc:
            _log.error("RAG search failed: %s", exc)
            raise RuntimeError("RAG search unavailable") from exc

    def close(self) -> None:
        self._client.close()


_rag_tool: RAGTool | None = None


def get_rag_tool() -> RAGTool:
    global _rag_tool
    if _rag_tool is None:
        _rag_tool = RAGTool()
    return _rag_tool


def set_rag_tool(tool: RAGTool | None) -> None:
    global _rag_tool
    _rag_tool = tool
