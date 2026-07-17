"""Tests for Agent Authentication endpoints (P3-A2A-11/15)."""

from __future__ import annotations

from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"


async def test_generate_api_key_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/auth/api-keys",
        json={"agentId": "auth-test-agent", "permissions": ["read", "write"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["agentId"] == "auth-test-agent"
    assert data["apiKey"].startswith("a2a-")
    assert data["keyId"].startswith("key-")
    assert data["permissions"] == ["read", "write"]


async def test_revoke_api_key_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/auth/api-keys",
        json={"agentId": "auth-test-agent", "permissions": []},
        headers=tenant_headers,
    )
    key_id = resp.json()["data"]["keyId"]

    resp = await client.delete(f"{BASE}/auth/api-keys/{key_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["revoked"] is True


async def test_list_api_keys_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    for i in range(2):
        resp = await client.post(
            f"{BASE}/auth/api-keys",
            json={"agentId": f"agent-{i}", "permissions": []},
            headers=tenant_headers,
        )
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/auth/api-keys", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2


async def test_update_key_permissions_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/auth/api-keys",
        json={"agentId": "perm-agent", "permissions": ["read"]},
        headers=tenant_headers,
    )
    key_id = resp.json()["data"]["keyId"]

    resp = await client.put(
        f"{BASE}/auth/api-keys/{key_id}/permissions",
        json={"permissions": ["read", "write", "admin"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["permissions"] == ["read", "write", "admin"]


async def test_revoke_nonexistent_key(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.delete(f"{BASE}/auth/api-keys/key-nonexistent", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.KEY_NOT_FOUND)
