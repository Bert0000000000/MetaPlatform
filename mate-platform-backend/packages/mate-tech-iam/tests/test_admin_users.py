"""Tests for /api/v1/admin/users endpoints (FR-DASH-006-01)."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_users_seeded(client):
    r = await client.get("/api/v1/admin/users?pageSize=5")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["code"] == 0
    assert data["data"]["total"] >= 10  # seeded users
    assert isinstance(data["data"]["items"], list)


@pytest.mark.asyncio
async def test_keyword_search(client):
    r = await client.get("/api/v1/admin/users?keyword=zhang")
    assert r.status_code == 200
    usernames = [u["username"] for u in r.json()["data"]["items"]]
    assert "zhangsan" in usernames


@pytest.mark.asyncio
async def test_create_user_returns_initial_password(client):
    payload = {
        "username": "newbie",
        "real_name": "新人",
        "email": "newbie@meta.com",
        "department": "技术部",
        "role_ids": [],
    }
    r = await client.post("/api/v1/admin/users", json=payload)
    assert r.status_code in (200, 201), r.text
    body = r.json()["data"]
    assert body["username"] == "newbie"
    assert body["initial_password"]  # auto-generated
    assert len(body["initial_password"]) >= 8


@pytest.mark.asyncio
async def test_create_user_conflict(client):
    payload = {"username": "admin", "real_name": "管理员"}
    r = await client.post("/api/v1/admin/users", json=payload)
    assert r.status_code == 409
    assert "已存在" in r.text


@pytest.mark.asyncio
async def test_reset_password(client):
    r = await client.post("/api/v1/admin/users/2/reset-password")
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["temporary_password"]
    assert len(body["temporary_password"]) >= 8


@pytest.mark.asyncio
async def test_status_update(client):
    r = await client.post("/api/v1/admin/users/2/status", json={"status": "INACTIVE"})
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "INACTIVE"


@pytest.mark.asyncio
async def test_delete_user(client):
    # Create one first
    await client.post(
        "/api/v1/admin/users",
        json={"username": "tobedel", "real_name": "待删除"},
    )
    r = await client.get("/api/v1/admin/users?keyword=tobedel")
    uid = r.json()["data"]["items"][0]["id"]
    r = await client.delete(f"/api/v1/admin/users/{uid}")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_login_logs_endpoint(client):
    r = await client.get("/api/v1/admin/users/1/login-logs")
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    # Seeder writes ~10 logs for admin
    assert isinstance(items, list)
    assert all("occurredAt" in log for log in items)


@pytest.mark.asyncio
async def test_import_and_export(client):
    """CSV import then export round-trip."""
    csv_content = "username,real_name,email,department\nimported1,导入一,a1@meta.com,技术部\nimported2,导入二,a2@meta.com,产品部\n"
    # httpx ASGI: pass file tuple with explicit content_type to ensure multipart works
    import io
    files = {"file": ("users.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    r = await client.post("/api/v1/admin/users/import", files=files)
    if r.status_code not in (200, 201):
        # Print body for debugging
        print("IMPORT RESPONSE:", r.status_code, r.text)
    assert r.status_code in (200, 201), r.text
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["created"] == 2

    r = await client.get("/api/v1/admin/users/export")
    assert r.status_code == 200
    assert "username" in r.text
    assert "imported1" in r.text


@pytest.mark.asyncio
async def test_require_admin_rejects_no_role():
    """A caller without PLATFORM_* roles is rejected with 403."""
    from httpx import ASGITransport, AsyncClient
    from mate_tech_iam.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"x-mate-tenant-id": "tenant-default", "x-mate-dev-user": "guest", "x-mate-roles": "GUEST"},
    ) as ac:
        r = await ac.get("/api/v1/admin/users")
    assert r.status_code == 403
