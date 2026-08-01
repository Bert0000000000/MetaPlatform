"""Cross-tenant integration tests for mate-tech-data (ADR-0014 step 5).

These tests exercise the auth + tenancy contract end-to-end:

  - test_wrong_tenant_403: token binds tenant A but caller requests
    data scoped to tenant B (via X-Tenant-Id header) -> 403.
  - test_no_tenant_400: token with empty tenant_id is rejected by
    require_tenant (TenantAccessError -> 400 E_TENANT_REQUIRED).
  - test_tenant_isolation_cdc_tasks: two tenants querying the same
    endpoint see disjoint CDC task catalogs.
  - test_tenant_isolation_sources: two tenants querying the same
    endpoint see disjoint data source catalogs.
  - test_cross_tenant_cdc_task_404: tenant A's task is invisible to
    tenant B (404).
  - test_cross_tenant_source_404: tenant A's source is invisible to
    tenant B (404).
  - test_health_anonymous_ok: the health endpoint is reachable
    without a bearer token.
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_tech_data.main import create_app
from mate_tech_data.repositories import in_memory as in_memory_repo

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
        "/api/v1/data/cdc-tasks",
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
        "/api/v1/data/cdc-tasks",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation_cdc_tasks(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/data/cdc-tasks",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/data/cdc-tasks",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(t["tenant_id"] == "tenant-acme" for t in r1.json()["items"])
    assert all(t["tenant_id"] == "tenant-globex" for t in r2.json()["items"])
    # Disjoint catalogs: acme ids != globex ids (same seed ids but
    # scoped to different tenants, so a globex caller must not see
    # acme-created entries — verified via the tenant_id field above).


def test_tenant_isolation_sources(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/data/sources",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/data/sources",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(s["tenant_id"] == "tenant-acme" for s in r1.json()["items"])
    assert all(s["tenant_id"] == "tenant-globex" for s in r2.json()["items"])


def test_cross_tenant_cdc_task_404(fresh_app: TestClient) -> None:
    # tenant-acme creates a CDC task.
    token_acme = _token(tenant_id="tenant-acme")
    create = fresh_app.post(
        "/api/v1/data/cdc-tasks",
        json={
            "name": "Acme Only Sync",
            "source_id": "src-mysql-orders",
            "target_table": "ods_acme_only",
        },
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert create.status_code == 200, create.text
    task_id = create.json()["id"]

    # tenant-globex cannot see it -> 404.
    token_globex = _token(tenant_id="tenant-globex")
    r = fresh_app.get(
        f"/api/v1/data/cdc-tasks/{task_id}",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r.status_code == 404, r.text


def test_cross_tenant_source_404(fresh_app: TestClient) -> None:
    # tenant-acme creates a data source.
    token_acme = _token(tenant_id="tenant-acme")
    create = fresh_app.post(
        "/api/v1/data/sources",
        json={"name": "Acme Only Mongo", "type": "mongodb"},
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert create.status_code == 200, create.text
    source_id = create.json()["id"]

    # tenant-globex cannot see it -> 404.
    token_globex = _token(tenant_id="tenant-globex")
    r = fresh_app.get(
        f"/api/v1/data/sources/{source_id}",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r.status_code == 404, r.text

    # And cannot delete it either.
    r2 = fresh_app.delete(
        f"/api/v1/data/sources/{source_id}",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r2.status_code == 404, r2.text


def test_health_anonymous_ok(fresh_app: TestClient) -> None:
    r = fresh_app.get("/api/v1/data/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}
