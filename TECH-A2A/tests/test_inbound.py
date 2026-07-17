"""Tests for Inbound JSON-RPC endpoints (P3-A2A-06)."""

from __future__ import annotations

from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"


def _jsonrpc_send(
    source_agent_id: str = "ext-agent-100",
    target_agent_id: str = "platform-agent-001",
    task_type: str = "inquiry",
    payload: dict | None = None,
) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": "rpc-001",
        "method": "tasks/send",
        "params": {
            "sourceAgentId": source_agent_id,
            "targetAgentId": target_agent_id,
            "taskType": task_type,
            "payload": payload or {"query": "what is the status?"},
        },
    }


async def test_jsonrpc_tasks_send(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    # jsonrpc endpoint is whitelisted but we pass auth for tenant resolution
    resp = await client.post(
        f"{BASE}/jsonrpc",
        json=_jsonrpc_send(),
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["jsonrpc"] == "2.0"
    assert body["id"] == "rpc-001"
    result = body["result"]
    assert result["sourceAgentId"] == "ext-agent-100"
    assert result["status"] == "PENDING"
    assert result["taskId"].startswith("inb-")


async def test_jsonrpc_tasks_send_no_auth(
    client: AsyncClient,
) -> None:
    """JSON-RPC endpoint works without auth (whitelisted)."""

    resp = await client.post(
        f"{BASE}/jsonrpc",
        json=_jsonrpc_send(),
        headers={"X-Tenant-Id": TENANT, "X-Trace-Id": TRACE},
    )
    assert resp.status_code == 200
    assert resp.json()["result"]["status"] == "PENDING"


async def test_jsonrpc_tasks_get(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    # First send a task
    resp = await client.post(
        f"{BASE}/jsonrpc",
        json=_jsonrpc_send(),
        headers=tenant_headers,
    )
    task_id = resp.json()["result"]["taskId"]

    # Then get it
    resp = await client.post(
        f"{BASE}/jsonrpc",
        json={
            "jsonrpc": "2.0",
            "id": "rpc-002",
            "method": "tasks/get",
            "params": {"id": task_id},
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["result"]["taskId"] == task_id


async def test_jsonrpc_tasks_cancel(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/jsonrpc",
        json=_jsonrpc_send(),
        headers=tenant_headers,
    )
    task_id = resp.json()["result"]["taskId"]

    resp = await client.post(
        f"{BASE}/jsonrpc",
        json={
            "jsonrpc": "2.0",
            "id": "rpc-003",
            "method": "tasks/cancel",
            "params": {"id": task_id},
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["result"]["status"] == "CANCELLED"


async def test_jsonrpc_unsupported_method(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/jsonrpc",
        json={
            "jsonrpc": "2.0",
            "id": "rpc-004",
            "method": "tasks/unknown",
            "params": {},
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == int(ErrorCode.INVALID_REQUEST)


async def test_list_inbound_tasks(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    for i in range(2):
        body = _jsonrpc_send(source_agent_id=f"agent-{i}")
        resp = await client.post(f"{BASE}/jsonrpc", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/inbound/tasks", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
