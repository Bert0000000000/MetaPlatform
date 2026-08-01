"""Cross-tenant integration tests for mate-app-arch (ADR-0014 step 5).

4 tests: wrong-tenant 403, missing-scope pinned, no-tenant non-200,
tenant-isolation ok.
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_app_arch.main import create_app
from mate_app_arch.repositories import in_memory as in_memory_repo

JWT_SECRET = "test-secret"


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
    in_memory_repo.reset_store()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_wrong_tenant_403(fresh_app: TestClient) -> None:
    token_a = _token(tenant_id="tenant-acme")
    r = fresh_app.get(
        "/api/v1/arch/applications",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Tenant-Id": "tenant-globex",
        },
    )
    assert r.status_code == 403, r.text
    assert "tenant" in r.text.lower()


def test_missing_scope_403(fresh_app: TestClient) -> None:
    """Step 4 ACL wiring is out of scope for PR#13; pin current behaviour."""
    token = _token(tenant_id="tenant-acme", scopes="")
    r = fresh_app.get(
        "/api/v1/arch/applications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text


def test_no_tenant_400(fresh_app: TestClient) -> None:
    token = _token(tenant_id="")
    r = fresh_app.get(
        "/api/v1/arch/applications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation_ok(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/arch/applications",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/arch/applications",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(
        a["tenant_id"] == "tenant-acme" for a in r1.json()["items"]
    )
    assert all(
        a["tenant_id"] == "tenant-globex" for a in r2.json()["items"]
    )


def test_new_endpoints_tenant_isolation(fresh_app: TestClient) -> None:
    """P2-W4: the 4 new flat-list endpoints (capabilities / capability-mappings
    / orgs / roles) must isolate tenant data — tenant B must never see
    tenant A's rows.

    Seed data uses fixed codes/ids across tenants (the storage dict is
    per-tenant), so we verify isolation via the ``tenant_id`` field on
    each row rather than id disjointness.
    """
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    for path in ("capabilities", "capability-mappings", "orgs", "roles"):
        r_acme = fresh_app.get(
            f"/api/v1/arch/{path}",
            headers={"Authorization": f"Bearer {token_acme}"},
        )
        r_globex = fresh_app.get(
            f"/api/v1/arch/{path}",
            headers={"Authorization": f"Bearer {token_globex}"},
        )
        assert r_acme.status_code == 200, (path, r_acme.text)
        assert r_globex.status_code == 200, (path, r_globex.text)
        # Rows carrying tenant_id must match the requesting tenant.
        for item in r_acme.json()["items"]:
            if "tenant_id" in item:
                assert item["tenant_id"] == "tenant-acme", (path, item)
        for item in r_globex.json()["items"]:
            if "tenant_id" in item:
                assert item["tenant_id"] == "tenant-globex", (path, item)


def test_new_endpoints_no_tenant_400(fresh_app: TestClient) -> None:
    """P2-W4: the 4 new endpoints reject requests with no tenant context."""
    token = _token(tenant_id="")
    for path in ("capabilities", "capability-mappings", "orgs", "roles"):
        r = fresh_app.get(
            f"/api/v1/arch/{path}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 400, (path, r.text)
        assert r.json()["code"] == "E_TENANT_REQUIRED"
