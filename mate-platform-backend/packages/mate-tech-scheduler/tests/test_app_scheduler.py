"""Happy-path tests for mate-tech-scheduler (FR-DATA-SCHEDULER-001..008).

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
    r = client.get("/api/v1/scheduler/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# 1. GET /tasks — list
# ---------------------------------------------------------------------------
def test_list_scheduler_tasks(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get("/api/v1/scheduler/tasks", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(t["tenant_id"] == "tenant-acme" for t in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())


def test_list_scheduler_tasks_status_filter(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/scheduler/tasks",
        params={"status": "active"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert all(t["status"] == "active" for t in body["items"])


# ---------------------------------------------------------------------------
# 2. POST /tasks — create
# ---------------------------------------------------------------------------
def test_create_scheduler_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/scheduler/tasks",
        json={
            "name": "New Hourly Rollup",
            "cron_expression": "0 * * * *",
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"].startswith("sch-")
    assert body["status"] == "active"
    assert body["tenant_id"] == "tenant-acme"
    assert body["cron_expression"] == "0 * * * *"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "scheduler.task.created" in types, types


# ---------------------------------------------------------------------------
# 3. GET /tasks/{id} — detail
# ---------------------------------------------------------------------------
def test_get_scheduler_task(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    tasks = client.get(
        "/api/v1/scheduler/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.get(f"/api/v1/scheduler/tasks/{task_id}", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == task_id
    assert "cron_expression" in body
    assert "last_run_at" in body


def test_get_scheduler_task_not_found(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/scheduler/tasks/nonexistent", headers=auth_headers_acme
    )
    assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# 4. PUT /tasks/{id} — update
# ---------------------------------------------------------------------------
def test_update_scheduler_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/scheduler/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.put(
        f"/api/v1/scheduler/tasks/{task_id}",
        json={"name": "Updated Name", "cron_expression": "30 * * * *"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Updated Name"
    assert body["cron_expression"] == "30 * * * *"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "scheduler.task.updated" in types, types


# ---------------------------------------------------------------------------
# 5. DELETE /tasks/{id} — delete
# ---------------------------------------------------------------------------
def test_delete_scheduler_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/scheduler/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.delete(
        f"/api/v1/scheduler/tasks/{task_id}", headers=auth_headers_acme
    )
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] is True

    types = {rec.event.type for rec in outbox.all_records()}
    assert "scheduler.task.deleted" in types, types

    # Verify gone
    r2 = client.get(
        f"/api/v1/scheduler/tasks/{task_id}", headers=auth_headers_acme
    )
    assert r2.status_code == 404


# ---------------------------------------------------------------------------
# 6. POST /tasks/{id}/pause — pause
# ---------------------------------------------------------------------------
def test_pause_scheduler_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/scheduler/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.post(
        f"/api/v1/scheduler/tasks/{task_id}/pause", headers=auth_headers_acme
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "paused"

    types = {rec.event.type for rec in outbox.all_records()}
    assert "scheduler.task.paused" in types, types


# ---------------------------------------------------------------------------
# 7. POST /tasks/{id}/trigger — manual trigger
# ---------------------------------------------------------------------------
def test_trigger_scheduler_task(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    tasks = client.get(
        "/api/v1/scheduler/tasks", headers=auth_headers_acme
    ).json()["items"]
    task_id = tasks[0]["id"]

    r = client.post(
        f"/api/v1/scheduler/tasks/{task_id}/trigger", headers=auth_headers_acme
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "running"
    assert body["last_run_at"] != ""

    types = {rec.event.type for rec in outbox.all_records()}
    assert "scheduler.task.triggered" in types, types


# ---------------------------------------------------------------------------
# 8. GET /dag — DAG graph
# ---------------------------------------------------------------------------
def test_get_dag(client: TestClient, auth_headers_acme: dict[str, str]) -> None:
    r = client.get("/api/v1/scheduler/dag", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    assert len(body) >= 3, body
    # Verify node shape
    node = body[0]
    assert {"task_id", "name", "upstream", "downstream"} <= set(node.keys())
    # The metrics-rollup node should have upstream dependencies
    rollup = [n for n in body if n["task_id"] == "sch-metrics-rollup"]
    assert rollup, body
    assert len(rollup[0]["upstream"]) == 2


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------
def test_pagination(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    r = client.get(
        "/api/v1/scheduler/tasks",
        params={"page": 1, "size": 2},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["items"]) <= 2
    assert body["size"] == 2
    assert body["page"] == 1
