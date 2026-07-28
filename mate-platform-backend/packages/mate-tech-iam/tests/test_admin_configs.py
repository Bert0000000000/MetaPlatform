"""Tests for /api/v1/admin/configs endpoints (FR-DASH-006-05)."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_configs(client):
    r = await client.get("/api/v1/admin/configs?pageSize=50")
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert len(items) >= 10


@pytest.mark.asyncio
async def test_categories(client):
    r = await client.get("/api/v1/admin/configs/categories")
    assert r.status_code == 200
    cats = r.json()["data"]
    assert any(c["value"] == "SSO" for c in cats)
    assert any(c["value"] == "RATE_LIMIT" for c in cats)


@pytest.mark.asyncio
async def test_update_string(client):
    r = await client.put(
        "/api/v1/admin/configs/security.password_min_length",
        json={"value": 10, "note": "test update"},
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["value"] == 10  # int type auto-decoded


@pytest.mark.asyncio
async def test_update_enum_validates(client):
    """enum options restricted by value_type=enum."""
    r = await client.put(
        "/api/v1/admin/configs/message.sms.provider",
        json={"value": "alibaba"},  # not in enum_options
    )
    assert r.status_code == 400
    assert "E400_VALIDATION" in r.text


@pytest.mark.asyncio
async def test_update_creates_audit_log(client):
    # Use unique key to isolate
    r = await client.put(
        "/api/v1/admin/configs/security.password_min_length",
        json={"value": 12, "note": "audit trigger"},
    )
    assert r.status_code == 200
    r = await client.get("/api/v1/admin/logs/audit?module=config&pageSize=5")
    items = r.json()["data"]["items"]
    assert any("security.password_min_length" in (log.get("resourceId") or "") for log in items)


@pytest.mark.asyncio
async def test_sensitive_masked(client):
    r = await client.get("/api/v1/admin/configs?pageSize=50")
    items = r.json()["data"]["items"]
    sensitive = [c for c in items if c["is_sensitive"]]
    assert sensitive, "expected seeded sensitive config"
    assert all(c["raw_value"] == "***" for c in sensitive)