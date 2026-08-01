"""Happy-path tests for mate-tech-etl (FR-DATA-ETL-001..008).

Every test exercises one endpoint end-to-end through the FastAPI
TestClient, asserting the documented response shape + status code.
Outbox events are captured via the shared `outbox` fixture.
"""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
def test_health_anonymous(client: TestClient) -> None:
    r = client.get("/api/v1/etl/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# 1. GET /tasks — list
# ---------------------------------------------------------------------------
def test_list_etl_tasks(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    r = client.get("/api/v1/etl/tasks", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(t["tenant_id"] == "tenant-acme" for t in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())


def test_list_etl_tasks_status_filter(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/etl/tasks", params={"status": "idle"}, headers=auth_headers_acme
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert all(t["status"] == "idle" for t in body["items"])


# ---------------------------------------------------------------------------
# 2. POST /tasks — create
# ---------------------------------------------------------------------------
def test_create_etl_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/etl/tasks",
        json={
            "name": "New Orders ETL",
            "source_table": "ods_orders",
            "target_table": "dwd_orders",
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"].startswith("etl-")
    assert body["status"] == "idle"
    assert body["tenant_id"] == "tenant-acme"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "etl.task.created" in types, types


# ---------------------------------------------------------------------------
# 3. GET /tasks/{id} — detail
# ---------------------------------------------------------------------------
def test_get_etl_task(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    tasks = client.get(
        "/api/v1/etl/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.get(f"/api/v1/etl/tasks/{task_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == task_id
    assert "source_table" in body
    assert "target_table" in body


def test_get_etl_task_not_found(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get("/api/v1/etl/tasks/nonexistent", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# 4. PUT /tasks/{id} — update
# ---------------------------------------------------------------------------
def test_update_etl_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/etl/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.put(
        f"/api/v1/etl/tasks/{task_id}",
        json={"name": "Updated Name"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Updated Name"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "etl.task.updated" in types, types


# ---------------------------------------------------------------------------
# 5. DELETE /tasks/{id} — delete
# ---------------------------------------------------------------------------
def test_delete_etl_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/etl/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.delete(f"/api/v1/etl/tasks/{task_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] is True

    types = {rec.event.type for rec in outbox.all_records()}
    assert "etl.task.deleted" in types, types

    # Verify gone
    r2 = client.get(f"/api/v1/etl/tasks/{task_id}", headers=auth_headers_acme)
    assert r2.status_code == 404


# ---------------------------------------------------------------------------
# 6. POST /tasks/{id}/run — run
# ---------------------------------------------------------------------------
def test_run_etl_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/etl/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.post(f"/api/v1/etl/tasks/{task_id}/run", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "running"
    assert body["last_run_at"] != ""

    types = {rec.event.type for rec in outbox.all_records()}
    assert "etl.task.run" in types, types


# ---------------------------------------------------------------------------
# 7. GET /tasks/{id}/status — status
# ---------------------------------------------------------------------------
def test_get_etl_task_status(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    tasks = client.get(
        "/api/v1/etl/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.get(f"/api/v1/etl/tasks/{task_id}/status", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["task_id"] == task_id
    assert "status" in body
    assert "last_run_at" in body


# ---------------------------------------------------------------------------
# 8. POST /tasks/{id}/stop — stop
# ---------------------------------------------------------------------------
def test_stop_etl_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/etl/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    # Run first, then stop
    client.post(f"/api/v1/etl/tasks/{task_id}/run", headers=auth_headers_acme)

    r = client.post(f"/api/v1/etl/tasks/{task_id}/stop", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "stopped"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "etl.task.stopped" in types, types


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------
def test_pagination(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/etl/tasks",
        params={"page": 1, "size": 2},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["items"]) <= 2
    assert body["size"] == 2
    assert body["page"] == 1
