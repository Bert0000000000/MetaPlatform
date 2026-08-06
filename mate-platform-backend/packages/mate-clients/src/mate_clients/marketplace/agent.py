"""mate_clients.marketplace.agent — Agent register client (MP-AGENT-REGISTER-01).

The marketplace installer dispatches an Agent artifact install by calling
``AgentMarketplaceClient.register_agent(...)``, which POSTs to
``mate-tech-agent`` at ``/api/v1/agent/registry/agents`` (the canonical
register endpoint added by MP-AGENT-REGISTER-01).

The returned ``registered_digest`` is consumed by ``BaseInstaller.run``
to satisfy hard-rule #14 (registered_digest == manifest.digest).

Uses ``BearerAuth`` + ``OutgoingAuthMiddleware`` per 13 硬规则 #4.
"""
from __future__ import annotations

import hashlib
from typing import Any

import httpx

from mate_clients.security import BearerAuth, OutgoingAuthMiddleware


class AgentMarketplaceClient:
    """HTTP client that registers an Agent artifact with ``mate-tech-agent``."""

    DEFAULT_URL = "http://localhost:8090"

    def __init__(
        self,
        base_url: str | None = None,
        *,
        timeout: float = 30.0,
        auth: BearerAuth | None = None,
        tenant_id: str = "",
    ) -> None:
        self.base_url = (base_url or self.DEFAULT_URL).rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)
        if auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)
        self._auth = auth
        self._tenant_id = tenant_id

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    async def register_agent(
        self,
        *,
        artifact: dict[str, Any],
        blob: bytes,
    ) -> dict[str, Any]:
        """Register an Agent artifact; return the marketplace-install envelope.

        Envelope:
          - ``agent_id`` — assigned agent id (string)
          - ``name`` — artifact name
          - ``registered_digest`` — sha256 of the blob (hard-rule #14)
          - ``status`` — ``registered`` on success
        """
        url = f"{self.base_url}/api/v1/agent/registry/agents"
        digest = hashlib.sha256(blob).hexdigest()
        payload = {
            "name": artifact.get("name") or artifact.get("id"),
            "version": artifact.get("version"),
            "source": "marketplace",
            "artifact_id": artifact.get("id"),
            "digest": {"sha256": digest},
            "manifest": artifact,
            "blob_b64": blob.hex(),
        }
        r = await self._client.post(url, json=payload)
        r.raise_for_status()
        body = r.json()
        return {
            "agent_id": body.get("agent_id") or body.get("id"),
            "name": body.get("name"),
            "registered_digest": body.get("registered_digest") or digest,
            "status": body.get("status") or "registered",
        }

    async def aclose(self) -> None:
        await self._client.aclose()
