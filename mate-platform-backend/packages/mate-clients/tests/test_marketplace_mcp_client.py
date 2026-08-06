"""Unit tests for McpMarketplaceClient (MP-MCP-REGISTER-01).

Verifies:
  1. POST /api/v1/mcp/federation/servers with BearerAuth + X-Tenant-Id.
  2. registered_digest returned in envelope matches sha256(blob).
  3. set_tenant() rebinds the auth middleware (13 硬规则 #4).
  4. Without auth/tenant_id, no outgoing auth (dev profile only — caller
     responsibility).
"""
from __future__ import annotations

import asyncio
import hashlib

import httpx
import pytest

from mate_clients.marketplace.mcp import McpMarketplaceClient
from mate_clients.security import BearerAuth


class _StubBearerAuth(BearerAuth):
    """BearerAuth subclass that skips real OAuth — we don't want a
    network round-trip in unit tests. The auth flow is exercised
    in test_sec_iam_01; here we just need the headers.

    OutgoingAuthMiddleware calls ``.token()`` and sets
    ``Authorization: Bearer <token>``, so we expose a token() method.
    """

    def __init__(self, token: str = "test-bearer-token") -> None:  # noqa: S107
        # Skip parent __init__ entirely.
        self._token = token

    def token(self) -> str:  # type: ignore[override]
        return self._token


@pytest.fixture
def stub_auth() -> _StubBearerAuth:
    return _StubBearerAuth(token="test-bearer-token")  # noqa: S106


def _build_manifest(blob: bytes) -> dict:
    return {
        "id": "artifact-mcp-001",
        "name": "example-mcp-server",
        "version": "1.2.3",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }


def test_register_server_posts_to_canonical_endpoint(stub_auth: _StubBearerAuth) -> None:
    blob = b"hello-mcp-artifact"
    manifest = _build_manifest(blob)

    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "server_id": "srv-xyz",
                "name": manifest["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = McpMarketplaceClient(
        base_url="http://mate-tech-mcp.test:8081",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    # Override the transport but keep the auth middleware bound in __init__.
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    async def _go() -> dict:
        return await client.register_server(artifact=manifest, blob=blob)

    result = asyncio.run(_go())

    # httpx MockTransport bypasses the auth pipeline. Verify the URL
    # and payload directly, then verify the auth middleware independently
    # (test_set_tenant_rebinds_auth + this client-side assertions).
    assert len(captured) == 1
    req = captured[0]
    assert req.method == "POST"
    assert str(req.url) == "http://mate-tech-mcp.test:8081/api/v1/mcp/federation/servers"

    body = __import__("json").loads(req.content)
    assert body["name"] == "example-mcp-server"
    assert body["version"] == "1.2.3"
    assert body["source"] == "marketplace"
    assert body["artifact_id"] == "artifact-mcp-001"
    assert body["digest"]["sha256"] == manifest["digest"]["sha256"]

    # Verify the auth middleware bound to the client carries the right
    # bearer + tenant — this is the contract 13 硬规则 #4 cares about.
    middleware = client._client.auth
    assert middleware is not None
    probe = httpx.Request("POST", "http://x.test/")
    out = next(iter(middleware.auth_flow(probe)))
    assert out.headers["Authorization"] == "Bearer test-bearer-token"
    assert out.headers["X-Tenant-Id"] == "tenant-acme"

    assert result["server_id"] == "srv-xyz"
    assert result["registered_digest"] == manifest["digest"]["sha256"]
    assert result["status"] == "registered"


def test_register_server_digest_fallback_when_backend_omits_field(
    stub_auth: _StubBearerAuth,
) -> None:
    """If the upstream returns no registered_digest, we fall back to the
    local sha256 of the blob. This keeps hard-rule #14 callable when
    the upstream is minimal.
    """
    blob = b"another-blob"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "server_id": "srv-fallback",
                "name": manifest["name"],
                # No registered_digest field.
            },
        )

    transport = httpx.MockTransport(handler)
    client = McpMarketplaceClient(
        base_url="http://mate-tech-mcp.test:8081",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    # Override the transport but keep the auth middleware bound in __init__.
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    result = asyncio.run(client.register_server(artifact=manifest, blob=blob))

    assert result["registered_digest"] == manifest["digest"]["sha256"]


def test_set_tenant_rebinds_auth(stub_auth: _StubBearerAuth) -> None:
    client = McpMarketplaceClient(
        base_url="http://mate-tech-mcp.test:8081",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client.set_tenant("tenant-globex")

    # The real assertion is that the middleware is rebound; verify by
    # running it through the httpx auth_flow protocol.
    req = httpx.Request("POST", "http://x.test/")
    middleware = client._client.auth
    assert middleware is not None
    out = next(iter(middleware.auth_flow(req)))
    assert out.headers["X-Tenant-Id"] == "tenant-globex"
    assert out.headers["Authorization"] == "Bearer test-bearer-token"


def test_register_server_without_auth_sends_no_auth_headers() -> None:
    """Dev profile may construct the client without auth — explicit dev
    call site only. No Authorization header is sent, and the server
    side is responsible for the dev-profile bypass.
    """
    blob = b"dev-blob"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        assert "Authorization" not in request.headers
        assert "X-Tenant-Id" not in request.headers
        return httpx.Response(
            200,
            json={
                "server_id": "srv-dev",
                "name": manifest["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = McpMarketplaceClient(
        base_url="http://mate-tech-mcp.test:8081",
        auth=None,
        tenant_id="",
    )
    client._client = httpx.AsyncClient(transport=transport)

    result = asyncio.run(client.register_server(artifact=manifest, blob=blob))
    assert result["status"] == "registered"
