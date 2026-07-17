"""Warehouse endpoints tests (P3-DATA-04)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_execute_query(client, tenant_headers):
    body = {"sql": "SELECT COUNT(*) FROM orders", "limit": 5}
    resp = await client.post("/api/v1/data/warehouse/query", json=body, headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["rowCount"] >= 1
    assert len(data["columns"]) == 2


@pytest.mark.asyncio
async def test_list_layers(client, tenant_headers):
    resp = await client.get("/api/v1/data/warehouse/layers", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert {l["layer"] for l in items} == {"ods", "dwd", "dws", "ads"}


@pytest.mark.asyncio
async def test_list_tables(client, tenant_headers):
    resp = await client.get("/api/v1/data/warehouse/tables", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert any(t["layer"] == "dwd" for t in items)
    resp = await client.get(
        "/api/v1/data/warehouse/tables?layer=dws", headers=tenant_headers
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert all(t["layer"] == "dws" for t in items)


@pytest.mark.asyncio
async def test_create_and_refresh_materialized_view(client, tenant_headers):
    body = {
        "name": "mv_top_products",
        "layer": "ads",
        "definition": "SELECT product_id, SUM(qty) FROM orders GROUP BY product_id",
        "refreshStrategy": "hourly",
    }
    resp = await client.post(
        "/api/v1/data/warehouse/materialized-views", json=body, headers=tenant_headers
    )
    assert resp.status_code == 200
    mv_id = resp.json()["data"]["id"]

    resp = await client.get(
        "/api/v1/data/warehouse/materialized-views", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert any(m["id"] == mv_id for m in resp.json()["data"]["items"])

    resp = await client.post(
        f"/api/v1/data/warehouse/materialized-views/{mv_id}/refresh",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["lastRefreshedAt"] is not None


@pytest.mark.asyncio
async def test_query_rejects_non_select(client, tenant_headers):
    body = {"sql": "DROP TABLE orders", "limit": 5}
    resp = await client.post("/api/v1/data/warehouse/query", json=body, headers=tenant_headers)
    assert resp.status_code == 400