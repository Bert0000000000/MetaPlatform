"""Catalog endpoints tests (P3-DATA-05)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_assets(client, tenant_headers):
    resp = await client.get("/api/v1/data/catalog/assets", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert any(a["code"] == "orders" for a in items)


@pytest.mark.asyncio
async def test_search_assets(client, tenant_headers):
    resp = await client.get("/api/v1/data/catalog/search?q=order", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert any("order" in a["code"].lower() or "order" in a["name"].lower() for a in items)


@pytest.mark.asyncio
async def test_get_asset_detail(client, tenant_headers):
    resp = await client.get("/api/v1/data/catalog/assets/asset-orders", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["code"] == "orders"


@pytest.mark.asyncio
async def test_get_metadata(client, tenant_headers):
    resp = await client.get(
        "/api/v1/data/catalog/assets/asset-orders/metadata", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["schema"]) >= 1
    assert data["format"] == "PARQUET"


@pytest.mark.asyncio
async def test_get_lineage(client, tenant_headers):
    resp = await client.get(
        "/api/v1/data/catalog/assets/asset-orders/lineage", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["upstream"]) >= 1
    assert len(data["downstream"]) >= 1
    assert len(data["edges"]) >= 1


@pytest.mark.asyncio
async def test_get_profile(client, tenant_headers):
    resp = await client.get(
        "/api/v1/data/catalog/assets/asset-orders/profile", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["columnCount"] >= 1
    assert len(data["columns"]) >= 1