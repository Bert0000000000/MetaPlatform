"""Cross-tenant integration tests for mate-app-wfe (ADR-0014 step 5).

These tests exercise the auth + tenancy contract end-to-end:

  - test_flows_test_tenant_isolation: two tenants running ad-hoc
    flows produce isolated test-run records.
  - test_flows_validate_tenant_isolation: two tenants querying
    /flows/validate see disjoint validation catalogs.
  - test_no_tenant_400: token with empty tenant_id is rejected by
    require_tenant (TenantAccessError -> 400 E_TENANT_REQUIRED).
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_app_wfe.main import create_app
from mate_app_wfe.repositories import in_memory as in_memory_repo

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


_VALID_BPMN = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">'
    '<bpmn:process id="proc-1" isExecutable="true">'
    '<bpmn:startEvent id="start-1"/>'
    '<bpmn:endEvent id="end-1"/>'
    '</bpmn:process>'
    '</bpmn:definitions>'
)


@pytest.fixture
def fresh_app() -> TestClient:
    """Per-test TestClient with a clean in-memory store."""
    in_memory_repo.reset_store()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_no_tenant_400(fresh_app: TestClient) -> None:
    """Token with empty tenant_id -> 400 E_TENANT_REQUIRED."""
    token = _token(tenant_id="")
    r = fresh_app.get(
        "/api/v1/wfe/flows/validate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"

    # Same for POST /flows/test.
    r2 = fresh_app.post(
        "/api/v1/wfe/flows/test",
        json={"bpmn_xml": _VALID_BPMN},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 400, r2.text
    assert r2.json()["code"] == "E_TENANT_REQUIRED"


def test_flows_validate_tenant_isolation(fresh_app: TestClient) -> None:
    """Two tenants querying /flows/validate see tenant-bound rows only."""
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r_acme = fresh_app.get(
        "/api/v1/wfe/flows/validate",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r_globex = fresh_app.get(
        "/api/v1/wfe/flows/validate",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r_acme.status_code == 200, r_acme.text
    assert r_globex.status_code == 200, r_globex.text
    for item in r_acme.json()["items"]:
        assert item["tenant_id"] == "tenant-acme", item
    for item in r_globex.json()["items"]:
        assert item["tenant_id"] == "tenant-globex", item


def test_flows_test_tenant_isolation(fresh_app: TestClient) -> None:
    """Two tenants running ad-hoc flows see only their own validation rows."""
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    # Each tenant runs an ad-hoc test.
    r_acme = fresh_app.post(
        "/api/v1/wfe/flows/test",
        json={"bpmn_xml": _VALID_BPMN, "name": "Acme Flow"},
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r_globex = fresh_app.post(
        "/api/v1/wfe/flows/test",
        json={"bpmn_xml": _VALID_BPMN, "name": "Globex Flow"},
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r_acme.status_code == 200, r_acme.text
    assert r_globex.status_code == 200, r_globex.text
    assert r_acme.json()["flow_id"].startswith("adhoc-")
    assert r_globex.json()["flow_id"].startswith("adhoc-")

    # Acme's validate list must NOT contain globex's ad-hoc flow.
    r_acme_val = fresh_app.get(
        "/api/v1/wfe/flows/validate",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    acme_flow_ids = {v["flow_id"] for v in r_acme_val.json()["items"]}
    globex_adhoc = r_globex.json()["flow_id"]
    assert globex_adhoc not in acme_flow_ids, (globex_adhoc, acme_flow_ids)
    # All acme rows belong to acme.
    for item in r_acme_val.json()["items"]:
        assert item["tenant_id"] == "tenant-acme", item
