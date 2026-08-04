"""Tests for custom dashboard configuration write endpoints.

Covers:
  * DashboardConfigStore create / update / list + tenant isolation.
  * FastAPI endpoints: POST / GET / PUT.
  * Cross-tenant negative cases (ADR-0014 step 5).
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-obs"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

import jwt as _pyjwt  # noqa: E402

from mate_tech_obs.dashboards.store import (  # noqa: E402
    DashboardConfig,
    DashboardConfigStore,
)

_TEST_JWT_SECRET = "test-secret"


def _make_token(tenant_id: str = "tenant-acme") -> str:
    now = int(time.time())
    return _pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_token()}",
        "X-Tenant-Id": "tenant-acme",
    }


@pytest.fixture
def auth_headers_other_tenant() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_token(tenant_id='tenant-other')}",
        "X-Tenant-Id": "tenant-other",
    }


@pytest.fixture
def fresh_store() -> DashboardConfigStore:
    return DashboardConfigStore()


# ---------------------------------------------------------------------------
# Store-level tests
# ---------------------------------------------------------------------------
class TestDashboardConfigStore:
    def test_create_dashboard_config(self, fresh_store: DashboardConfigStore) -> None:
        entry = fresh_store.create_dashboard_config(
            tenant_id="t1",
            name="My Dashboard",
            config={"widgets": ["cpu", "mem"]},
        )
        assert entry.id.startswith("dash-")
        assert entry.tenant_id == "t1"
        assert entry.name == "My Dashboard"
        assert entry.config == {"widgets": ["cpu", "mem"]}
        assert entry.created_at is not None

    def test_update_dashboard_config(self, fresh_store: DashboardConfigStore) -> None:
        entry = fresh_store.create_dashboard_config(
            tenant_id="t1",
            name="Original",
            config={"widgets": []},
        )
        updated = fresh_store.update_dashboard_config(
            tenant_id="t1",
            config_id=entry.id,
            name="Renamed",
            config={"widgets": ["latency"]},
        )
        assert updated.name == "Renamed"
        assert updated.config == {"widgets": ["latency"]}
        assert updated.id == entry.id

    def test_get_dashboard_configs(self, fresh_store: DashboardConfigStore) -> None:
        fresh_store.create_dashboard_config(tenant_id="t1", name="A", config={})
        fresh_store.create_dashboard_config(tenant_id="t1", name="B", config={})
        configs = fresh_store.get_dashboard_configs(tenant_id="t1")
        assert len(configs) == 2
        assert all(c.tenant_id == "t1" for c in configs)

    def test_cross_tenant_isolation(self, fresh_store: DashboardConfigStore) -> None:
        entry = fresh_store.create_dashboard_config(
            tenant_id="t1",
            name="Private",
            config={"widgets": ["cpu"]},
        )
        # Tenant t2 cannot see t1's config.
        t2_configs = fresh_store.get_dashboard_configs(tenant_id="t2")
        assert len(t2_configs) == 0
        assert fresh_store.get_dashboard_config(tenant_id="t2", config_id=entry.id) is None

    def test_update_nonexistent_raises_keyerror(
        self, fresh_store: DashboardConfigStore
    ) -> None:
        with pytest.raises(KeyError):
            fresh_store.update_dashboard_config(
                tenant_id="t1",
                config_id="dash-does-not-exist",
                name="x",
            )

    def test_create_rejects_empty_name(self, fresh_store: DashboardConfigStore) -> None:
        with pytest.raises(ValueError, match="name required"):
            fresh_store.create_dashboard_config(
                tenant_id="t1", name="", config={}
            )


# ---------------------------------------------------------------------------
# FastAPI endpoint tests
# ---------------------------------------------------------------------------
class TestDashboardConfigEndpoints:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient

        from mate_tech_obs import main as main_mod
        from mate_tech_obs.dashboards import routes as routes_mod

        main_mod.dashboard_config_store.reset()
        routes_mod.dashboard_config_store = main_mod.dashboard_config_store

        yield TestClient(main_mod.app)

        main_mod.dashboard_config_store.reset()

    def test_create_dashboard_config(self, client, auth_headers) -> None:
        r = client.post(
            "/api/v1/admin/operations/dashboard-configs",
            json={"name": "Ops Dashboard", "config": {"widgets": ["cpu"]}},
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text
        body = r.json()["config"]
        assert body["id"].startswith("dash-")
        assert body["name"] == "Ops Dashboard"
        assert body["tenant_id"] == "tenant-acme"
        assert body["config"] == {"widgets": ["cpu"]}

    def test_update_dashboard_config(self, client, auth_headers) -> None:
        # Create first
        r = client.post(
            "/api/v1/admin/operations/dashboard-configs",
            json={"name": "Original", "config": {}},
            headers=auth_headers,
        )
        assert r.status_code == 201
        config_id = r.json()["config"]["id"]
        # Update
        r = client.put(
            f"/api/v1/admin/operations/dashboard-configs/{config_id}",
            json={"name": "Updated", "config": {"widgets": ["mem"]}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()["config"]
        assert body["name"] == "Updated"
        assert body["config"] == {"widgets": ["mem"]}

    def test_get_dashboard_configs(self, client, auth_headers) -> None:
        client.post(
            "/api/v1/admin/operations/dashboard-configs",
            json={"name": "A", "config": {}},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/admin/operations/dashboard-configs",
            json={"name": "B", "config": {}},
            headers=auth_headers,
        )
        r = client.get(
            "/api/v1/admin/operations/dashboard-configs",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["total"] == 2

    def test_cross_tenant_isolation(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        # Tenant-acme creates a config
        r = client.post(
            "/api/v1/admin/operations/dashboard-configs",
            json={"name": "Private", "config": {"widgets": ["cpu"]}},
            headers=auth_headers,
        )
        assert r.status_code == 201
        config_id = r.json()["config"]["id"]
        # Tenant-other cannot see it
        r = client.get(
            "/api/v1/admin/operations/dashboard-configs",
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 200
        assert r.json()["total"] == 0
        # Tenant-other cannot update it
        r = client.put(
            f"/api/v1/admin/operations/dashboard-configs/{config_id}",
            json={"name": "Hacked"},
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404

    def test_update_nonexistent_returns_404(self, client, auth_headers) -> None:
        r = client.put(
            "/api/v1/admin/operations/dashboard-configs/dash-does-not-exist",
            json={"name": "x"},
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_create_rejects_missing_name(self, client, auth_headers) -> None:
        r = client.post(
            "/api/v1/admin/operations/dashboard-configs",
            json={"config": {}},
            headers=auth_headers,
        )
        assert r.status_code == 400
