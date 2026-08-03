"""Iceberg REST adapter — manages namespaces + tables in the Iceberg REST catalog.

The REST catalog (sub-chart ``iceberg`` on port ``8181``) is the
federating catalog for the ADS layer (v3.2-γ architecture §6, ADR-0017
D5). Paimon DWD tables are exposed as Iceberg tables by registering
the same physical storage under a different catalog; the Iceberg
REST API is the write path that creates namespaces and registers
tables.

REST API reference (Iceberg REST 1.4):

    POST   /v1/namespaces                         — create namespace
    GET    /v1/namespaces                         — list namespaces
    POST   /v1/namespaces/{ns}/tables             — create table
    POST   /v1/namespaces/{ns}/register            — register a table
                                                    (pointer to existing
                                                    Paimon metadata)

Configuration (all from environment variables):

    ICEBERG_REST_URL       — base URL of the Iceberg REST catalog
                              (default: ``http://iceberg:8181``)
"""
from __future__ import annotations

import os
from typing import Any

import httpx


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class IcebergRestError(Exception):
    """Raised when an Iceberg REST catalog call fails."""

    def __init__(
        self, message: str, *,
        status_code: int = 0, response_body: str = "",
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------
class IcebergRestAdapter:
    """Outbound adapter for the Iceberg REST catalog.

    Mirrors ``DebeziumEngine``'s adapter pattern: a reusable
    ``httpx.AsyncClient`` for connection pooling, ``from_env`` for
    config bootstrap, ``close()`` for lifecycle release.

    The adapter is intentionally thin — it knows the REST shape but
    not the publish workflow. The orchestrator
    (``mate_tech_data.services.ads_publisher.AdsPublisher``) drives
    the 4-step publish state machine and interprets HTTP errors
    (e.g. 409 on namespace creation is idempotent success).

    Tests inject an ``httpx.MockTransport`` via the ``client``
    constructor argument so no real HTTP traffic is generated.
    """

    def __init__(
        self,
        *,
        base_url: str = "http://iceberg:8181",
        timeout_seconds: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._client = client
        self._owns_client = client is None

    @classmethod
    def from_env(cls, *, timeout_seconds: float = 30.0) -> IcebergRestAdapter:
        """Build an adapter from environment variables."""
        return cls(
            base_url=os.environ.get(
                "ICEBERG_REST_URL", "http://iceberg:8181",
            ),
            timeout_seconds=timeout_seconds,
        )

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        return self._client

    async def close(self) -> None:
        """Close the underlying HTTP client if owned by this adapter."""
        if self._client is not None and self._owns_client:
            await self._client.aclose()
            self._client = None

    # -----------------------------------------------------------------
    # Namespace operations
    # -----------------------------------------------------------------
    async def create_namespace(
        self, namespace: tuple[str, ...],
    ) -> dict[str, Any]:
        """Create a namespace in the Iceberg REST catalog.

        POST /v1/namespaces with body ``{"namespace": ["ns1", "ns2"]}``.
        On 409 the caller is expected to treat this as idempotent
        success (the namespace already exists).
        """
        body = {"namespace": list(namespace)}
        return await self._request(
            "POST", "/v1/namespaces", json=body,
        )

    # -----------------------------------------------------------------
    # Table operations
    # -----------------------------------------------------------------
    async def create_table(
        self, namespace: str, name: str, schema: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a table in the Iceberg REST catalog.

        POST /v1/namespaces/{ns}/tables with body
        ``{"name": "...", "schema": {...}}``. The catalog stores
        the table metadata in the warehouse configured for the
        sub-chart.
        """
        body = {"name": name, "schema": schema}
        return await self._request(
            "POST", f"/v1/namespaces/{namespace}/tables", json=body,
        )

    async def register_table(
        self,
        source_table: str,
        target_namespace: str,
        target_name: str,
    ) -> dict[str, Any]:
        """Register an existing Paimon table as an Iceberg table.

        POST /v1/namespaces/{ns}/register with body
        ``{"name": "...", "metadata_location": "..."}``.
        The ``source_table`` is the fully qualified Paimon path
        (warehouse-relative) that holds the existing metadata
        files. The Iceberg catalog keeps its own pointer file so
        downstream readers (Trino, Spark, Flink) can resolve the
        table via either catalog.
        """
        body = {
            "name": target_name,
            "metadata_location": source_table,
        }
        return await self._request(
            "POST",
            f"/v1/namespaces/{target_namespace}/register",
            json=body,
        )

    # -----------------------------------------------------------------
    # Internals — HTTP without retry
    # -----------------------------------------------------------------
    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Execute a single HTTP request against the Iceberg REST catalog.

        Raises ``IcebergRestError`` on transport / HTTP / JSON parse
        failures. Callers (e.g. ``AdsPublisher``) decide whether
        specific status codes (notably 409) are terminal or
        idempotent.
        """
        client = await self._get_client()
        try:
            resp = await client.request(
                method, path, json=json, params=params,
            )
        except httpx.HTTPError as exc:
            raise IcebergRestError(
                f"Iceberg REST {method} {path} HTTP error: {exc}",
            ) from exc
        if resp.status_code >= 400:
            raise IcebergRestError(
                f"Iceberg REST {method} {path} returned {resp.status_code}: "
                f"{resp.text[:300]}",
                status_code=resp.status_code,
                response_body=resp.text[:500],
            )
        # Some REST catalog endpoints return 204 No Content on success.
        if resp.status_code == 204 or not resp.content:
            return {}
        try:
            body = resp.json()
        except ValueError as exc:
            raise IcebergRestError(
                f"Iceberg REST {method} {path} returned non-JSON body: "
                f"{resp.text[:200]}",
            ) from exc
        if isinstance(body, list):
            return {"items": body}  # type: ignore[return-value]
        return body
