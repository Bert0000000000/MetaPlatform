"""Tests for the obs Alertmanager alert-rule management extension (backlog §3.7).

Covers:
  * AlertRuleStore CRUD + tenant isolation + system-rule immutability.
  * Outbox emission (InMemoryOutboxWriter).
  * FastAPI endpoints: create / list-managed / get / update / delete.
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

from mate_platform.messaging import InMemoryOutboxWriter  # noqa: E402

from mate_tech_obs.alerts.management import (  # noqa: E402
    AlertRuleStore,
    ManagedAlertRule,
    emit_rule_event,
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
def fresh_store() -> AlertRuleStore:
    return AlertRuleStore()


# ---------------------------------------------------------------------------
# Store CRUD + tenant isolation
# ---------------------------------------------------------------------------
class TestAlertRuleStoreCRUD:
    def test_seed_system_rules_on_first_access(self, fresh_store: AlertRuleStore) -> None:
        rules = fresh_store.list_rules(tenant_id="t1")
        # 10 system rules seeded lazily.
        assert len(rules) == 10
        assert all(r.system for r in rules)
        assert all(r.tenant_id == "t1" for r in rules)

    def test_create_custom_rule(self, fresh_store: AlertRuleStore) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="CustomHighCpu",
            expr="cpu_usage > 0.9",
            for_duration="5m",
            severity="warning",
            description="CPU usage > 90%",
            annotations={"summary": "CPU high"},
        )
        assert rule.id.startswith("rule-")
        assert rule.tenant_id == "t1"
        assert rule.system is False
        assert rule.status == "active"
        fetched = fresh_store.get_rule(tenant_id="t1", rule_id=rule.id)
        assert fetched is rule

    def test_create_rejects_invalid_severity(self, fresh_store: AlertRuleStore) -> None:
        with pytest.raises(ValueError, match="severity must be one of"):
            fresh_store.create_rule(
                tenant_id="t1",
                alert="Bad",
                expr="x > 0",
                for_duration="1m",
                severity="bad",
                description="d",
            )

    def test_create_rejects_duplicate_alert_name(self, fresh_store: AlertRuleStore) -> None:
        fresh_store.create_rule(
            tenant_id="t1",
            alert="Dupe",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        with pytest.raises(ValueError, match="already exists"):
            fresh_store.create_rule(
                tenant_id="t1",
                alert="Dupe",
                expr="x > 1",
                for_duration="1m",
                severity="warning",
                description="d2",
            )

    def test_update_custom_rule(self, fresh_store: AlertRuleStore) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="Updatable",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        updated = fresh_store.update_rule(
            tenant_id="t1",
            rule_id=rule.id,
            severity="critical",
            description="updated desc",
            status="paused",
        )
        assert updated.severity == "critical"
        assert updated.description == "updated desc"
        assert updated.status == "paused"
        assert updated.updated_at >= rule.updated_at

    def test_update_rejects_system_rule(self, fresh_store: AlertRuleStore) -> None:
        rules = fresh_store.list_rules(tenant_id="t1")
        system_rule = next(r for r in rules if r.system)
        with pytest.raises(PermissionError, match="immutable"):
            fresh_store.update_rule(
                tenant_id="t1",
                rule_id=system_rule.id,
                severity="info",
            )

    def test_delete_custom_rule_soft_deletes(self, fresh_store: AlertRuleStore) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="Deletable",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        assert fresh_store.delete_rule(tenant_id="t1", rule_id=rule.id) is True
        deleted = fresh_store.get_rule(tenant_id="t1", rule_id=rule.id)
        assert deleted is not None
        assert deleted.status == "deleted"

    def test_delete_rejects_system_rule(self, fresh_store: AlertRuleStore) -> None:
        rules = fresh_store.list_rules(tenant_id="t1")
        system_rule = next(r for r in rules if r.system)
        with pytest.raises(PermissionError, match="immutable"):
            fresh_store.delete_rule(tenant_id="t1", rule_id=system_rule.id)


class TestAlertRuleStoreTenantIsolation:
    def test_cross_tenant_get_returns_none(self, fresh_store: AlertRuleStore) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="PrivateRule",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        # Tenant t2 cannot read t1's custom rule.
        assert fresh_store.get_rule(tenant_id="t2", rule_id=rule.id) is None
        # But t2 still sees its own seeded system rules (not t1's custom rule).
        t2_rules = fresh_store.list_rules(tenant_id="t2")
        assert len(t2_rules) == 10
        assert all(r.system for r in t2_rules)

    def test_cross_tenant_delete_returns_false(self, fresh_store: AlertRuleStore) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="PrivateRule",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        assert fresh_store.delete_rule(tenant_id="t2", rule_id=rule.id) is False
        # t1's rule is still there.
        assert fresh_store.get_rule(tenant_id="t1", rule_id=rule.id) is not None

    def test_cross_tenant_update_raises_keyerror(
        self, fresh_store: AlertRuleStore
    ) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="PrivateRule",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        with pytest.raises(KeyError):
            fresh_store.update_rule(
                tenant_id="t2",
                rule_id=rule.id,
                severity="critical",
            )


# ---------------------------------------------------------------------------
# Outbox emission
# ---------------------------------------------------------------------------
class TestOutboxEmission:
    def test_emit_rule_event_appends_to_outbox(self) -> None:
        outbox = InMemoryOutboxWriter()
        rule = ManagedAlertRule(
            id="rule-1",
            tenant_id="t1",
            alert="TestAlert",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
            annotations={},
        )
        emit_rule_event(outbox, action="created", rule=rule)
        records = outbox.all_records()
        assert len(records) == 1
        event = records[0].event
        assert event.type == "obs.alert_rule.created"
        assert event.tenant_id == "t1"
        assert event.aggregate_id == "rule-1"
        assert event.payload["alert"] == "TestAlert"

    def test_emit_rule_event_none_outbox_is_noop(self) -> None:
        rule = ManagedAlertRule(
            id="rule-1",
            tenant_id="t1",
            alert="TestAlert",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
            annotations={},
        )
        # No exception when outbox is None (test profile).
        emit_rule_event(None, action="created", rule=rule)

    def test_emit_rule_event_rejects_empty_tenant(self) -> None:
        outbox = InMemoryOutboxWriter()
        rule = ManagedAlertRule(
            id="rule-1",
            tenant_id="",  # empty tenant — must be rejected by Event.create
            alert="TestAlert",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
            annotations={},
        )
        with pytest.raises(ValueError, match="tenant_id must not be empty"):
            emit_rule_event(outbox, action="created", rule=rule)


# ---------------------------------------------------------------------------
# FastAPI endpoints
# ---------------------------------------------------------------------------
class TestAlertRuleEndpoints:
    @pytest.fixture
    def client(self):
        """Build a TestClient backed by the real main.app.

        ``install_auth`` is wired in main.py with
        ``INSECURE_SKIP_SIGNATURE=1`` (set in conftest), so a valid
        Keycloak-format JWT in ``Authorization`` populates
        ``request.state.ctx``. We reset the shared alert_rule_store
        before each test for isolation.
        """
        from fastapi.testclient import TestClient

        from mate_tech_obs import main as main_mod
        from mate_tech_obs.admin import alert_rule_routes as routes_mod

        # Both modules share the same AlertRuleStore instance
        # (main.py calls _set_store at import time); reset it.
        main_mod.alert_rule_store.reset()
        # Defensive: in case the routes module's store drifted.
        routes_mod.alert_rule_store = main_mod.alert_rule_store

        yield TestClient(main_mod.app)

        # Clean up after the test.
        main_mod.alert_rule_store.reset()

    def _create_rule(
        self,
        client,
        auth_headers: dict[str, str],
        *,
        alert: str = "CustomAlert",
        severity: str = "warning",
    ) -> dict[str, Any]:
        r = client.post(
            "/api/v1/admin/operations/alerts/rules",
            json={
                "alert": alert,
                "expr": "rate(http_requests_total[5m]) > 100",
                "for_duration": "5m",
                "severity": severity,
                "description": "custom alert",
                "annotations": {"summary": "custom"},
            },
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text
        return r.json()["rule"]

    def test_create_rule_endpoint(self, client, auth_headers) -> None:
        rule = self._create_rule(client, auth_headers)
        assert rule["id"].startswith("rule-")
        assert rule["alert"] == "CustomAlert"
        assert rule["system"] is False
        assert rule["status"] == "active"
        assert rule["tenant_id"] == "tenant-acme"

    def test_create_rejects_invalid_severity(self, client, auth_headers) -> None:
        r = client.post(
            "/api/v1/admin/operations/alerts/rules",
            json={
                "alert": "Bad",
                "expr": "x > 0",
                "for_duration": "1m",
                "severity": "bad",
                "description": "d",
            },
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_list_managed_includes_system_and_custom(
        self, client, auth_headers
    ) -> None:
        # Initially: 10 system rules.
        r = client.get(
            "/api/v1/admin/operations/alerts/rules/managed",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["total"] == 10
        # Add a custom rule.
        self._create_rule(client, auth_headers, alert="Custom1")
        r = client.get(
            "/api/v1/admin/operations/alerts/rules/managed",
            headers=auth_headers,
        )
        assert r.json()["total"] == 11
        # Filter to custom only.
        r = client.get(
            "/api/v1/admin/operations/alerts/rules/managed",
            params={"include_system": "false"},
            headers=auth_headers,
        )
        assert r.json()["total"] == 1
        assert r.json()["items"][0]["alert"] == "Custom1"

    def test_get_rule_endpoint(self, client, auth_headers) -> None:
        rule = self._create_rule(client, auth_headers)
        r = client.get(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["rule"]["id"] == rule["id"]

    def test_get_returns_404_for_unknown(self, client, auth_headers) -> None:
        r = client.get(
            "/api/v1/admin/operations/alerts/rules/rule-does-not-exist",
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_update_rule_endpoint(self, client, auth_headers) -> None:
        rule = self._create_rule(client, auth_headers)
        r = client.put(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            json={"severity": "critical", "status": "paused"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()["rule"]
        assert body["severity"] == "critical"
        assert body["status"] == "paused"

    def test_update_system_rule_returns_403(self, client, auth_headers) -> None:
        # system-01 is the first seeded system rule.
        r = client.put(
            "/api/v1/admin/operations/alerts/rules/system-01",
            json={"severity": "info"},
            headers=auth_headers,
        )
        assert r.status_code == 403

    def test_delete_rule_endpoint(self, client, auth_headers) -> None:
        rule = self._create_rule(client, auth_headers)
        r = client.delete(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            headers=auth_headers,
        )
        assert r.status_code == 200
        # Subsequent get returns the row with status=deleted.
        r2 = client.get(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["rule"]["status"] == "deleted"

    def test_delete_system_rule_returns_403(self, client, auth_headers) -> None:
        r = client.delete(
            "/api/v1/admin/operations/alerts/rules/system-01",
            headers=auth_headers,
        )
        assert r.status_code == 403

    def test_cross_tenant_get_returns_404(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        rule = self._create_rule(client, auth_headers)
        # Other tenant cannot read.
        r = client.get(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404

    def test_cross_tenant_update_returns_404(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        rule = self._create_rule(client, auth_headers)
        r = client.put(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            json={"severity": "critical"},
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404

    def test_cross_tenant_delete_returns_404(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        rule = self._create_rule(client, auth_headers)
        r = client.delete(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404
        # Original tenant can still see it.
        r2 = client.get(
            f"/api/v1/admin/operations/alerts/rules/{rule['id']}",
            headers=auth_headers,
        )
        assert r2.status_code == 200


# ---------------------------------------------------------------------------
# ADR-0014 step 5: cross-tenant negative tests (3 minimum)
# ---------------------------------------------------------------------------
class TestCrossTenantNegatives:
    def test_require_tenant_rejects_empty_tenant(self) -> None:
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantAccessError,
            TenantId,
            UserId,
            require_tenant,
        )

        ctx = RequestContext(
            request_id="r1",
            trace_id="t1",
            tenant_id=TenantId(""),
            user_id=UserId("u"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.USER,
        )
        with pytest.raises(TenantAccessError, match="missing tenant"):
            require_tenant(ctx)

    def test_alert_rule_store_refuses_cross_tenant_read(
        self, fresh_store: AlertRuleStore
    ) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="PrivateRule",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        # Tenant t2 cannot read t1's custom rule.
        assert fresh_store.get_rule(tenant_id="t2", rule_id=rule.id) is None
        # And cannot list it either (only sees own seeded system rules).
        t2_rules = fresh_store.list_rules(tenant_id="t2")
        assert not any(r.id == rule.id for r in t2_rules)

    def test_alert_rule_store_refuses_cross_tenant_delete(
        self, fresh_store: AlertRuleStore
    ) -> None:
        rule = fresh_store.create_rule(
            tenant_id="t1",
            alert="PrivateRule",
            expr="x > 0",
            for_duration="1m",
            severity="warning",
            description="d",
        )
        # Tenant t2 cannot delete t1's rule.
        assert fresh_store.delete_rule(tenant_id="t2", rule_id=rule.id) is False
        # t1's rule is still there.
        assert fresh_store.get_rule(tenant_id="t1", rule_id=rule.id) is not None
