"""Tests for Agent Card endpoints (P3-A2A-02/03)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"

PUBLISH_BODY = {
    "name": "data-analyst-agent",
    "description": "Performs data analysis tasks",
    "version": "1.0.0",
    "protocolVersion": "0.3.0",
    "capabilities": ["data-analysis", "reporting"],
    "endpoints": {"sync": "http://example.com/api/sync", "stream": "http://example.com/api/stream"},
    "authentication": {"scheme": "bearer"},
    "metadata": {"owner": "data-team"},
    "status": "PUBLISHED",
}


async def test_publish_card_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/agent-cards", json=PUBLISH_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == TRACE
    data = body["data"]
    assert data["name"] == "data-analyst-agent"
    assert data["version"] == "1.0.0"
    assert data["capabilities"] == ["data-analysis", "reporting"]
    assert data["status"] == "PUBLISHED"
    assert data["cardId"].startswith("card-")


async def test_publish_card_duplicate_name(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/agent-cards", json=PUBLISH_BODY, headers=tenant_headers)
    assert resp.status_code == 200

    resp = await client.post(f"{BASE}/agent-cards", json=PUBLISH_BODY, headers=tenant_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == int(ErrorCode.DUPLICATE_AGENT_CARD)


async def test_list_cards_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    for i in range(3):
        body = dict(PUBLISH_BODY)
        body["name"] = f"agent-{i}"
        resp = await client.post(f"{BASE}/agent-cards", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/agent-cards", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3
    assert len(data["items"]) == 3


async def test_search_cards_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    body = dict(PUBLISH_BODY)
    body["name"] = "searchable-agent"
    body["capabilities"] = ["search", "index"]
    resp = await client.post(f"{BASE}/agent-cards", json=body, headers=tenant_headers)
    assert resp.status_code == 200

    resp = await client.get(
        f"{BASE}/agent-cards/search",
        params={"capability": "search"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "searchable-agent"


async def test_get_and_delete_card_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/agent-cards", json=PUBLISH_BODY, headers=tenant_headers)
    card_id = resp.json()["data"]["cardId"]

    resp = await client.get(f"{BASE}/agent-cards/{card_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["cardId"] == card_id

    resp = await client.delete(f"{BASE}/agent-cards/{card_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    resp = await client.get(f"{BASE}/agent-cards/{card_id}", headers=tenant_headers)
    assert resp.status_code == 404


async def test_public_well_known_endpoint(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/agent-cards", json=PUBLISH_BODY, headers=tenant_headers)
    assert resp.status_code == 200

    # .well-known/agent.json is whitelisted - no auth required
    resp = await client.get("/.well-known/agent.json")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "data-analyst-agent"
    assert "@context" in data[0]


async def test_card_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.get(f"{BASE}/agent-cards/card-nonexistent", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.CARD_NOT_FOUND)
