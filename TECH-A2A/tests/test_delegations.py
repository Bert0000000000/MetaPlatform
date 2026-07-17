"""Tests for Task Delegation endpoints (P3-A2A-05/07/08/15)."""

from __future__ import annotations

from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"

DELEGATE_BODY = {
    "sourceAgentId": "internal-agent-001",
    "targetAgentId": "ext-agent-002",
    "taskType": "data-processing",
    "payload": {"input": "process this data", "format": "json"},
    "timeout": 60.0,
    "callbackUrl": "http://callback.example.com/api",
}


async def test_delegate_task_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["sourceAgentId"] == "internal-agent-001"
    assert data["targetAgentId"] == "ext-agent-002"
    assert data["taskType"] == "data-processing"
    assert data["taskId"].startswith("task-")
    # Mock mode returns COMPLETED
    assert data["status"] == "COMPLETED"
    assert data["result"] is not None
    assert data["timeout"] == 60.0
    assert data["callbackUrl"] == "http://callback.example.com/api"


async def test_list_tasks_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    for i in range(3):
        body = dict(DELEGATE_BODY)
        body["sourceAgentId"] = f"agent-{i}"
        resp = await client.post(f"{BASE}/tasks", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/tasks", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3


async def test_get_task_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["taskId"] == task_id


async def test_get_task_status_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/status", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "COMPLETED"


async def test_get_task_result_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/result", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["result"] is not None


async def test_cancel_completed_task_fails(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    # Mock mode completes immediately, so cancel should fail
    resp = await client.post(f"{BASE}/tasks/{task_id}/cancel", headers=tenant_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == int(ErrorCode.TASK_ALREADY_COMPLETED)


async def test_status_history_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/status-history", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 2
    assert data[0]["status"] == "PENDING"


async def test_artifacts_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.get(f"{BASE}/tasks/{task_id}/artifacts", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_update_timeout_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/tasks", json=DELEGATE_BODY, headers=tenant_headers)
    task_id = resp.json()["data"]["taskId"]

    resp = await client.put(
        f"{BASE}/tasks/{task_id}/timeout",
        json={"timeout": 120.0},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["timeout"] == 120.0


async def test_task_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.get(f"{BASE}/tasks/task-nonexistent", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.TASK_NOT_FOUND)
