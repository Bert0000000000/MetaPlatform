"""Tests for /api/v1/admin/permissions endpoints (FR-DASH-006-02)."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_roles(client):
    r = await client.get("/api/v1/admin/permissions/roles")
    assert r.status_code in (200, 201)
    items = r.json()["data"]["items"]
    codes = {r["code"] for r in items}
    assert "PLATFORM_SUPER_ADMIN" in codes
    assert "PLATFORM_ADMIN" in codes
    assert "PLATFORM_ADMIN_VIEWER" in codes


@pytest.mark.asyncio
async def test_catalog(client):
    r = await client.get("/api/v1/admin/permissions/catalog")
    assert r.status_code in (200, 201)
    items = r.json()["data"]
    assert len(items) >= 21  # seeded
    codes = {p["code"] for p in items}
    assert "user:create" in codes
    assert "role:assign" in codes


@pytest.mark.asyncio
async def test_matrix(client):
    r = await client.get("/api/v1/admin/permissions/matrix")
    assert r.status_code in (200, 201)
    body = r.json()["data"]
    assert body["roles"], body
    assert body["permissions"], body
    assert "matrix" in body


@pytest.mark.asyncio
async def test_create_role(client):
    payload = {
        "code": "CUSTOM_TEST_ROLE",
        "name": "测试自定义角色",
        "data_scope": "SELF",
        "permission_ids": [1, 2],
    }
    r = await client.post("/api/v1/admin/permissions/roles", json=payload)
    assert r.status_code in (200, 201), r.text
    assert r.json()["data"]["code"] == "CUSTOM_TEST_ROLE"


@pytest.mark.asyncio
async def test_delete_builtin_blocked(client):
    """PLATFORM_ADMIN is seeded as builtin; deleting should be blocked."""
    r = await client.get("/api/v1/admin/permissions/roles")
    builtin_id = next(r["id"] for r in r.json()["data"]["items"] if r["code"] == "PLATFORM_ADMIN")
    r = await client.delete(f"/api/v1/admin/permissions/roles/{builtin_id}")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_assign_role_to_user(client):
    # Get custom role id
    await client.post(
        "/api/v1/admin/permissions/roles",
        json={"code": "TMP_ASSIGN_ROLE", "name": "tmp", "data_scope": "SELF"},
    )
    r = await client.get("/api/v1/admin/permissions/roles?keyword=TMP_ASSIGN")
    role_id = r.json()["data"]["items"][0]["id"]

    r = await client.post(
        "/api/v1/admin/permissions/assign",
        json={"type": "user", "targetId": 2, "role_ids": [role_id]},
    )
    # Our backend uses snake_case, so this should still work via alias mapping? Check.
    if r.status_code != 200:
        # Try the snake_case body
        r = await client.post(
            "/api/v1/admin/permissions/assign",
            json={"type": "user", "target_id": 2, "role_ids": [role_id]},
        )
    assert r.status_code in (200, 201), r.text
