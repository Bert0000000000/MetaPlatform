"""Cost report API tests (P3-LLMGW-01)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.cost.schemas import UsageRecord


def _seed(service, tenant_id: str = "tenant-test") -> None:
    base = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
    service.seed(
        [
            UsageRecord(
                record_id="r1",
                tenant_id=tenant_id,
                user_id="u1",
                application_id="app1",
                model_id="gpt-4",
                provider_id="openai",
                input_tokens=100,
                output_tokens=50,
                total_tokens=150,
                cost=0.5,
                timestamp=base,
            ),
            UsageRecord(
                record_id="r2",
                tenant_id=tenant_id,
                user_id="u1",
                application_id="app1",
                model_id="gpt-4",
                provider_id="openai",
                input_tokens=200,
                output_tokens=80,
                total_tokens=280,
                cost=0.8,
                timestamp=base + timedelta(hours=1),
            ),
            UsageRecord(
                record_id="r3",
                tenant_id=tenant_id,
                user_id="u2",
                application_id="app2",
                model_id="claude-3",
                provider_id="anthropic",
                input_tokens=300,
                output_tokens=100,
                total_tokens=400,
                cost=1.2,
                timestamp=base + timedelta(days=1),
            ),
            UsageRecord(
                record_id="r4",
                tenant_id="other-tenant",
                user_id="x",
                model_id="gpt-4",
                provider_id="openai",
                total_tokens=999,
                cost=99.0,
                timestamp=base,
            ),
        ]
    )


# ---------------------------------------------------------------- summary


def test_cost_summary(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get("/api/v1/llmgw/cost/summary", headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["tenantId"] == "tenant-test"
    assert data["totalCost"] == pytest.approx(2.5, rel=1e-3)
    assert data["totalTokens"] == 830
    assert data["requestCount"] == 3
    assert any(b["key"] == "gpt-4" for b in data["breakdown"])


# ---------------------------------------------------------------- by-dim


def test_cost_by_user(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get("/api/v1/llmgw/cost/by-user", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert {item["key"] for item in items} == {"u1", "u2"}
    u1 = next(i for i in items if i["key"] == "u1")
    assert u1["cost"] == pytest.approx(1.3, rel=1e-3)


def test_cost_by_application(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get("/api/v1/llmgw/cost/by-application", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert {item["key"] for item in items} == {"app1", "app2"}


def test_cost_by_model_and_provider(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get("/api/v1/llmgw/cost/by-model", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert {item["key"] for item in items} == {"gpt-4", "claude-3"}

    resp = client.get("/api/v1/llmgw/cost/by-provider", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert {item["key"] for item in items} == {"openai", "anthropic"}


# ---------------------------------------------------------------- time-series


def test_cost_time_series(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get(
        "/api/v1/llmgw/cost/time-series", params={"interval": "day"}, headers=tenant_headers
    )
    assert resp.status_code == 200
    points = resp.json()["data"]["points"]
    assert len(points) == 2  # two distinct days
    assert points[0]["bucket"].startswith("2026-01-01")


# ---------------------------------------------------------------- export


def test_cost_export_csv(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get(
        "/api/v1/llmgw/cost/export",
        params={"format": "csv", "dimension": "model"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["format"] == "csv"
    assert "key,cost" in payload["content"]
    assert "gpt-4" in payload["content"]


def test_cost_export_json(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get(
        "/api/v1/llmgw/cost/export",
        params={"format": "json", "dimension": "provider"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["format"] == "json"
    import json
    parsed = json.loads(payload["content"])
    assert parsed["dimension"] == "provider"


def test_cost_tenant_isolation(client: TestClient, tenant_headers, registry):
    _seed(registry.cost_service)
    resp = client.get("/api/v1/llmgw/cost/summary", headers=tenant_headers)
    data = resp.json()["data"]
    # other-tenant record (cost=99) must be excluded
    assert data["totalCost"] < 5