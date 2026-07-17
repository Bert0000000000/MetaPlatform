"""Monitoring endpoints tests (P3-DATA-07)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_overview(client, tenant_headers):
    resp = await client.get("/api/v1/data/monitoring/overview", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["tenantId"] == "tenant-test"
    assert data["totalPipelines"] >= 0


@pytest.mark.asyncio
async def test_list_sla(client, tenant_headers):
    resp = await client.get("/api/v1/data/monitoring/sla", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) >= 1
    assert {s["status"] for s in items}.issubset({"WITHIN_SLA", "BREACHED"})


@pytest.mark.asyncio
async def test_create_and_list_alerts(client, tenant_headers):
    body = {
        "title": "ETL failed",
        "description": "orders_etl failed at step 2",
        "severity": "HIGH",
        "source": "orders_etl",
        "metadata": {},
    }
    create = await client.post("/api/v1/data/monitoring/alerts", json=body, headers=tenant_headers)
    assert create.status_code == 200
    aid = create.json()["data"]["id"]
    assert create.json()["data"]["status"] == "ACTIVE"

    resp = await client.get("/api/v1/data/monitoring/alerts", headers=tenant_headers)
    assert resp.status_code == 200
    assert any(a["id"] == aid for a in resp.json()["data"]["items"])


@pytest.mark.asyncio
async def test_acknowledge_and_resolve_alert(client, tenant_headers):
    body = {
        "title": "Disk usage",
        "description": "Disk usage > 90%",
        "severity": "CRITICAL",
        "source": "infra",
        "metadata": {},
    }
    create = await client.post("/api/v1/data/monitoring/alerts", json=body, headers=tenant_headers)
    aid = create.json()["data"]["id"]

    ack = await client.post(
        f"/api/v1/data/monitoring/alerts/{aid}/acknowledge?operator=alice",
        headers=tenant_headers,
    )
    assert ack.status_code == 200
    assert ack.json()["data"]["status"] == "ACKNOWLEDGED"

    resolve = await client.post(
        f"/api/v1/data/monitoring/alerts/{aid}/resolve?operator=alice",
        headers=tenant_headers,
    )
    assert resolve.status_code == 200
    assert resolve.json()["data"]["status"] == "RESOLVED"


@pytest.mark.asyncio
async def test_alert_logs(client, tenant_headers):
    body = {
        "title": "Pipeline delayed",
        "description": "delayed",
        "severity": "LOW",
        "source": "test",
        "metadata": {},
    }
    create = await client.post("/api/v1/data/monitoring/alerts", json=body, headers=tenant_headers)
    aid = create.json()["data"]["id"]
    await client.post(
        f"/api/v1/data/monitoring/alerts/{aid}/acknowledge", headers=tenant_headers
    )

    resp = await client.get(
        f"/api/v1/data/monitoring/logs?alertId={aid}", headers=tenant_headers
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert any(e["action"] == "ACKNOWLEDGED" for e in items)
    assert any(e["action"] == "TRIGGERED" for e in items)