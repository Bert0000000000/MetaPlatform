"""Lakehouse endpoints tests (P3-DATA-03)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_lake_table(client, tenant_headers):
    body = {
        "name": "orders_lake",
        "format": "hudi",
        "location": "s3://lake/orders/",
        "partitionConfig": {"field": "ds", "type": "daily"},
        "schema": {"fields": [{"name": "id", "type": "BIGINT"}]},
    }
    resp = await client.post("/api/v1/data/lakehouse/tables", json=body, headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["format"] == "hudi"
    assert data["name"] == "orders_lake"


@pytest.mark.asyncio
async def test_list_lake_tables(client, tenant_headers):
    body = {
        "name": "t1",
        "format": "iceberg",
        "location": "s3://lake/t1/",
        "partitionConfig": {},
        "schema": {},
    }
    await client.post("/api/v1/data/lakehouse/tables", json=body, headers=tenant_headers)
    resp = await client.get("/api/v1/data/lakehouse/tables", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) >= 1


@pytest.mark.asyncio
async def test_update_lake_table(client, tenant_headers):
    body = {
        "name": "t2",
        "format": "hudi",
        "location": "s3://lake/t2/",
        "partitionConfig": {},
        "schema": {},
    }
    created = await client.post("/api/v1/data/lakehouse/tables", json=body, headers=tenant_headers)
    tid = created.json()["data"]["id"]
    resp = await client.put(
        f"/api/v1/data/lakehouse/tables/{tid}",
        json={"location": "s3://lake/t2-new/"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["location"] == "s3://lake/t2-new/"


@pytest.mark.asyncio
async def test_create_and_run_ingest_task(client, tenant_headers):
    body = {
        "name": "t3",
        "format": "iceberg",
        "location": "s3://lake/t3/",
        "partitionConfig": {},
        "schema": {},
    }
    created = await client.post("/api/v1/data/lakehouse/tables", json=body, headers=tenant_headers)
    tid = created.json()["data"]["id"]
    task = await client.post(
        f"/api/v1/data/lakehouse/tables/{tid}/ingest",
        json={"sourceDatasourceId": "ds-1", "mode": "cdc"},
        headers=tenant_headers,
    )
    assert task.status_code == 200
    task_id = task.json()["data"]["id"]
    resp = await client.post(
        f"/api/v1/data/lakehouse/tables/{tid}/ingest/{task_id}/run",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_delete_lake_table(client, tenant_headers):
    body = {
        "name": "t4",
        "format": "hudi",
        "location": "s3://lake/t4/",
        "partitionConfig": {},
        "schema": {},
    }
    created = await client.post("/api/v1/data/lakehouse/tables", json=body, headers=tenant_headers)
    tid = created.json()["data"]["id"]
    resp = await client.delete(f"/api/v1/data/lakehouse/tables/{tid}", headers=tenant_headers)
    assert resp.status_code == 200
    resp = await client.get(f"/api/v1/data/lakehouse/tables/{tid}", headers=tenant_headers)
    assert resp.status_code == 404