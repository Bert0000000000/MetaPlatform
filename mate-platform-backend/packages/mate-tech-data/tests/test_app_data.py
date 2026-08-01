"""Happy-path tests for the mate-tech-data endpoints (FR-DATA-001..015).

Exercises all 15 control-plane endpoints (8 CDC task + 7 data source)
plus outbox event emission for every write operation.
"""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter


# ---------------------------------------------------------------------------
# CDC tasks (8 endpoints)
# ---------------------------------------------------------------------------
def test_list_cdc_tasks(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(t["tenant_id"] == "tenant-acme" for t in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())


def test_list_cdc_tasks_status_filter(client, auth_headers_acme) -> None:
    # Pause one task, then filter by status=paused.
    tasks = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme).json()["items"]
    first_id = tasks[0]["id"]
    client.post(f"/api/v1/data/cdc-tasks/{first_id}/pause", headers=auth_headers_acme)

    r = client.get(
        "/api/v1/data/cdc-tasks", params={"status": "paused"}, headers=auth_headers_acme
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert all(t["status"] == "paused" for t in body["items"])


def test_create_cdc_task(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/data/cdc-tasks",
        json={
            "name": "New Orders Sync",
            "source_id": "src-mysql-orders",
            "target_table": "ods_new_orders",
            "config": {"mode": "bulk"},
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"].startswith("cdc-")
    assert body["status"] == "running"
    assert body["tenant_id"] == "tenant-acme"
    assert body["config"] == {"mode": "bulk"}

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.cdc_task.created" in types, types


def test_get_cdc_task(client, auth_headers_acme) -> None:
    tasks = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme).json()["items"]
    task_id = tasks[0]["id"]

    r = client.get(f"/api/v1/data/cdc-tasks/{task_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["id"] == task_id
    assert detail["tenant_id"] == "tenant-acme"


def test_get_cdc_task_404(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/data/cdc-tasks/missing-id", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


def test_update_cdc_task(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme).json()["items"]
    task_id = tasks[0]["id"]

    r = client.put(
        f"/api/v1/data/cdc-tasks/{task_id}",
        json={"name": "Renamed Sync", "target_table": "ods_renamed"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Renamed Sync"
    assert body["target_table"] == "ods_renamed"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.cdc_task.updated" in types, types


def test_delete_cdc_task(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme).json()["items"]
    task_id = tasks[0]["id"]

    r = client.delete(f"/api/v1/data/cdc-tasks/{task_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json() == {"deleted": True, "id": task_id}

    # Confirm it's gone.
    r2 = client.get(f"/api/v1/data/cdc-tasks/{task_id}", headers=auth_headers_acme)
    assert r2.status_code == 404

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.cdc_task.deleted" in types, types


def test_pause_cdc_task(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme).json()["items"]
    task_id = tasks[0]["id"]

    r = client.post(f"/api/v1/data/cdc-tasks/{task_id}/pause", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json() == {"id": task_id, "status": "paused"}

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.cdc_task.paused" in types, types


def test_resume_cdc_task(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme).json()["items"]
    task_id = tasks[0]["id"]
    # Pause first, then resume.
    client.post(f"/api/v1/data/cdc-tasks/{task_id}/pause", headers=auth_headers_acme)
    outbox._records.clear()

    r = client.post(f"/api/v1/data/cdc-tasks/{task_id}/resume", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json() == {"id": task_id, "status": "running"}

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.cdc_task.resumed" in types, types


def test_cdc_task_status(client, auth_headers_acme) -> None:
    tasks = client.get("/api/v1/data/cdc-tasks", headers=auth_headers_acme).json()["items"]
    task_id = tasks[0]["id"]

    r = client.get(f"/api/v1/data/cdc-tasks/{task_id}/status", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == task_id
    assert body["status"] == "running"


# ---------------------------------------------------------------------------
# Data sources (7 endpoints)
# ---------------------------------------------------------------------------
def test_list_sources(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/data/sources", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(s["tenant_id"] == "tenant-acme" for s in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())


def test_list_sources_type_filter(client, auth_headers_acme) -> None:
    r = client.get(
        "/api/v1/data/sources", params={"type": "mysql"}, headers=auth_headers_acme
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert all(s["type"] == "mysql" for s in body["items"])


def test_create_source(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/data/sources",
        json={
            "name": "New MongoDB",
            "type": "mongodb",
            "connection_config": {"uri": "mongodb://example.com:27017"},
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"].startswith("src-")
    assert body["type"] == "mongodb"
    assert body["tenant_id"] == "tenant-acme"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.source.created" in types, types


def test_get_source(client, auth_headers_acme) -> None:
    sources = client.get("/api/v1/data/sources", headers=auth_headers_acme).json()["items"]
    source_id = sources[0]["id"]

    r = client.get(f"/api/v1/data/sources/{source_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["id"] == source_id
    assert detail["tenant_id"] == "tenant-acme"


def test_get_source_404(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/data/sources/missing-id", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


def test_update_source(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    sources = client.get("/api/v1/data/sources", headers=auth_headers_acme).json()["items"]
    source_id = sources[0]["id"]

    r = client.put(
        f"/api/v1/data/sources/{source_id}",
        json={"name": "Renamed Source"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Renamed Source"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.source.updated" in types, types


def test_delete_source(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    sources = client.get("/api/v1/data/sources", headers=auth_headers_acme).json()["items"]
    source_id = sources[0]["id"]

    r = client.delete(f"/api/v1/data/sources/{source_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json() == {"deleted": True, "id": source_id}

    r2 = client.get(f"/api/v1/data/sources/{source_id}", headers=auth_headers_acme)
    assert r2.status_code == 404

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.source.deleted" in types, types


def test_source_schema(client, auth_headers_acme) -> None:
    sources = client.get("/api/v1/data/sources", headers=auth_headers_acme).json()["items"]
    source_id = sources[0]["id"]

    r = client.get(f"/api/v1/data/sources/{source_id}/schema", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source_id"] == source_id
    assert isinstance(body["tables"], list)
    assert len(body["tables"]) >= 1
    first_table = body["tables"][0]
    assert "name" in first_table
    assert "columns" in first_table


def test_source_schema_404(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/data/sources/missing-id/schema", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


def test_test_source_connection(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    sources = client.get("/api/v1/data/sources", headers=auth_headers_acme).json()["items"]
    source_id = sources[0]["id"]

    r = client.post(f"/api/v1/data/sources/{source_id}/test", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source_id"] == source_id
    assert body["ok"] is True
    assert body["latency_ms"] >= 1
    assert body["error"] == ""

    types = {rec.event.type for rec in outbox.all_records()}
    assert "data.source.tested" in types, types


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
def test_health_anonymous_ok(client) -> None:
    r = client.get("/api/v1/data/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}
