"""Quota configuration API tests (P1-LLMGW-04)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.common.errors import ErrorCode


QUOTA_PAYLOAD = {
    "name": "User Daily Token Limit",
    "scope": "USER",
    "targetId": "user-001",
    "type": "TOKEN_DAILY",
    "limitValue": 100000,
    "alertThreshold": 80,
    "enabled": True,
}


def _create_quota(client: TestClient, headers: dict) -> str:
    resp = client.post("/api/v1/llmgw/quotas", json=QUOTA_PAYLOAD, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["quotaId"]


# ------------------------------------------------------------------- create


def test_create_quota_success(client: TestClient, tenant_headers):
    resp = client.post("/api/v1/llmgw/quotas", json=QUOTA_PAYLOAD, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["scope"] == "USER"
    assert data["scopeId"] == "user-001"
    assert data["quotaType"] == "TOKEN_DAILY"
    assert data["limit"] == 100000
    assert data["used"] == 0
    assert data["remaining"] == 100000
    assert data["status"] == "ACTIVE"
    assert data["alertThreshold"] == 80


def test_create_quota_rejects_duplicate(client: TestClient, tenant_headers):
    _create_quota(client, tenant_headers)
    resp = client.post("/api/v1/llmgw/quotas", json=QUOTA_PAYLOAD, headers=tenant_headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


# -------------------------------------------------------------------- list


def test_list_quotas(client: TestClient, tenant_headers):
    _create_quota(client, tenant_headers)
    resp = client.get("/api/v1/llmgw/quotas", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["page"] == 1
    assert data["total"] >= 1
    assert any(item["quotaType"] == "TOKEN_DAILY" for item in data["items"])


def test_list_quotas_filters(client: TestClient, tenant_headers):
    _create_quota(client, tenant_headers)
    resp = client.get(
        "/api/v1/llmgw/quotas",
        params={"scope": "USER", "type": "TOKEN_DAILY"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert all(item["scope"] == "USER" for item in items)
    assert all(item["quotaType"] == "TOKEN_DAILY" for item in items)


# ------------------------------------------------------------------ detail


def test_get_quota_detail(client: TestClient, tenant_headers):
    quota_id = _create_quota(client, tenant_headers)
    resp = client.get(f"/api/v1/llmgw/quotas/{quota_id}", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["quotaId"] == quota_id
    assert data["name"] == "User Daily Token Limit"
    assert "lastAlertAt" in data


def test_get_quota_detail_404(client: TestClient, tenant_headers):
    resp = client.get("/api/v1/llmgw/quotas/qta-does-not-exist", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.QUOTA_NOT_FOUND)


# ------------------------------------------------------------------ update


def test_update_quota(client: TestClient, tenant_headers):
    quota_id = _create_quota(client, tenant_headers)
    update = {"limitValue": 200000, "alertThreshold": 90, "usedValue": 5000}
    resp = client.put(
        f"/api/v1/llmgw/quotas/{quota_id}", json=update, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["limit"] == 200000
    assert data["used"] == 5000
    assert data["remaining"] == 195000
    assert data["alertThreshold"] == 90


# ------------------------------------------------------------------ delete


def test_delete_quota(client: TestClient, tenant_headers):
    quota_id = _create_quota(client, tenant_headers)
    resp = client.delete(
        f"/api/v1/llmgw/quotas/{quota_id}", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["deleted"] is True

    resp = client.get(f"/api/v1/llmgw/quotas/{quota_id}", headers=tenant_headers)
    assert resp.status_code == 404
