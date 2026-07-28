"""Tests for /api/v1/admin/logs endpoints (FR-DASH-006-04)."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_audit(client):
    r = await client.get("/api/v1/admin/logs/audit?pageSize=5")
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert len(items) >= 1
    # Each entry must have required fields
    for log in items:
        assert "actorId" in log
        assert "module" in log
        assert "action" in log
        assert "occurredAt" in log


@pytest.mark.asyncio
async def test_filter_by_module(client):
    r = await client.get("/api/v1/admin/logs/audit?module=user&pageSize=50")
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert all(log["module"] == "user" for log in items)


@pytest.mark.asyncio
async def test_modules_facets(client):
    r = await client.get("/api/v1/admin/logs/modules")
    assert r.status_code == 200
    body = r.json()["data"]
    assert "modules" in body
    assert "actions" in body
    assert any(m["value"] == "user" for m in body["modules"])


@pytest.mark.asyncio
async def test_export_csv(client):
    r = await client.get("/api/v1/admin/logs/audit/export?fmt=csv")
    assert r.status_code == 200
    assert "actor_id" in r.text  # CSV header


@pytest.mark.asyncio
async def test_export_json(client):
    r = await client.get("/api/v1/admin/logs/audit/export?fmt=json")
    assert r.status_code == 200
    import json

    data = json.loads(r.text)
    assert isinstance(data, list)
    assert "actorId" in data[0]


@pytest.mark.asyncio
async def test_get_log_detail(client):
    r = await client.get("/api/v1/admin/logs/audit?pageSize=1")
    log_id = r.json()["data"]["items"][0]["id"]
    r = await client.get(f"/api/v1/admin/logs/audit/{log_id}")
    assert r.status_code == 200
    assert r.json()["data"]["id"] == log_id