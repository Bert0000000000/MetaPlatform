"""Cross-tenant integration tests for mate-tech-etl (ADR-0014 step 5).

Tests:
  - test_wrong_tenant_403: token binds tenant A but X-Tenant-Id asks
    for tenant B -> 403.
  - test_no_tenant_400: empty tenant_id in token -> 400 E_TENANT_REQUIRED.
  - test_tenant_isolation: two tenants see disjoint ETL task catalogs.
  - test_cross_tenant_404: tenant A's task is invisible to tenant B.
  - test_cross_tenant_delete_404: tenant B cannot delete tenant A's task.
  - test_health_anonymous_ok: health is reachable without a bearer token.
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_tech_etl.main import create_app
from mate_tech_etl.repositories import in_memory as in_memory_repo

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
    """Per-test TestClient with a clean in-memory store."""
    in_memory_repo.reset_store()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_wrong_tenant_403(fresh_app: TestClient) -> None:
    token_a = _token(tenant_id="tenant-acme")
    r = fresh_app.get(
        "/api/v1/etl/tasks",
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
        "/api/v1/etl/tasks",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/etl/tasks",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/etl/tasks",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(t["tenant_id"] == "tenant-acme" for t in r1.json()["items"])
    assert all(t["tenant_id"] == "tenant-globex" for t in r2.json()["items"])


def test_cross_tenant_404(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    create = fresh_app.post(
        "/api/v1/etl/tasks",
        json={
            "name": "Acme Only ETL",
            "source_table": "ods_acme",
            "target_table": "dwd_acme",
        },
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert create.status_code == 200, create.text
    task_id = create.json()["id"]

    token_globex = _token(tenant_id="tenant-globex")
    r = fresh_app.get(
        f"/api/v1/etl/tasks/{task_id}",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r.status_code == 404, r.text


def test_cross_tenant_delete_404(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    create = fresh_app.post(
        "/api/v1/etl/tasks",
        json={
            "name": "Acme Protected",
            "source_table": "ods_x",
            "target_table": "dwd_x",
        },
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert create.status_code == 200, create.text
    task_id = create.json()["id"]

    token_globex = _token(tenant_id="tenant-globex")
    r = fresh_app.delete(
        f"/api/v1/etl/tasks/{task_id}",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r.status_code == 404, r.text


def test_health_anonymous_ok(fresh_app: TestClient) -> None:
    r = fresh_app.get("/api/v1/etl/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}
