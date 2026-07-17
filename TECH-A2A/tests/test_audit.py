"""Tests for Audit statistics endpoints (P3-A2A-14)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"


async def _generate_audit_data(client: AsyncClient, headers: dict[str, str]) -> None:
    """Generate some audit data by calling various endpoints."""

    # Register an agent
    resp = await client.post(
        f"{BASE}/registry/register",
        json={
            "agentId": "audit-agent-001",
            "name": "Audit Test Agent",
            "endpoints": ["http://example.com"],
            "capabilities": ["test"],
        },
        headers=headers,
    )
    assert resp.status_code == 200

    # Delegate a task
    resp = await client.post(
        f"{BASE}/tasks",
        json={
            "sourceAgentId": "audit-agent-001",
            "targetAgentId": "ext-agent",
            "taskType": "test",
            "payload": {"input": "test"},
        },
        headers=headers,
    )
    assert resp.status_code == 200

    # Send a message
    resp = await client.post(
        f"{BASE}/messages",
        json={
            "fromAgentId": "audit-agent-001",
            "toAgentId": "audit-agent-002",
            "messageType": "text",
            "content": {"text": "hello"},
        },
        headers=headers,
    )
    assert resp.status_code == 200


async def test_list_audit_records(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    await _generate_audit_data(client, tenant_headers)

    resp = await client.get(f"{BASE}/audit/records", headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total"] >= 3  # register + delegate + message_sent


async def test_collaboration_stats(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    await _generate_audit_data(client, tenant_headers)

    resp = await client.get(f"{BASE}/audit/collaboration-stats", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalCollaborations"] >= 2  # message_sent + task_delegated


async def test_delegation_stats(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    await _generate_audit_data(client, tenant_headers)

    resp = await client.get(f"{BASE}/audit/delegation-stats", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalDelegations"] >= 1
    assert data["completed"] >= 1  # mock mode completes immediately


async def test_delegation_stats_success_rate(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """delegation-stats 应返回 successRate = completed / totalDelegations。"""

    await _generate_audit_data(client, tenant_headers)

    resp = await client.get(f"{BASE}/audit/delegation-stats", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 保留原有字段
    assert "completed" in data
    assert "failed" in data
    assert "cancelled" in data
    assert "byAction" in data
    assert "totalDelegations" in data
    # 新增 successRate 字段，值在 [0, 1] 区间
    assert "successRate" in data
    rate = data["successRate"]
    assert isinstance(rate, (int, float))
    assert 0.0 <= rate <= 1.0
    # mock 模式下委派的 task 直接完成，比例应大于 0
    assert rate > 0.0


async def test_error_stats(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    await _generate_audit_data(client, tenant_headers)

    resp = await client.get(f"{BASE}/audit/error-stats", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "totalErrors" in data


async def test_agent_stats(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    await _generate_audit_data(client, tenant_headers)

    resp = await client.get(f"{BASE}/audit/agent-stats", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "agents" in data
    assert len(data["agents"]) >= 1


async def test_export_report(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    await _generate_audit_data(client, tenant_headers)

    resp = await client.get(f"{BASE}/audit/export", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["totalRecords"] >= 3
    assert "collaborationStats" in data
    assert "delegationStats" in data
    assert "errorStats" in data
    assert "agentStats" in data
