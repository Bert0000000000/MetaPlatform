"""Quality endpoints tests (P3-DATA-06)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_quality_rule(client, tenant_headers):
    body = {
        "name": "orders_id_not_null",
        "table": "orders",
        "column": "id",
        "ruleType": "not_null",
        "params": {},
        "severity": "HIGH",
        "enabled": True,
    }
    resp = await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["ruleType"] == "not_null"


@pytest.mark.asyncio
async def test_list_and_update_rule(client, tenant_headers):
    body = {
        "name": "r1",
        "table": "orders",
        "column": "amount",
        "ruleType": "range",
        "params": {"min": 0, "max": 1000000},
        "severity": "MEDIUM",
        "enabled": True,
    }
    create = await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    rid = create.json()["data"]["id"]

    resp = await client.get("/api/v1/data/quality/rules", headers=tenant_headers)
    assert resp.status_code == 200
    assert any(r["id"] == rid for r in resp.json()["data"]["items"])

    resp = await client.put(
        f"/api/v1/data/quality/rules/{rid}",
        json={"severity": "CRITICAL", "enabled": False},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["severity"] == "CRITICAL"
    assert resp.json()["data"]["enabled"] is False


@pytest.mark.asyncio
async def test_execute_checks(client, tenant_headers):
    body = {
        "name": "r2",
        "table": "customers",
        "column": "email",
        "ruleType": "unique",
        "params": {},
        "severity": "HIGH",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    resp = await client.post(
        "/api/v1/data/quality/checks/run", headers=tenant_headers
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) >= 1


@pytest.mark.asyncio
async def test_generate_report(client, tenant_headers):
    body = {
        "name": "r3",
        "table": "orders",
        "column": "qty",
        "ruleType": "range",
        "params": {"min": 0, "max": 999},
        "severity": "MEDIUM",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    resp = await client.post("/api/v1/data/quality/reports", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalRules"] >= 1
    assert data["generatedAt"] is not None


@pytest.mark.asyncio
async def test_quality_dashboard(client, tenant_headers):
    body = {
        "name": "r4",
        "table": "t",
        "column": "c",
        "ruleType": "not_null",
        "params": {},
        "severity": "LOW",
        "enabled": True,
    }
    await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    resp = await client.get("/api/v1/data/quality/dashboard", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalRules"] >= 1


@pytest.mark.asyncio
async def test_delete_quality_rule(client, tenant_headers):
    body = {
        "name": "del",
        "table": "t",
        "column": None,
        "ruleType": "not_null",
        "params": {},
        "severity": "LOW",
        "enabled": True,
    }
    create = await client.post("/api/v1/data/quality/rules", json=body, headers=tenant_headers)
    rid = create.json()["data"]["id"]
    resp = await client.delete(f"/api/v1/data/quality/rules/{rid}", headers=tenant_headers)
    assert resp.status_code == 200