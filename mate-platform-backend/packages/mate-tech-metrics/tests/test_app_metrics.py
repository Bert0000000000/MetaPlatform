"""Happy-path tests for mate-tech-metrics (FR-DATA-METRICS-001..008)."""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter
from fastapi.testclient import TestClient


def test_health_anonymous(client: TestClient) -> None:
    r = client.get("/api/v1/metrics/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}


def test_list_metrics(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    r = client.get("/api/v1/metrics", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(m["tenant_id"] == "tenant-acme" for m in body["items"])


def test_list_metrics_status_filter(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/metrics", params={"status": "active"}, headers=auth_headers_acme
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert all(m["status"] == "active" for m in body["items"])


def test_create_metric(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/metrics",
        json={
            "name": "New MRR",
            "expression": "SUM(subscriptions.amount)",
            "description": "Monthly recurring revenue",
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"].startswith("mtc-")
    assert body["status"] == "draft"
    assert body["tenant_id"] == "tenant-acme"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "metrics.metric.created" in types, types


def test_get_metric(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    metrics = client.get("/api/v1/metrics", headers=auth_headers_acme).json()["items"]
    metric_id = metrics[0]["id"]

    r = client.get(f"/api/v1/metrics/{metric_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == metric_id
    assert "expression" in body


def test_get_metric_not_found(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get("/api/v1/metrics/nonexistent", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


def test_update_metric(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    metrics = client.get("/api/v1/metrics", headers=auth_headers_acme).json()["items"]
    metric_id = metrics[0]["id"]

    r = client.put(
        f"/api/v1/metrics/{metric_id}",
        json={"name": "Updated Name", "status": "active"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Updated Name"
    assert body["status"] == "active"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "metrics.metric.updated" in types, types


def test_delete_metric(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    metrics = client.get("/api/v1/metrics", headers=auth_headers_acme).json()["items"]
    metric_id = metrics[0]["id"]

    r = client.delete(f"/api/v1/metrics/{metric_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] is True

    types = {rec.event.type for rec in outbox.all_records()}
    assert "metrics.metric.deleted" in types, types

    r2 = client.get(f"/api/v1/metrics/{metric_id}", headers=auth_headers_acme)
    assert r2.status_code == 404


def test_compute_metric(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    metrics = client.get("/api/v1/metrics", headers=auth_headers_acme).json()["items"]
    metric_id = metrics[0]["id"]

    r = client.post(f"/api/v1/metrics/{metric_id}/compute", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["last_computed_at"] != ""

    types = {rec.event.type for rec in outbox.all_records()}
    assert "metrics.metric.computed" in types, types


def test_get_metric_lineage(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    metrics = client.get("/api/v1/metrics", headers=auth_headers_acme).json()["items"]
    metric_id = metrics[0]["id"]

    r = client.get(f"/api/v1/metrics/{metric_id}/lineage", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["metric_id"] == metric_id
    assert isinstance(body["sources"], list)
    assert len(body["sources"]) >= 1


def test_get_metric_values(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    metrics = client.get("/api/v1/metrics", headers=auth_headers_acme).json()["items"]
    metric_id = metrics[0]["id"]

    r = client.get(f"/api/v1/metrics/{metric_id}/values", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["metric_id"] == metric_id
    assert isinstance(body["values"], list)
    assert body["count"] >= 1


def test_pagination(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/metrics",
        params={"page": 1, "size": 2},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["items"]) <= 2
    assert body["size"] == 2
