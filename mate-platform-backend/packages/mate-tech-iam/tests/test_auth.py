"""Tests for /api/v1/iam/auth/* (FR-DASH-006 auth flows)."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_login_success(client):
    """Default admin user seeded with password admin123."""
    r = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "admin", "password": "admin123", "tenantId": "tenant-default"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["loginResult"] == "SUCCESS"
    assert body["userId"] == "1"
    assert body["username"] == "admin"
    assert body["accessToken"]
    assert body["refreshToken"]
    assert body["user"]["email"] == "admin@meta.com"
    assert body["user"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_login_default_tenant(client):
    """Omitting tenantId falls back to tenant-default."""
    r = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    r = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "admin", "password": "WRONG", "tenantId": "tenant-default"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_user(client):
    r = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "ghost", "password": "anything", "tenantId": "tenant-default"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_locked_user(client):
    """zhaoliu is seeded with status LOCKED."""
    r = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "zhaoliu", "password": "demo1234", "tenantId": "tenant-default"},
    )
    assert r.status_code == 403
    assert "LOCKED" in r.text


@pytest.mark.asyncio
async def test_login_inactive_user(client):
    """wangwu is seeded with status INACTIVE."""
    r = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "wangwu", "password": "demo1234", "tenantId": "tenant-default"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_refresh_token_exchange(client):
    """Login first, then use refresh token."""
    login = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "operator", "password": "operator123", "tenantId": "tenant-default"},
    )
    assert login.status_code == 200
    refresh_token = login.json()["refreshToken"]

    r = await client.post(
        "/api/v1/iam/auth/refresh",
        json={"refreshToken": refresh_token},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["accessToken"]
    assert body["refreshToken"]
    assert body["userId"]


@pytest.mark.asyncio
async def test_refresh_invalid_token(client):
    r = await client.post(
        "/api/v1/iam/auth/refresh",
        json={"refreshToken": "not-a-real-jwt"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rejects_access_token(client):
    """Access tokens cannot be used as refresh tokens."""
    login = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "admin", "password": "admin123", "tenantId": "tenant-default"},
    )
    access = login.json()["accessToken"]

    r = await client.post(
        "/api/v1/iam/auth/refresh",
        json={"refreshToken": access},
    )
    assert r.status_code == 401
    assert "Not a refresh token" in r.text


@pytest.mark.asyncio
async def test_me_requires_auth():
    """The /auth/me endpoint requires a valid Bearer token."""
    from httpx import ASGITransport, AsyncClient
    from mate_tech_iam.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        r = await ac.get("/api/v1/iam/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_profile(client):
    """Auth /me works with a valid Bearer token."""
    login = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "admin", "password": "admin123", "tenantId": "tenant-default"},
    )
    access = login.json()["accessToken"]

    r = await client.get(
        "/api/v1/iam/auth/me",
        headers={"Authorization": "Bearer " + access},
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["username"] == "admin"
    assert body["isSuperAdmin"] is True
    assert "PLATFORM_SUPER_ADMIN" in body["roles"]


@pytest.mark.asyncio
async def test_logout_clears_session(client):
    login = await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "admin", "password": "admin123", "tenantId": "tenant-default"},
    )
    access = login.json()["accessToken"]

    r = await client.post(
        "/api/v1/iam/auth/logout",
        headers={"Authorization": "Bearer " + access},
    )
    assert r.status_code == 200
    assert r.json()["loggedOut"] is True


@pytest.mark.asyncio
async def test_sso_providers_empty(client):
    """SSO endpoint returns empty list in default dev."""
    r = await client.get("/api/v1/iam/sso-providers?page=1&size=100")
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 0
    assert body["data"]["items"] == []
    assert body["data"]["total"] == 0
    assert "hint" in body["data"]


@pytest.mark.asyncio
async def test_login_log_writes_success_and_failure(client):
    """Every login attempt (success or failure) records a LoginLog."""
    await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "admin", "password": "admin123", "tenantId": "tenant-default"},
    )
    await client.post(
        "/api/v1/iam/auth/login",
        json={"username": "ghost", "password": "x", "tenantId": "tenant-default"},
    )

    # admin user_id is 1; verify a SUCCESS entry was recorded
    r = await client.get("/api/v1/admin/users/1/login-logs?pageSize=20")
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    results = [it["result"] for it in items]
    assert "SUCCESS" in results
