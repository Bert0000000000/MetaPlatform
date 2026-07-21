"""Tests for JWT authentication integration (S-LLMGW-06)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.common.errors import ErrorCode
from app.common.jwt_auth import create_token, verify_token


# Constants aligned with conftest.py
JWT_SECRET = "mate-platform-default-secret-key-must-be-over-32-bytes"
TEST_TENANT = "tenant-test"


def _make_jwt(
    *,
    tenant_id: str = TEST_TENANT,
    user_id: str = "user-test",
    username: str = "test-user",
    expires_in_seconds: int = 3600,
) -> str:
    return create_token(
        {
            "sub": user_id,
            "username": username,
            "tenantId": tenant_id,
            "roles": ["user"],
            "type": "access",
        },
        expires_in_seconds=expires_in_seconds,
    )


# -------------------------------------------------------- verify_token unit


def test_verify_token_returns_correct_claims():
    """``verify_token`` decodes a valid JWT and returns all claims."""

    token = _make_jwt(tenant_id="tenant-acme", user_id="u-123", username="alice")
    claims = verify_token(token)
    assert claims["tenantId"] == "tenant-acme"
    assert claims["sub"] == "u-123"
    assert claims["username"] == "alice"
    assert claims["type"] == "access"
    assert "exp" in claims


# ------------------------------------------------------- invalid JWT -> 401


def test_invalid_jwt_returns_401(client: TestClient, seeded_models):
    """A malformed / wrongly-signed token produces HTTP 401."""

    resp = client.get(
        "/api/v1/llmgw/models",
        headers={"Authorization": "Bearer this.is.not.valid"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["code"] == int(ErrorCode.UNAUTHORIZED)


def test_missing_jwt_returns_401(client: TestClient, seeded_models):
    """No Authorization header on a protected route → 401."""

    resp = client.get("/api/v1/llmgw/models")
    assert resp.status_code == 401
    assert resp.json()["code"] == int(ErrorCode.UNAUTHORIZED)


# ------------------------------------------------------- expired JWT -> 401


def test_expired_jwt_returns_401(client: TestClient, seeded_models):
    """An expired JWT must be rejected with 401."""

    token = _make_jwt(expires_in_seconds=-1)  # already expired
    resp = client.get(
        "/api/v1/llmgw/models",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == int(ErrorCode.UNAUTHORIZED)


# --------------------------------------------------- whitelist bypasses JWT


def test_whitelist_path_does_not_require_jwt(client: TestClient):
    """``/api/v1/llmgw/models/sync`` is whitelisted — no JWT needed."""

    # No Authorization header at all.
    resp = client.post(
        "/api/v1/llmgw/models/sync",
        json={"providers": ["OPENAI"]},
        headers={"X-Tenant-Id": TEST_TENANT},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["code"] == 0


def test_health_does_not_require_jwt(client: TestClient):
    """``/health`` and ``/api/v1/llmgw/health`` bypass JWT entirely."""

    resp = client.get("/health")
    assert resp.status_code == 200

    resp = client.get("/api/v1/llmgw/health")
    assert resp.status_code == 200


# ------------------------------------------- JWT tenantId priority > header


def test_jwt_tenant_id_takes_priority_over_header(
    client: TestClient, seeded_models
):
    """When both JWT and X-Tenant-Id are present, JWT tenantId wins."""

    # JWT says tenant-jwt, header says tenant-header.
    token = _make_jwt(tenant_id="tenant-jwt")
    resp = client.get(
        "/api/v1/llmgw/models",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": "tenant-header",
        },
    )
    assert resp.status_code == 200
    # The models list should be empty for tenant-jwt (never synced).
    items = resp.json()["data"]["items"]
    assert items == []
