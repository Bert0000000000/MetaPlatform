"""Task management API tests (P2-AGT-14/15)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/agent"

CREATE_TASK_BODY = {
    "agentId": "agt-001",
    "title": "测试任务",
    "description": "用于测试的任务",
    "priority": "HIGH",
    "input": {"query": "test"},
}


async def _create_task(
    client: AsyncClient, headers: dict, **overrides
) -> str:
    body = dict(CREATE_TASK_BODY)
    body.update(overrides)
    resp = await client.post(f"{BASE}/tasks", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["taskId"]


async def test_create_task_api(client: AsyncClient, tenant_headers: dict):
    resp = await client.post(
        f"{BASE}/tasks", json=CREATE_TASK_BODY, headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["taskId"].startswith("task-")
    assert data["title"] == "测试任务"
    assert data["status"] == "PENDING"
    assert data["priority"] == "HIGH"


async def test_list_tasks_api(client: AsyncClient, tenant_headers: dict):
    await _create_task(client, tenant_headers, title="任务1")
    await _create_task(client, tenant_headers, title="任务2")

    resp = await client.get(f"{BASE}/tasks", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2


async def test_get_task_api(client: AsyncClient, tenant_headers: dict):
    task_id = await _create_task(client, tenant_headers)

    resp = await client.get(f"{BASE}/tasks/{task_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["taskId"] == task_id


async def test_assign_task_api(client: AsyncClient, tenant_headers: dict):
    task_id = await _create_task(client, tenant_headers)

    resp = await client.post(
        f"{BASE}/tasks/{task_id}/assign",
        json={"assignedTo": "user-001"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "ASSIGNED"
    assert data["assignedTo"] == "user-001"


async def test_update_task_status_api(client: AsyncClient, tenant_headers: dict):
    task_id = await _create_task(client, tenant_headers)

    resp = await client.patch(
        f"{BASE}/tasks/{task_id}/status",
        json={"status": "COMPLETED", "output": {"result": "done"}},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["output"]["result"] == "done"


async def test_get_task_result_api(client: AsyncClient, tenant_headers: dict):
    task_id = await _create_task(client, tenant_headers)
    await client.patch(
        f"{BASE}/tasks/{task_id}/status",
        json={"status": "COMPLETED", "output": {"result": "done"}},
        headers=tenant_headers,
    )

    resp = await client.get(f"{BASE}/tasks/{task_id}/result", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["output"]["result"] == "done"


async def test_task_statistics_api(client: AsyncClient, tenant_headers: dict):
    task_id1 = await _create_task(client, tenant_headers, title="t1")
    task_id2 = await _create_task(client, tenant_headers, title="t2")
    await client.patch(
        f"{BASE}/tasks/{task_id1}/status",
        json={"status": "COMPLETED"},
        headers=tenant_headers,
    )
    await client.patch(
        f"{BASE}/tasks/{task_id2}/status",
        json={"status": "FAILED", "errorMessage": "error"},
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/tasks/statistics",
        params={"agentId": "agt-001"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert data["completed"] == 1
    assert data["failed"] == 1


async def test_list_tasks_filter_by_status(client: AsyncClient, tenant_headers: dict):
    task_id = await _create_task(client, tenant_headers, title="completed")
    await client.patch(
        f"{BASE}/tasks/{task_id}/status",
        json={"status": "COMPLETED"},
        headers=tenant_headers,
    )
    await _create_task(client, tenant_headers, title="pending")

    resp = await client.get(
        f"{BASE}/tasks", params={"status": "COMPLETED"}, headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["status"] == "COMPLETED"
