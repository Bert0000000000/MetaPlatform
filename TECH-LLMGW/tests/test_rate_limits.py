"""Rate limit configuration API tests (P1-LLMGW-07/08)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.common.errors import ErrorCode


RATE_LIMIT_PAYLOAD = {
    "name": "User RPM Limit",
    "scope": "USER",
    "targetId": "user-001",
    "type": "RPM",
    "limitValue": 100,
    "windowSeconds": 60,
    "enabled": True,
}


def _create_rate_limit(client: TestClient, headers: dict) -> str:
    resp = client.post("/api/v1/llmgw/rate-limits", json=RATE_LIMIT_PAYLOAD, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["rateLimitId"]


# ------------------------------------------------------------------- create


def test_create_rate_limit_success(client: TestClient, tenant_headers):
    resp = client.post("/api/v1/llmgw/rate-limits", json=RATE_LIMIT_PAYLOAD, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["scope"] == "USER"
    assert data["scopeId"] == "user-001"
    assert data["type"] == "RPM"
    assert data["limit"] == 100
    assert data["remaining"] == 100
    assert data["status"] == "ENABLED"


def test_create_rate_limit_rejects_duplicate(client: TestClient, tenant_headers):
    _create_rate_limit(client, tenant_headers)
    resp = client.post("/api/v1/llmgw/rate-limits", json=RATE_LIMIT_PAYLOAD, headers=tenant_headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


# -------------------------------------------------------------------- list


def test_list_rate_limits(client: TestClient, tenant_headers):
    _create_rate_limit(client, tenant_headers)
    resp = client.get("/api/v1/llmgw/rate-limits", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["page"] == 1
    assert data["total"] >= 1
    assert any(item["type"] == "RPM" for item in data["items"])


def test_list_rate_limits_filters(client: TestClient, tenant_headers):
    _create_rate_limit(client, tenant_headers)
    resp = client.get(
        "/api/v1/llmgw/rate-limits",
        params={"scope": "USER", "type": "RPM"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert all(item["scope"] == "USER" for item in items)
    assert all(item["type"] == "RPM" for item in items)


# ------------------------------------------------------------------ detail


def test_get_rate_limit_detail(client: TestClient, tenant_headers):
    rate_limit_id = _create_rate_limit(client, tenant_headers)
    resp = client.get(f"/api/v1/llmgw/rate-limits/{rate_limit_id}", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["rateLimitId"] == rate_limit_id
    assert data["name"] == "User RPM Limit"
    assert "createdBy" in data


def test_get_rate_limit_detail_404(client: TestClient, tenant_headers):
    resp = client.get("/api/v1/llmgw/rate-limits/rl-does-not-exist", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.RATE_LIMIT_NOT_FOUND)


# ------------------------------------------------------------------ update


def test_update_rate_limit(client: TestClient, tenant_headers):
    rate_limit_id = _create_rate_limit(client, tenant_headers)
    update = {"limitValue": 200, "windowSeconds": 120, "enabled": False}
    resp = client.put(
        f"/api/v1/llmgw/rate-limits/{rate_limit_id}", json=update, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["limit"] == 200
    assert data["windowSeconds"] == 120
    assert data["remaining"] == 200
    assert data["status"] == "DISABLED"


# ------------------------------------------------------------------ reset / stats


def test_reset_rate_limit(client: TestClient, tenant_headers):
    rate_limit_id = _create_rate_limit(client, tenant_headers)
    resp = client.post(
        f"/api/v1/llmgw/rate-limits/{rate_limit_id}/reset", headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["rateLimitId"] == rate_limit_id
    assert "resetAt" in data


def test_rate_limit_stats(client: TestClient, tenant_headers):
    rate_limit_id = _create_rate_limit(client, tenant_headers)
    resp = client.get(
        f"/api/v1/llmgw/rate-limits/{rate_limit_id}/stats", headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["rateLimitId"] == rate_limit_id
    assert data["current"] == 0
    assert data["remaining"] == 100


def test_rate_limit_summary(client: TestClient, tenant_headers):
    _create_rate_limit(client, tenant_headers)
    resp = client.get("/api/v1/llmgw/rate-limits/stats/summary", headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["totalRules"] >= 1
    assert "totalHits" in data


# ------------------------------------------------------------------ delete


def test_delete_rate_limit(client: TestClient, tenant_headers):
    rate_limit_id = _create_rate_limit(client, tenant_headers)
    resp = client.delete(
        f"/api/v1/llmgw/rate-limits/{rate_limit_id}", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["deleted"] is True

    resp = client.get(f"/api/v1/llmgw/rate-limits/{rate_limit_id}", headers=tenant_headers)
    assert resp.status_code == 404
