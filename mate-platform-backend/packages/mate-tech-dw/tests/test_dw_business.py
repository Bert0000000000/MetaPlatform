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

# Tenant-scoped employee id constants (matches seed _emp_id)
ACME_E1 = "dw-emp-acme-1"
ACME_E2 = "dw-emp-acme-2"
ACME_E3 = "dw-emp-acme-3"
ACME_E4 = "dw-emp-acme-4"
ACME_E5 = "dw-emp-acme-5"
ACME_E6 = "dw-emp-acme-6"
ACME_E7 = "dw-emp-acme-7"
GLOBEX_E1 = "dw-emp-globex-1"
GLOBEX_E2 = "dw-emp-globex-2"

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
        f"/api/v1/dw/employees/{ACME_E1}/tasks",
        json={"title": "Handle customer inquiry"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["status"] == "pending"
    assert body["employee_id"] == ACME_E1
    assert body["title"] == "Handle customer inquiry"


def test_create_task_for_offline_employee_rejected(client, auth_headers_acme) -> None:
    """POST /employees/{id}/tasks for an offline employee -> 409."""
    r = client.post(
        f"/api/v1/dw/employees/{ACME_E5}/tasks",
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
        f"/api/v1/dw/employees/{ACME_E1}/tasks",
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
def _create_task(client, headers, employee_id=ACME_E1, title="Test task"):
    """Helper: create a task and return its id."""
    r = client.post(
        f"/api/v1/dw/employees/{employee_id}/tasks",
        json={"title": title},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]["id"]


def test_transition_pending_to_running(client, auth_headers_acme) -> None:
    """pending -> running succeeds."""
    task_id = _create_task(client, auth_headers_acme)
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "running"


def test_transition_running_to_success(client, auth_headers_acme) -> None:
    """running -> success sets finished_at and duration."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
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
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
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
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "failed"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "running"


def test_transition_success_is_terminal(client, auth_headers_acme) -> None:
    """success -> running is not a valid transition (409)."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "success"},
        headers=auth_headers_acme,
    )
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text


def test_transition_invalid_path(client, auth_headers_acme) -> None:
    """pending -> success is not a valid transition (409)."""
    task_id = _create_task(client, auth_headers_acme)
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "success"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text
    assert "invalid transition" in r.json()["detail"]


def test_transition_wrong_employee(client, auth_headers_acme) -> None:
    """Transition a task with wrong employee_id -> 404."""
    task_id = _create_task(client, auth_headers_acme, employee_id=ACME_E1)
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E2}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_transition_unknown_task(client, auth_headers_acme) -> None:
    """PATCH /employees/{id}/tasks/{tid}/status with unknown task -> 404."""
    r = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/nope/status",
        json={"status": "running"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_transition_emits_outbox(client, auth_headers_acme, outbox) -> None:
    """PATCH /tasks/{tid}/status emits dw.task.status_changed."""
    task_id = _create_task(client, auth_headers_acme)
    client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
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
        f"/api/v1/dw/employees/{ACME_E1}/evaluations",
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
        f"/api/v1/dw/employees/{ACME_E1}/evaluations",
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
        f"/api/v1/dw/employees/{ACME_E1}/evaluations",
        json={"qa_set_id": "qa-1", "score": 95.0},
        headers=auth_headers_acme,
    )
    assert r.json()["grade"] == "A"


def test_evaluation_grade_b(client, auth_headers_acme) -> None:
    """Score >= 80 -> grade B."""
    r = client.post(
        f"/api/v1/dw/employees/{ACME_E1}/evaluations",
        json={"qa_set_id": "qa-1", "score": 85.0},
        headers=auth_headers_acme,
    )
    assert r.json()["grade"] == "B"


def test_evaluation_boundary_60(client, auth_headers_acme) -> None:
    """Score exactly 60 -> passed=True, grade C (boundary)."""
    r = client.post(
        f"/api/v1/dw/employees/{ACME_E1}/evaluations",
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
        f"/api/v1/dw/employees/{ACME_E1}/evaluations",
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
        json={"employee_id": ACME_E1, "scenario": "cs-refund",
              "rating": 2, "comment": "poor"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    assert r.json()["needs_retrain"] is True


def test_feedback_high_rating_stable(client, auth_headers_acme) -> None:
    """Rating >= 4 -> needs_retrain=False."""
    r = client.post(
        "/api/v1/dw/learning/feedback",
        json={"employee_id": ACME_E1, "scenario": "cs-refund",
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
        json={"employee_id": ACME_E1, "scenario": "cs-refund",
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
        json={"employee_id": ACME_E1, "peer_employee_id": ACME_E2,
              "duration_ms": 60000},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["employee_id"] == ACME_E1
    assert body["peer_employee_id"] == ACME_E2
    assert body["session_id"].startswith("sess-")


def test_collaboration_self_rejected(client, auth_headers_acme) -> None:
    """POST /collaborations with same employee_id -> 422."""
    r = client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": ACME_E1, "peer_employee_id": ACME_E1,
              "duration_ms": 0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text
    assert "self-collaboration" in r.json()["detail"]


def test_collaboration_unknown_employee(client, auth_headers_acme) -> None:
    """POST /collaborations with unknown employee -> 404."""
    r = client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": "nope", "peer_employee_id": ACME_E2,
              "duration_ms": 0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_collaboration_unknown_peer(client, auth_headers_acme) -> None:
    """POST /collaborations with unknown peer -> 404."""
    r = client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": ACME_E1, "peer_employee_id": "nope",
              "duration_ms": 0},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_collaboration_emits_outbox(client, auth_headers_acme, outbox) -> None:
    """POST /collaborations emits dw.collaboration.started."""
    client.post(
        "/api/v1/dw/collaborations",
        json={"employee_id": ACME_E1, "peer_employee_id": ACME_E3,
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
        f"/api/v1/dw/employees/{ACME_E1}/tasks",
        json={"title": "Acme task"},
        headers=auth_headers_acme,
    )
    assert r_acme.status_code == 201
    acme_task_id = r_acme.json()["data"]["id"]

    # Tenant globex lists tasks — must not see acme's task.
    r_globex = client.get(
        "/api/v1/dw/employees/tasks", headers=auth_headers_globex,
    )
    assert r_globex.status_code == 200
    globex_task_ids = {t["id"] for t in r_globex.json()["data"]["items"]}
    assert acme_task_id not in globex_task_ids


def test_task_transition_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    """Tenant B cannot transition tenant A's task."""
    r_acme = client.post(
        f"/api/v1/dw/employees/{ACME_E1}/tasks",
        json={"title": "Acme protected"},
        headers=auth_headers_acme,
    )
    task_id = r_acme.json()["data"]["id"]

    # Globex tries to transition acme's task — task belongs to acme's
    # tenant store, so globex's get_employee_task returns None -> 404.
    r_globex = client.patch(
        f"/api/v1/dw/employees/{ACME_E1}/tasks/{task_id}/status",
        json={"status": "running"},
        headers=auth_headers_globex,
    )
    assert r_globex.status_code == 404


# ---------------------------------------------------------------------------
# System prompt wiring (kernel SYSTEM_PROMPTS 单一数据源)
# ---------------------------------------------------------------------------
_KERNEL_EMPLOYEES: tuple[tuple[str, str, str], ...] = (
    ("EMP-ONT-001", "ontology", "本体员工"),
    ("EMP-WF-001", "workflow", "工作流员工"),
    ("EMP-APP-001", "app", "应用员工"),
    ("EMP-DATA-001", "data_product", "数据产品员工"),
    ("EMP-OBS-001", "obs", "可观测员工"),
    ("EMP-SEC-001", "security", "安全员工"),
    ("EMP-KB-001", "knowledge", "知识库员工"),
)


def _get_employee(client, headers, key: str) -> dict:
    r = client.get("/api/v1/dw/employees", headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()["data"]["items"]
    for emp in items:
        if emp["code"] == key or emp["employeeId"] == key:
            return emp
    raise AssertionError(f"employee not found: {key}")


def test_builtin_employees_all_return_kernel_prompt(client, auth_headers_acme) -> None:
    """7 个内置员工均返回 kernel SYSTEM_PROMPTS 身份 prompt（单一数据源）。"""
    for code, role_slug, identity_label in _KERNEL_EMPLOYEES:
        emp = _get_employee(client, auth_headers_acme, code)
        prompt = emp["capability"]["systemPrompt"]
        assert identity_label in prompt, (
            f"{code} (role={role_slug}) missing identity label {identity_label!r}; "
            f"got prompt head: {prompt[:60]}"
        )
        assert emp["roleCategory"] == role_slug.upper()


def test_builtin_prompts_differ_per_role(client, auth_headers_acme) -> None:
    """7 个 prompt 彼此不同（验证从 kernel 取值、未被简化）。"""
    prompts = {
        code: _get_employee(client, auth_headers_acme, code)["capability"]["systemPrompt"]
        for code, _, _ in _KERNEL_EMPLOYEES
    }
    assert len(set(prompts.values())) == len(prompts), "prompts should be role-specific"


def test_custom_employee_prompt_persists(client, auth_headers_acme) -> None:
    """新建员工保存 systemPrompt 后，查询能读回；自定义角色不返回 kernel prompt。"""
    r = client.post(
        "/api/v1/dw/employees",
        headers=auth_headers_acme,
        json={
            "name": "测试助手",
            "roleCategory": "CUSTOM",
            "roleIdentity": "TEST_HELPER",
            "capability": {"model": "model-openai", "systemPrompt": "你是测试助手。"},
        },
    )
    assert r.status_code == 201, r.text
    emp = r.json()["data"]
    assert emp["capability"]["systemPrompt"] == "你是测试助手。"

    # 更新 prompt 后能读回新值
    r2 = client.put(
        f"/api/v1/dw/employees/{emp['employeeId']}",
        headers=auth_headers_acme,
        json={
            "name": "测试助手",
            "roleCategory": "CUSTOM",
            "roleIdentity": "TEST_HELPER",
            "capability": {"model": "model-openai", "systemPrompt": "新提示词"},
        },
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["data"]["capability"]["systemPrompt"] == "新提示词"