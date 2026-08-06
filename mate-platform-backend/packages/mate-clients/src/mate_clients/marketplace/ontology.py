"""mate_clients.marketplace.ontology — Ontology register client (MP-ONT-REGISTER-01).

The marketplace installer dispatches an Ontology artifact install by calling
``OntologyMarketplaceClient.register_ontology(...)``, which POSTs to
``mate-tech-ont`` at ``/api/v1/ont/v2/object-types`` (the canonical
register endpoint with operationId ``ontPostV2ObjectType`` from
v4 RUNTIME-MVP-01).

The returned ``registered_digest`` is consumed by ``BaseInstaller.run``
to satisfy hard-rule #14 (registered_digest == manifest.digest).

Uses ``BearerAuth`` + ``OutgoingAuthMiddleware`` per 13 硬规则 #4.
"""
from __future__ import annotations

import hashlib
from typing import Any

import httpx

from mate_clients.security import BearerAuth, OutgoingAuthMiddleware


class OntologyMarketplaceClient:
    """HTTP client that registers an Ontology artifact with ``mate-tech-ont``."""

    DEFAULT_URL = "http://localhost:8007"

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

    async def register_ontology(
        self,
        *,
        artifact: dict[str, Any],
        blob: bytes,
    ) -> dict[str, Any]:
        """Register an Ontology artifact; return the marketplace-install envelope.

        The artifact manifest's ObjectType payload (rid, primary_key,
        properties, display_name, interfaces) is forwarded verbatim to
        ``ontPostV2ObjectType``.

        Envelope:
          - ``rid`` — the assigned ObjectType rid
          - ``name`` — artifact name
          - ``registered_digest`` — sha256 of the blob (hard-rule #14)
          - ``status`` — ``registered`` on success
        """
        url = f"{self.base_url}/api/v1/ont/v2/object-types"
        digest = hashlib.sha256(blob).hexdigest()
        payload = {
            "rid": artifact.get("rid") or artifact.get("id"),
            "primary_key": artifact.get("primary_key") or ["id"],
            "properties": artifact.get("properties", []),
            "display_name": artifact.get("display_name") or artifact.get("name", ""),
            "interfaces": artifact.get("interfaces", []),
        }
        r = await self._client.post(url, json=payload)
        r.raise_for_status()
        body = r.json()
        return {
            "rid": body.get("rid") or payload["rid"],
            "name": body.get("display_name") or payload["display_name"],
            "registered_digest": body.get("registered_digest") or digest,
            "status": body.get("status") or "registered",
        }

    async def aclose(self) -> None:
        await self._client.aclose()
