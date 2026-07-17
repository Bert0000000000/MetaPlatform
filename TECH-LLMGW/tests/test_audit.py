"""Audit log API tests (P3-LLMGW-02)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.audit.schemas import AuditLogEntry, AuditLogStatus


def _seed(service, tenant_id: str = "tenant-test") -> None:
    base = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
    service.seed(
        [
            AuditLogEntry(
                log_id="l1",
                tenant_id=tenant_id,
                user_id="u1",
                application_id="app1",
                model_id="gpt-4",
                provider_id="openai",
                status=AuditLogStatus.SUCCESS,
                input_tokens=100,
                output_tokens=50,
                latency_ms=200,
                cost=0.1,
                timestamp=base,
            ),
            AuditLogEntry(
                log_id="l2",
                tenant_id=tenant_id,
                user_id="u2",
                model_id="gpt-4",
                provider_id="openai",
                status=AuditLogStatus.SUCCESS,
                input_tokens=80,
                output_tokens=40,
                latency_ms=400,
                cost=0.08,
                timestamp=base + timedelta(minutes=5),
            ),
            AuditLogEntry(
                log_id="l3",
                tenant_id=tenant_id,
                user_id="u1",
                model_id="claude-3",
                provider_id="anthropic",
                status=AuditLogStatus.ERROR,
                error_code="TIMEOUT",
                error_message="Request timeout after 30s",
                latency_ms=30000,
                timestamp=base + timedelta(minutes=10),
            ),
            AuditLogEntry(
                log_id="l-other",
                tenant_id="other-tenant",
                user_id="x",
                model_id="gpt-4",
                provider_id="openai",
                status=AuditLogStatus.SUCCESS,
                latency_ms=500,
                cost=0.5,
                timestamp=base,
            ),
        ]
    )


# ---------------------------------------------------------------- query


def test_query_audit_logs(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get("/api/v1/llmgw/audit-logs", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3
    assert len(data["items"]) == 3


def test_query_audit_logs_filter_status(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get(
        "/api/v1/llmgw/audit-logs",
        params={"status": "ERROR"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["logId"] == "l3"


def test_query_audit_logs_filter_user(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get(
        "/api/v1/llmgw/audit-logs", params={"userId": "u2"}, headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["userId"] == "u2"


# ---------------------------------------------------------------- errors / detail


def test_get_errors(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get("/api/v1/llmgw/audit-logs/errors", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["errorCode"] == "TIMEOUT"


def test_get_detail(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get("/api/v1/llmgw/audit-logs/l1", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["logId"] == "l1"
    assert data["errorMessage"] is None


def test_get_detail_404(client: TestClient, tenant_headers, registry):
    resp = client.get("/api/v1/llmgw/audit-logs/nope", headers=tenant_headers)
    assert resp.status_code == 400


# ---------------------------------------------------------------- latency


def test_latency_stats(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get("/api/v1/llmgw/audit-logs/latency", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["count"] == 3
    assert data["min"] == 200
    assert data["max"] == 30000
    assert data["avg"] > 0


def test_latency_by_model(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get("/api/v1/llmgw/audit-logs/latency-by-model", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert {item["modelId"] for item in items} == {"gpt-4", "claude-3"}
    gpt = next(i for i in items if i["modelId"] == "gpt-4")
    assert gpt["stats"]["count"] == 2


# ---------------------------------------------------------------- export


def test_export_csv(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get(
        "/api/v1/llmgw/audit-logs/export",
        params={"format": "csv"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["format"] == "csv"
    assert "logId" in payload["content"]
    assert "TIMEOUT" not in payload["content"] or payload["content"].count("\n") >= 3


def test_export_json(client: TestClient, tenant_headers, registry):
    _seed(registry.audit_service)
    resp = client.get(
        "/api/v1/llmgw/audit-logs/export",
        params={"format": "json"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    payload = resp.json()["data"]
    import json
    parsed = json.loads(payload["content"])
    assert parsed["tenantId"] == "tenant-test"
    assert len(parsed["items"]) == 3