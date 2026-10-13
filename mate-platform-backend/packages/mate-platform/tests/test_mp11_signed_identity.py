"""RSA-signed HTTP identity regression; fixture never represents token/key values."""

import json
import time
from typing import Literal, Protocol

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from mate_platform.auth.config import AuthConfig
from mate_platform.auth.middleware import install_auth


class SignedIdentityClient(Protocol):
    def get(
        self, extra: dict[str, object], headers: dict[str, str] | None = None
    ) -> httpx.Response: ...


@pytest.fixture
def signed_client(monkeypatch: pytest.MonkeyPatch) -> SignedIdentityClient:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cfg = AuthConfig(
        "https://issuer.invalid",
        "mp11",
        "backend",
        "backend",
        "fixture-only",
        300,
        5,
        0,
        False,
        False,
    )
    app = FastAPI()
    jwk: dict[str, object] = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update({"kid": "mp11-test", "alg": "RS256", "use": "sig"})
    actual_client = httpx.Client

    def jwks_handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == cfg.jwks_uri
        return httpx.Response(200, json={"keys": [jwk]})

    def jwks_client(*, timeout: float | httpx.Timeout | None = 5.0) -> httpx.Client:
        return actual_client(timeout=timeout, transport=httpx.MockTransport(jwks_handler))

    monkeypatch.setattr(httpx, "Client", jwks_client)
    install_auth(app, config=cfg)

    def identity(request: Request) -> dict[str, object]:
        ctx = request.state.ctx
        return {
            "method": ctx.auth_method.value,
            "tenant": str(ctx.tenant_id),
            "scopes": sorted(ctx.scopes),
        }

    app.add_api_route("/identity", identity, methods=["GET"])

    class SignedClient:
        def __repr__(self) -> str:
            return "<SignedIdentityClient>"

        def get(
            self, extra: dict[str, object], headers: dict[str, str] | None = None
        ) -> httpx.Response:
            now = int(time.time())
            claims: dict[str, object] = {
                "iss": cfg.issuer,
                "aud": cfg.audience,
                "sub": "user-1",
                "azp": "web",
                "tenant_id": "tenant-a",
                "iat": now,
                "exp": now + 60,
                "scope": "platform.read ont.read",
            }
            claims.update(extra)
            if "tenant_id" not in extra and ("attributes" in extra or "tenant" in extra):
                claims.pop("tenant_id")
            signing_key = (
                rsa.generate_private_key(public_exponent=65537, key_size=2048)
                if extra.get("forged_signature")
                else key
            )
            token = jwt.encode(claims, signing_key, algorithm="RS256", headers={"kid": "mp11-test"})
            with TestClient(app) as client:
                return client.get(
                    "/identity", headers={"Authorization": "Bearer " + token, **(headers or {})}
                )

    return SignedClient()


@pytest.mark.parametrize(
    "metadata,expected",
    [
        ({"preferred_username": "writer", "sid": "human-session"}, "user"),
        ({"preferred_username": "readonly", "session_state": "legacy-session"}, "user"),
        ({"preferred_username": "service-account-worker"}, "service"),
        ({"preferred_username": "service-account-worker", "sid": "service-session"}, "service"),
        ({"preferred_username": "writer"}, "service"),
        ({"sid": "session"}, "service"),
        ({"azp": ""}, "service"),
        (
            {"preferred_username": "renamed-worker", "sid": "session", "client_id": "worker"},
            "service",
        ),
        ({"preferred_username": ["writer"], "sid": "session"}, "service"),
        ({"sub": "", "preferred_username": "writer", "sid": "session"}, "service"),
    ],
)
def test_signed_identity_requires_human_session(
    signed_client: SignedIdentityClient,
    metadata: dict[str, object],
    expected: Literal["user", "service"],
) -> None:
    response = signed_client.get(metadata)
    assert response.status_code == 200
    assert response.json()["method"] == expected


def test_headers_cannot_supply_human_identity_or_tenant(
    signed_client: SignedIdentityClient,
) -> None:
    response = signed_client.get({}, {"preferred_username": "writer", "sid": "session"})
    assert response.json()["method"] == "service"
    assert signed_client.get({}, {"X-Tenant-ID": "tenant-b"}).status_code == 403


def test_expired_signed_identity_is_rejected(signed_client: SignedIdentityClient) -> None:
    assert signed_client.get({"exp": int(time.time()) - 1}).status_code == 401


@pytest.mark.parametrize(
    "value", [None, {}, [], [None], [{}], "   ", [""], ["   "], ["valid", None], 42]
)
@pytest.mark.parametrize("location", ["top", "attributes", "fallback"])
def test_malformed_signed_tenant_fails_closed(
    signed_client: SignedIdentityClient,
    location: Literal["top", "attributes", "fallback"],
    value: object,
) -> None:
    metadata = (
        {
            "tenant_id": value,
            "attributes": {"tenant_id": "safe-fallback"},
            "tenant": "safe-fallback",
        }
        if location == "top"
        else {"attributes": {"tenant_id": value}, "tenant": "safe-fallback"}
        if location == "attributes"
        else {"tenant": value}
    )
    response = signed_client.get(metadata)
    assert response.status_code == 401


@pytest.mark.parametrize(
    "metadata",
    [
        {"tenant_id": "tenant-a"},
        {"tenant_id": ["tenant-a", "second-tenant"]},
        {"attributes": {"tenant_id": "tenant-a"}},
        {"attributes": {"tenant_id": ["tenant-a", "second-tenant"]}},
        {"tenant": "tenant-a"},
        {"attributes": {}, "tenant": "tenant-a"},
    ],
)
def test_supported_signed_tenant_shapes(
    signed_client: SignedIdentityClient, metadata: dict[str, object]
) -> None:
    response = signed_client.get(metadata)
    assert response.status_code == 200
    assert response.json()["tenant"] == "tenant-a"


@pytest.mark.parametrize(
    "metadata",
    [
        {"attributes": None, "tenant": "safe-fallback"},
        {"attributes": [], "tenant": "safe-fallback"},
        {"attributes": "invalid", "tenant": "safe-fallback"},
        {"attributes": 42, "tenant": "safe-fallback"},
        {"aud": "wrong-audience"},
        {"forged_signature": True},
    ],
)
def test_signed_tenant_identity_guards(
    signed_client: SignedIdentityClient, metadata: dict[str, object]
) -> None:
    response = signed_client.get(metadata)
    assert response.status_code == 401


@pytest.mark.parametrize(
    "metadata",
    [
        {"tenant_id": "tenant-a", "attributes": {"tenant_id": None}, "tenant": "wrong"},
        {"attributes": {"tenant_id": "tenant-a"}, "tenant": None},
    ],
)
def test_valid_authoritative_signed_tenant_precedence(
    signed_client: SignedIdentityClient, metadata: dict[str, object]
) -> None:
    response = signed_client.get(metadata)
    assert response.status_code == 200
    assert response.json()["tenant"] == "tenant-a"
