"""Unit tests for OntologyMarketplaceClient (MP-ONT-REGISTER-01).

Verifies the canonical POST URL + ObjectTypeDTO payload + auth headers,
registered_digest envelope, set_tenant() rebinding, and dev-profile no-auth.
"""
from __future__ import annotations

import asyncio
import hashlib

import httpx
import pytest

from mate_clients.marketplace.ontology import OntologyMarketplaceClient
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
        "id": "artifact-ont-001",
        "name": "example-object-type",
        "rid": "ot.employee.1.0.0",
        "primary_key": ["employee_id"],
        "properties": [
            {"name": "employee_id", "type": "string"},
            {"name": "department", "type": "string"},
        ],
        "display_name": "Employee",
        "interfaces": [],
    }


def test_register_ontology_posts_to_canonical_endpoint(stub_auth: _StubBearerAuth) -> None:
    blob = b"ontology-artifact-bytes"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "rid": manifest["rid"],
                "display_name": manifest["display_name"],
                "registered_digest": hashlib.sha256(blob).hexdigest(),
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = OntologyMarketplaceClient(
        base_url="http://mate-tech-ont.test:8007",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    async def _go() -> dict:
        return await client.register_ontology(artifact=manifest, blob=blob)

    result = asyncio.run(_go())

    middleware = client._client.auth
    assert middleware is not None
    probe = httpx.Request("POST", "http://x.test/")
    out = next(iter(middleware.auth_flow(probe)))
    assert out.headers["Authorization"] == "Bearer test-bearer-token"
    assert out.headers["X-Tenant-Id"] == "tenant-acme"

    assert result["rid"] == manifest["rid"]
    assert result["name"] == manifest["display_name"]
    assert result["registered_digest"] == hashlib.sha256(blob).hexdigest()
    assert result["status"] == "registered"


def test_register_ontology_payload_shape(stub_auth: _StubBearerAuth) -> None:
    blob = b"shape-bytes"
    manifest = _build_manifest(blob)

    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "rid": manifest["rid"],
                "display_name": manifest["display_name"],
                "registered_digest": hashlib.sha256(blob).hexdigest(),
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = OntologyMarketplaceClient(
        base_url="http://mate-tech-ont.test:8007",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    asyncio.run(client.register_ontology(artifact=manifest, blob=blob))

    assert len(captured) == 1
    req = captured[0]
    assert req.method == "POST"
    assert str(req.url) == "http://mate-tech-ont.test:8007/api/v1/ont/v2/object-types"

    body = __import__("json").loads(req.content)
    assert body["rid"] == manifest["rid"]
    assert body["primary_key"] == ["employee_id"]
    assert body["display_name"] == "Employee"
    assert len(body["properties"]) == 2
    assert body["properties"][0]["name"] == "employee_id"


def test_register_ontology_digest_fallback(stub_auth: _StubBearerAuth) -> None:
    blob = b"fallback-blob"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"rid": manifest["rid"]},  # no registered_digest in response
        )

    transport = httpx.MockTransport(handler)
    client = OntologyMarketplaceClient(
        base_url="http://mate-tech-ont.test:8007",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    result = asyncio.run(client.register_ontology(artifact=manifest, blob=blob))
    assert result["registered_digest"] == hashlib.sha256(blob).hexdigest()


def test_set_tenant_rebinds_auth(stub_auth: _StubBearerAuth) -> None:
    client = OntologyMarketplaceClient(
        base_url="http://mate-tech-ont.test:8007",
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


def test_register_ontology_without_auth_sends_no_auth_headers() -> None:
    blob = b"dev-blob"
    manifest = _build_manifest(blob)

    def handler(request: httpx.Request) -> httpx.Response:
        assert "Authorization" not in request.headers
        assert "X-Tenant-Id" not in request.headers
        return httpx.Response(
            200,
            json={
                "rid": manifest["rid"],
                "display_name": manifest["display_name"],
                "registered_digest": hashlib.sha256(blob).hexdigest(),
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = OntologyMarketplaceClient(
        base_url="http://mate-tech-ont.test:8007",
        auth=None,
        tenant_id="",
    )
    client._client = httpx.AsyncClient(transport=transport)

    result = asyncio.run(client.register_ontology(artifact=manifest, blob=blob))
    assert result["status"] == "registered"


def test_register_ontology_default_primary_key(stub_auth: _StubBearerAuth) -> None:
    blob = b"defaults-bytes"
    manifest = {
        "id": "artifact-ont-defaults",
        "name": "DefaultedObjectType",
        "rid": "ot.default.1.0.0",
        "properties": [],
    }  # primary_key + display_name + interfaces omitted

    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "rid": manifest["rid"],
                "registered_digest": hashlib.sha256(blob).hexdigest(),
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = OntologyMarketplaceClient(
        base_url="http://mate-tech-ont.test:8007",
        auth=stub_auth,
        tenant_id="tenant-acme",
    )
    client._client = httpx.AsyncClient(
        transport=transport,
        auth=client._client.auth,
    )

    asyncio.run(client.register_ontology(artifact=manifest, blob=blob))
    body = __import__("json").loads(captured[0].content)
    assert body["primary_key"] == ["id"]
    assert body["display_name"] == "DefaultedObjectType"
    assert body["interfaces"] == []
