"""Unit tests for AgentMarketplaceClient (MP-AGENT-REGISTER-01).

Verifies the canonical POST URL + payload + auth headers, registered_digest
envelope, set_tenant() rebinding, and dev-profile no-auth path.
"""
from __future__ import annotations

import asyncio
import hashlib

import httpx
import pytest

from mate_clients.marketplace.agent import AgentMarketplaceClient
from mate_clients.security import BearerAuth


class _StubBearerAuth(BearerAuth):
    def __init__(self, token: str = "test-bearer-token") -> None:  # noqa: S107
        self._token = token

    def token(self) -> str:  # type: ignore[override]
        return self._token


@pytest.fixture
def stub_auth() -> _StubBearerAuth:
    return _StubBearerAuth(token="test-bearer-token")  # noqa: S106


def _build_manifest(blob: bytes) -> dict:
    return {
        "id": "artifact-agent-001",
        "name": "example-agent",
        "version": "1.0.0",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }


def test_register_agent_posts_to_canonical_endpoint(stub_auth: _StubBearerAuth) -> None:
    blob = b"agent-artifact-bytes"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "agent_id": "agt-001",
                "name": manifest["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = AgentMarketplaceClient(
        base_url="http://mate-tech-agent.test:8090",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    async def _go() -> dict:
        return await client.register_agent(artifact=manifest, blob=blob)

    result = asyncio.run(_go())

    middleware = client._client.auth
    assert middleware is not None
    probe = httpx.Request("POST", "http://x.test/")
    out = next(iter(middleware.auth_flow(probe)))
    assert out.headers["Authorization"] == "Bearer test-bearer-token"
    assert out.headers["X-Tenant-Id"] == "tenant-acme"

    assert result["agent_id"] == "agt-001"
    assert result["registered_digest"] == manifest["digest"]["sha256"]
    assert result["status"] == "registered"


def test_register_agent_payload_shape(stub_auth: _StubBearerAuth) -> None:
    blob = b"shape-bytes"
    manifest = _build_manifest(blob)

    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "agent_id": "agt-002",
                "name": manifest["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = AgentMarketplaceClient(
        base_url="http://mate-tech-agent.test:8090",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    asyncio.run(client.register_agent(artifact=manifest, blob=blob))

    assert len(captured) == 1
    req = captured[0]
    assert req.method == "POST"
    assert str(req.url) == "http://mate-tech-agent.test:8090/api/v1/agent/registry/agents"

    body = __import__("json").loads(req.content)
    assert body["name"] == "example-agent"
    assert body["version"] == "1.0.0"
    assert body["source"] == "marketplace"
    assert body["artifact_id"] == "artifact-agent-001"
    assert body["digest"]["sha256"] == manifest["digest"]["sha256"]


def test_register_agent_digest_fallback(stub_auth: _StubBearerAuth) -> None:
    blob = b"fallback-blob"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"agent_id": "agt-fb", "name": manifest["name"]},  # no registered_digest
        )

    transport = httpx.MockTransport(handler)
    client = AgentMarketplaceClient(
        base_url="http://mate-tech-agent.test:8090",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    result = asyncio.run(client.register_agent(artifact=manifest, blob=blob))
    assert result["registered_digest"] == manifest["digest"]["sha256"]


def test_set_tenant_rebinds_auth(stub_auth: _StubBearerAuth) -> None:
    client = AgentMarketplaceClient(
        base_url="http://mate-tech-agent.test:8090",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client.set_tenant("tenant-globex")

    middleware = client._client.auth
    assert middleware is not None
    req = httpx.Request("POST", "http://x.test/")
    out = next(iter(middleware.auth_flow(req)))
    assert out.headers["X-Tenant-Id"] == "tenant-globex"
    assert out.headers["Authorization"] == "Bearer test-bearer-token"


def test_register_agent_without_auth_sends_no_auth_headers() -> None:
    blob = b"dev-blob"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        assert "Authorization" not in request.headers
        assert "X-Tenant-Id" not in request.headers
        return httpx.Response(
            200,
            json={
                "agent_id": "agt-dev",
                "name": manifest["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = AgentMarketplaceClient(
        base_url="http://mate-tech-agent.test:8090",
        auth=None,
        tenant_id="",
    )
    client._client = httpx.AsyncClient(transport=transport)

    result = asyncio.run(client.register_agent(artifact=manifest, blob=blob))
    assert result["status"] == "registered"
