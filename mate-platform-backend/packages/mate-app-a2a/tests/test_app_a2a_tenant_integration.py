"""Cross-tenant integration tests for mate-app-a2a (ADR-0014 step 5).

These tests exercise the auth + tenancy contract end-to-end:

  - test_wrong_tenant_403: token binds tenant A but caller requests
    data scoped to tenant B (via X-Tenant-Id header) -> 403.
  - test_no_tenant_400: token with empty tenant_id is rejected by
    require_tenant (TenantAccessError -> 400 E_TENANT_REQUIRED).
  - test_tenant_isolation_ok: two tenants querying the same
    endpoint see disjoint catalogs.
  - test_health_anonymous_ok: the health endpoint is reachable
    without a bearer token.
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_app_a2a.main import create_app
from mate_app_a2a.repositories import in_memory as in_memory_repo

JWT_SECRET = "test-secret"  # noqa: S105


def _token(*, tenant_id: str, scopes: str = "platform.read platform.write") -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": scopes,
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def fresh_app() -> TestClient:
    """Per-test TestClient with a clean in-memory store."""
    in_memory_repo.reset_store()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_wrong_tenant_403(fresh_app: TestClient) -> None:
    token_a = _token(tenant_id="tenant-acme")
    r = fresh_app.get(
        "/api/v1/a2a/agents",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Tenant-Id": "tenant-globex",
        },
    )
    assert r.status_code == 403, r.text
    assert "tenant" in r.text.lower()


def test_no_tenant_400(fresh_app: TestClient) -> None:
    token = _token(tenant_id="")
    r = fresh_app.get(
        "/api/v1/a2a/agents",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation_ok(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/a2a/agents",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/a2a/agents",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(a["tenant_id"] == "tenant-acme" for a in r1.json()["items"])
    assert all(a["tenant_id"] == "tenant-globex" for a in r2.json()["items"])


def test_health_anonymous_ok(fresh_app: TestClient) -> None:
    r = fresh_app.get("/api/v1/a2a/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}
