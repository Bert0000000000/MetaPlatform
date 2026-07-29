"""Tests for /api/v1/admin/orgs endpoints (FR-DASH-006-03)."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_tree(client):
    r = await client.get("/api/v1/admin/orgs/tree")
    assert r.status_code in (200, 201)
    items = r.json()["data"]
    assert isinstance(items, list)
    # Root "MetaPlatform 总部" should have children
    assert any(n["name"] == "技术中心" for n in items[0].get("children", []))


@pytest.mark.asyncio
async def test_list_orgs(client):
    r = await client.get("/api/v1/admin/orgs")
    assert r.status_code in (200, 201)
    assert r.json()["data"]["total"] >= 5


@pytest.mark.asyncio
async def test_positions_listing(client):
    r = await client.get("/api/v1/admin/orgs/positions")
    assert r.status_code in (200, 201)
    items = r.json()["data"]["items"]
    assert len(items) >= 5


@pytest.mark.asyncio
async def test_create_org_then_delete(client):
    r = await client.post(
        "/api/v1/admin/orgs",
        json={"code": "TEST_ORG", "name": "测试组织", "type": "TEAM"},
    )
    assert r.status_code in (200, 201), r.text
    new_id = r.json()["data"]["id"]

    r = await client.delete(f"/api/v1/admin/orgs/{new_id}")
    assert r.status_code in (200, 201)


@pytest.mark.asyncio
async def test_transfer(client):
    r = await client.post(
        "/api/v1/admin/orgs/transfer",
        json={"user_id": 2, "target_org_id": 2, "reason": "test"},
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_create_position(client):
    # Get a tech org id
    r = await client.get("/api/v1/admin/orgs")
    org = next(o for o in r.json()["data"]["items"] if o["code"] == "TECH")
    r = await client.post(
        "/api/v1/admin/orgs/positions",
        json={"org_id": org["id"], "code": "TEST_POS", "name": "测试岗"},
    )
    assert r.status_code in (200, 201), r.text
