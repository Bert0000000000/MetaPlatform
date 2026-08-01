"""BUSINESS-SLICES deep tests for mate-tech-dw.

Covers the P0 business logic added in the second batch:
  - Task orchestration + lifecycle state machine (pending -> running -> success/failed)
  - Evaluation scoring (pass/fail threshold + letter grades A/B/C/D)
  - Learning feedback loop (needs_retrain flag based on rating)
  - Collaboration session management (self-collab / offline guards)
  - Outbox event emission (dw.task.created / status_changed / evaluation.submitted / ...)
  - Cross-tenant isolation
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_tech_dw.main import create_app
from mate_tech_dw.repositories import in_memory as in_memory_repo


@pytest.fixture
def outbox() -> InMemoryOutboxWriter:
    return InMemoryOutboxWriter()


@pytest.fixture
def client(outbox: InMemoryOutboxWriter) -> TestClient:
    """Per-test TestClient with fresh store + outbox wired."""
    in_memory_repo.reset_store()
    app = create_app()
    app.state.outbox_writer = outbox
    yield TestClient(app)
    in_memory_repo.reset_store()


# ---------------------------------------------------------------------------
# Task orchestration: create
# ---------------------------------------------------------------------------
def test_create_task_for_active_employee(client, auth_headers_acme) -> None:
    """POST /employees/{id}/tasks creates a pending task for an active employee."""
    r = client.post(
        "/api/v1/dw/employees/dw-emp-1/tasks",
        json={"title": "Handle customer inquiry"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["employee_id"] == "dw-emp-1"
    assert body["title"] == "Handle customer inquiry"


def test_create_task_for_offline_employee_rejected(client, auth_headers_acme) -> None:
    """POST /employees/{id}/tasks for an offline employee -> 409."""
    r = client.post(
        "/api/v1/dw/employees/dw-emp-5/tasks",
        json={"title": "Should fail"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text
    assert "offline" in r.json()["detail"]


def test_create_task_unknown_employee(client, auth_headers_acme) -> None:
    """POST /employees/{id}/tasks with unknown employee -> 404."""
    r = client.post(
        "/api/v1/dw/employees/nope/tasks",
        json={"title": "Ghost"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_create_task_emits_outbox(client, auth_headers_acme, outbox) -> None:
    """POST /employees/{id}/tasks emits dw.task.created."""
    client.post(
        "/api/v1/dw/employees/dw-emp-1/tasks",
        json={"title": "Outbox task"},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    created = [e for e in events if e.type == "dw.task.created"]
    assert len(created) >= 1
    assert created[0].tenant_id == "tenant-acme"


# ---------------------------------------------------------------------------
# Task lifecycle state machine
# ---------------------------------------------------------------------------
def _create_task(client, headers, employee_id="dw-emp-1", title="Test task"):
    """Helper: create a task and return its id."""
    r = client.post(
        f"/api/v1/dw/employees/{employee_id}/tasks",
        json={"title": title},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_transition_pending_to_running(client, auth_headers_acme) -> None:
    """pending -> running succeeds."""
    task_id = _create_task(client, auth_headers_acme)
    r = client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "running"


def test_transition_running_to_success(client, auth_headers_acme) -> None:
    """running -> success sets finished_at and duration."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "success", "duration_ms": 5000},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "success"
    assert r.json()["finished_at"] is not None
    assert r.json()["duration_ms"] == 5000


def test_transition_running_to_failed(client, auth_headers_acme) -> None:
    """running -> failed sets finished_at."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "failed"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "failed"
    assert r.json()["finished_at"] is not None


def test_transition_failed_to_running_retry(client, auth_headers_acme) -> None:
    """failed -> running succeeds (retry)."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "failed"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "running"


def test_transition_success_is_terminal(client, auth_headers_acme) -> None:
    """success -> running is not a valid transition (409)."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "success"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text


def test_transition_invalid_path(client, auth_headers_acme) -> None:
    """pending -> success is not a valid transition (409)."""
    task_id = _create_task(client, auth_headers_acme)
    r = client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "success"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text
    assert "invalid transition" in r.json()["detail"]


def test_transition_wrong_employee(client, auth_headers_acme) -> None:
    """Transition a task with wrong employee_id -> 404."""
    task_id = _create_task(client, auth_headers_acme, employee_id="dw-emp-1")
    r = client.patch(
        f"/api/v1/dw/employees/dw-emp-2/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_transition_unknown_task(client, auth_headers_acme) -> None:
    """PATCH /employees/{id}/tasks/{tid}/status with unknown task -> 404."""
    r = client.patch(
        "/api/v1/dw/employees/dw-emp-1/tasks/nope/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_transition_emits_outbox(client, auth_headers_acme, outbox) -> None:
    """PATCH /tasks/{tid}/status emits dw.task.status_changed."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    changed = [e for e in events if e.type == "dw.task.status_changed"]
    assert len(changed) >= 1
    assert changed[0].payload["from"] == "pending"
    assert changed[0].payload["to"] == "running"


# ---------------------------------------------------------------------------
# Evaluation scoring
# ---------------------------------------------------------------------------
def test_evaluation_pass(client, auth_headers_acme) -> None:
    """Score >= 60 -> passed=True, grade C."""
    r = client.post(
        "/api/v1/dw/employees/dw-emp-1/evaluations",
        json={"qa_set_id": "qa-1", "score": 65.0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["passed"] is True
    assert body["grade"] == "C"


def test_evaluation_fail(client, auth_headers_acme) -> None:
    """Score < 60 -> passed=False, grade D."""
    r = client.post(
        "/api/v1/dw/employees/dw-emp-1/evaluations",
        json={"qa_set_id": "qa-1", "score": 45.0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["passed"] is False
    assert body["grade"] == "D"


def test_evaluation_grade_a(client, auth_headers_acme) -> None:
    """Score >= 90 -> grade A."""
    r = client.post(
        "/api/v1/dw/employees/dw-emp-1/evaluations",
        json={"qa_set_id": "qa-1", "score": 95.0},
        headers=auth_headers_acme,
    )
    assert r.json()["grade"] == "A"


def test_evaluation_grade_b(client, auth_headers_acme) -> None:
    """Score >= 80 -> grade B."""
    r = client.post(
        "/api/v1/dw/employees/dw-emp-1/evaluations",
        json={"qa_set_id": "qa-1", "score": 85.0},
        headers=auth_headers_acme,
    )
    assert r.json()["grade"] == "B"


def test_evaluation_boundary_60(client, auth_headers_acme) -> None:
    """Score exactly 60 -> passed=True, grade C (boundary)."""
    r = client.post(
        "/api/v1/dw/employees/dw-emp-1/evaluations",
        json={"qa_set_id": "qa-1", "score": 60.0},
        headers=auth_headers_acme,
    )
    assert r.json()["passed"] is True
    assert r.json()["grade"] == "C"


def test_evaluation_unknown_employee(client, auth_headers_acme) -> None:
    """POST /employees/{id}/evaluations with unknown employee -> 404."""
    r = client.post(
        "/api/v1/dw/employees/nope/evaluations",
        json={"qa_set_id": "qa-1", "score": 80.0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_evaluation_emits_outbox(client, auth_headers_acme, outbox) -> None:
    """POST /employees/{id}/evaluations emits dw.evaluation.submitted."""
    client.post(
        "/api/v1/dw/employees/dw-emp-1/evaluations",
        json={"qa_set_id": "qa-1", "score": 90.0},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    submitted = [e for e in events if e.type == "dw.evaluation.submitted"]
    assert len(submitted) >= 1
    assert submitted[0].payload["grade"] == "A"


# ---------------------------------------------------------------------------
# Learning feedback loop
# ---------------------------------------------------------------------------
def test_feedback_low_rating_needs_retrain(client, auth_headers_acme) -> None:
    """Rating <= 2 -> needs_retrain=True."""
    r = client.post(
        "/api/v1/dw/learning/feedback",
        json={"employee_id": "dw-emp-1", "scenario": "cs-refund",
              "rating": 2, "comment": "poor"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    assert r.json()["needs_retrain"] is True


def test_feedback_high_rating_stable(client, auth_headers_acme) -> None:
    """Rating >= 4 -> needs_retrain=False."""
    r = client.post(
        "/api/v1/dw/learning/feedback",
        json={"employee_id": "dw-emp-1", "scenario": "cs-refund",
              "rating": 5, "comment": "great"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    assert r.json()["needs_retrain"] is False


def test_feedback_unknown_employee(client, auth_headers_acme) -> None:
    """POST /learning/feedback with unknown employee -> 404."""
    r = client.post(
        "/api/v1/dw/learning/feedback",
        json={"employee_id": "nope", "scenario": "x",
              "rating": 3, "comment": ""},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_feedback_emits_outbox(client, auth_headers_acme, outbox) -> None:
    """POST /learning/feedback emits dw.feedback.submitted."""
    client.post(
        "/api/v1/dw/learning/feedback",
        json={"employee_id": "dw-emp-1", "scenario": "cs-refund",
              "rating": 1, "comment": "bad"},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    submitted = [e for e in events if e.type == "dw.feedback.submitted"]
    assert len(submitted) >= 1
    assert submitted[0].payload["needs_retrain"] is True


# ---------------------------------------------------------------------------
# Collaboration session management
# ---------------------------------------------------------------------------
def test_collaboration_success(client, auth_headers_acme) -> None:
    """POST /collaborations succeeds when both employees exist and one is active."""
    r = client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": "dw-emp-1", "peer_employee_id": "dw-emp-2",
              "duration_ms": 60000},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["employee_id"] == "dw-emp-1"
    assert body["peer_employee_id"] == "dw-emp-2"
    assert body["session_id"].startswith("sess-")


def test_collaboration_self_rejected(client, auth_headers_acme) -> None:
    """POST /collaborations with same employee_id -> 422."""
    r = client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": "dw-emp-1", "peer_employee_id": "dw-emp-1",
              "duration_ms": 0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text
    assert "self-collaboration" in r.json()["detail"]


def test_collaboration_unknown_employee(client, auth_headers_acme) -> None:
    """POST /collaborations with unknown employee -> 404."""
    r = client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": "nope", "peer_employee_id": "dw-emp-2",
              "duration_ms": 0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_collaboration_unknown_peer(client, auth_headers_acme) -> None:
    """POST /collaborations with unknown peer -> 404."""
    r = client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": "dw-emp-1", "peer_employee_id": "nope",
              "duration_ms": 0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_collaboration_emits_outbox(client, auth_headers_acme, outbox) -> None:
    """POST /collaborations emits dw.collaboration.started."""
    client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": "dw-emp-1", "peer_employee_id": "dw-emp-3",
              "duration_ms": 30000},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    started = [e for e in events if e.type == "dw.collaboration.started"]
    assert len(started) >= 1


# ---------------------------------------------------------------------------
# Cross-tenant isolation
# ---------------------------------------------------------------------------
def test_task_tenant_isolation(client, auth_headers_acme, auth_headers_globex) -> None:
    """Tenant A's tasks are invisible to tenant B."""
    # Tenant acme creates a task.
    r_acme = client.post(
        "/api/v1/dw/employees/dw-emp-1/tasks",
        json={"title": "Acme task"},
        headers=auth_headers_acme,
    )
    assert r_acme.status_code == 201
    acme_task_id = r_acme.json()["id"]

    # Tenant globex lists tasks — must not see acme's task.
    r_globex = client.get(
        "/api/v1/dw/employees/tasks", headers=auth_headers_globex,
    )
    assert r_globex.status_code == 200
    globex_task_ids = {t["id"] for t in r_globex.json()["items"]}
    assert acme_task_id not in globex_task_ids


def test_task_transition_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    """Tenant B cannot transition tenant A's task."""
    r_acme = client.post(
        "/api/v1/dw/employees/dw-emp-1/tasks",
        json={"title": "Acme protected"},
        headers=auth_headers_acme,
    )
    task_id = r_acme.json()["id"]

    # Globex tries to transition acme's task — task belongs to acme's
    # tenant store, so globex's get_employee_task returns None -> 404.
    r_globex = client.patch(
        f"/api/v1/dw/employees/dw-emp-1/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_globex,
    )
    assert r_globex.status_code == 404
