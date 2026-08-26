"""Tenant-scoped ontology contract lookup for order review."""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import quote

import httpx

from .evidence import EvidenceUnavailable, OntologyContract

ONT_V2_BASE = "/api/v1/ont/v2"


class OntologyCatalogError(EvidenceUnavailable):
    """Raised when the order-review ontology contract cannot be loaded."""


class OrderReviewOntologyCatalog:
    """Fetch the canonical order-review contract from tech-ont over HTTP."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout: float = 20.0,
        client: httpx.Client | None = None,
    ) -> None:
        self._base = (base_url or os.getenv("ONT_HTTP_BASE", "http://localhost:8007")).rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.Client(base_url=self._base, timeout=timeout)

    def _headers(self, *, tenant_id: str, token: str) -> dict[str, str]:
        headers = {"X-Tenant-Id": tenant_id}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _get_json(self, *, tenant_id: str, token: str, path: str) -> dict[str, Any]:
        response = self._client.get(path, headers=self._headers(tenant_id=tenant_id, token=token))
        if response.status_code < 200 or response.status_code >= 300:
            raise OntologyCatalogError(
                f"tech-ont GET {path} -> {response.status_code}: {response.text[:300]}"
            )
        try:
            payload = response.json()
        except ValueError as error:
            raise OntologyCatalogError(f"tech-ont GET {path} did not return JSON") from error
        if not isinstance(payload, dict):
            raise OntologyCatalogError(f"tech-ont GET {path} did not return an object")
        return payload

    def _canonical_object_rid(self, tenant_id: str) -> str:
        return f"ont.{tenant_id}.obj.crm.order.v1"

    def _canonical_action_rid(self, tenant_id: str) -> str:
        return f"ont.{tenant_id}.act.order-review-confirm.v1"

    def _get_item(
        self,
        *,
        tenant_id: str,
        token: str,
        resource: str,
        rid: str,
    ) -> dict[str, Any]:
        encoded_rid = quote(rid, safe="")
        payload = self._get_json(
            tenant_id=tenant_id,
            token=token,
            path=f"{ONT_V2_BASE}/{resource}/{encoded_rid}",
        )
        if payload.get("rid") != rid:
            raise OntologyCatalogError(
                f"tech-ont {resource} RID mismatch: expected {rid}, got {payload.get('rid')}"
            )
        return payload

    def get_contract(self, *, tenant_id: str, token: str) -> OntologyContract:
        object_rid = self._canonical_object_rid(tenant_id)
        action_rid = self._canonical_action_rid(tenant_id)
        return OntologyContract(
            object_type=self._get_item(
                tenant_id=tenant_id,
                token=token,
                resource="object-types",
                rid=object_rid,
            ),
            action_type=self._get_item(
                tenant_id=tenant_id,
                token=token,
                resource="action-types",
                rid=action_rid,
            ),
        )

    def close(self) -> None:
        if self._owns_client:
            self._client.close()
