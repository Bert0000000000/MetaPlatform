"""ETL endpoints tests (P3-DATA-01)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_etl_task(client, tenant_headers):
    body = {
        "name": "orders_extract",
        "type": "EXTRACT",
        "config": {"sourceId": "ds-mysql"},
        "schedule": "0 * * * *",
        "enabled": True,
    }
    resp = await client.post("/api/v1/data/etl-tasks", json=body, headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "orders_extract"
    assert data["type"] == "EXTRACT"
    assert data["enabled"] is True


@pytest.mark.asyncio
async def test_list_etl_tasks(client, tenant_headers):
    body = {"name": "task1", "type": "LOAD", "config": {}, "enabled": True}
    await client.post("/api/v1/data/etl-tasks", json=body, headers=tenant_headers)
    body = {"name": "task2", "type": "TRANSFORM", "config": {}, "enabled": False}
    await client.post("/api/v1/data/etl-tasks", json=body, headers=tenant_headers)
    resp = await client.get("/api/v1/data/etl-tasks", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) >= 2


@pytest.mark.asyncio
async def test_update_and_get_etl_task(client, tenant_headers):
    body = {"name": "upd", "type": "EXTRACT", "config": {}, "enabled": True}
    create = await client.post("/api/v1/data/etl-tasks", json=body, headers=tenant_headers)
    tid = create.json()["data"]["id"]
    resp = await client.put(
        f"/api/v1/data/etl-tasks/{tid}",
        json={"enabled": False, "name": "upd_v2"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["enabled"] is False
    assert resp.json()["data"]["name"] == "upd_v2"
    resp = await client.get(f"/api/v1/data/etl-tasks/{tid}", headers=tenant_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_trigger_etl_task(client, tenant_headers):
    body = {"name": "trig", "type": "LOAD", "config": {}, "enabled": True}
    create = await client.post("/api/v1/data/etl-tasks", json=body, headers=tenant_headers)
    tid = create.json()["data"]["id"]
    resp = await client.post(
        f"/api/v1/data/etl-tasks/{tid}/trigger", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "SUCCESS"
    runs = await client.get(
        f"/api/v1/data/etl-tasks/{tid}/runs", headers=tenant_headers
    )
    assert runs.json()["data"]["total"] >= 1


@pytest.mark.asyncio
async def test_delete_etl_task(client, tenant_headers):
    body = {"name": "del", "type": "EXTRACT", "config": {}, "enabled": True}
    create = await client.post("/api/v1/data/etl-tasks", json=body, headers=tenant_headers)
    tid = create.json()["data"]["id"]
    resp = await client.delete(f"/api/v1/data/etl-tasks/{tid}", headers=tenant_headers)
    assert resp.status_code == 200
    resp = await client.get(f"/api/v1/data/etl-tasks/{tid}", headers=tenant_headers)
    assert resp.status_code == 404