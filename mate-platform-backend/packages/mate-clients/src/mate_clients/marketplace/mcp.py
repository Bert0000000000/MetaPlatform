"""mate_clients.marketplace.mcp — MCP register client (MP-MCP-REGISTER-01).

The marketplace installer dispatches an MCP artifact install by calling
``McpMarketplaceClient.register_server(...)``, which in turn POSTs to
``mate-tech-mcp`` at ``/api/v1/mcp/federation/servers`` (the canonical
register endpoint added by MP-MCP-REGISTER-01).

The returned ``registered_digest`` is consumed by ``BaseInstaller.run``
to satisfy hard-rule #14 (registered_digest == manifest.digest).

This client uses ``BearerAuth`` + ``OutgoingAuthMiddleware`` so every
outbound request carries ``Authorization: Bearer …`` + ``X-Tenant-Id``
(13 硬规则 #4 ACL Client contract).
"""
from __future__ import annotations

import hashlib
from typing import Any

import httpx

from mate_clients.security import BearerAuth, OutgoingAuthMiddleware


class McpMarketplaceClient:
    """HTTP client that registers an MCP artifact with ``mate-tech-mcp``.

    The marketplace installer passes the artifact manifest + blob bytes;
    we compute the SHA-256 digest, attach the canonical register payload
    to ``mate-tech-mcp``, and surface ``registered_digest`` so the
    installer can verify hard-rule #14.
    """

    DEFAULT_URL = "http://localhost:8081"

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

    async def register_server(
        self,
        *,
        artifact: dict[str, Any],
        blob: bytes,
    ) -> dict[str, Any]:
        """Register the artifact with ``mate-tech-mcp`` and return a
        marketplace-install result envelope.

        The envelope contains:

          - ``server_id`` — the assigned federation server id
          - ``name`` — the artifact name
          - ``registered_digest`` — sha256 of the blob (hard-rule #14)
          - ``status`` — ``registered`` on success
        """
        url = f"{self.base_url}/api/v1/mcp/federation/servers"
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
            "server_id": body.get("server_id") or body.get("id"),
            "name": body.get("name"),
            "registered_digest": body.get("registered_digest") or digest,
            "status": body.get("status") or "registered",
        }

    async def aclose(self) -> None:
        await self._client.aclose()
