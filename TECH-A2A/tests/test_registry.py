"""Tests for Agent Registry endpoints (P3-A2A-04)."""

from __future__ import annotations

from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"

REGISTER_BODY = {
    "agentId": "ext-agent-001",
    "name": "External Analysis Agent",
    "description": "An external agent for data analysis",
    "endpoints": ["http://ext-agent.example.com/api"],
    "capabilities": ["analysis", "reporting"],
    "metadata": {"region": "us-east"},
}


async def test_register_agent_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/registry/register", json=REGISTER_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["agentId"] == "ext-agent-001"
    assert data["name"] == "External Analysis Agent"
    assert data["status"] == "HEALTHY"
    assert data["registrationId"].startswith("reg-")


async def test_register_duplicate_agent(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/registry/register", json=REGISTER_BODY, headers=tenant_headers)
    assert resp.status_code == 200

    resp = await client.post(f"{BASE}/registry/register", json=REGISTER_BODY, headers=tenant_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == int(ErrorCode.AGENT_ALREADY_REGISTERED)


async def test_heartbeat_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/registry/register", json=REGISTER_BODY, headers=tenant_headers)
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.post(f"{BASE}/registry/{agent_id}/heartbeat", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "HEALTHY"
    assert data["lastHeartbeat"] is not None


async def test_health_check_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/registry/register", json=REGISTER_BODY, headers=tenant_headers)
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.get(f"{BASE}/registry/{agent_id}/health", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "HEALTHY"


async def test_deregister_agent_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/registry/register", json=REGISTER_BODY, headers=tenant_headers)
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.delete(f"{BASE}/registry/{agent_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["deregistered"] is True


async def test_list_registry_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    for i in range(2):
        body = dict(REGISTER_BODY)
        body["agentId"] = f"agent-{i}"
        body["name"] = f"Agent {i}"
        resp = await client.post(f"{BASE}/registry/register", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/registry", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2


async def test_deregister_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.delete(f"{BASE}/registry/nonexistent-agent", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_FOUND)


async def test_register_agent_with_status_disconnected(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """注册时若调用方显式指定 status（取自 HealthStatus 合法取值：HEALTHY/UNHEALTHY/UNKNOWN），
    服务端应原样落库，而不是强制重写为 HEALTHY。本用例验证"注册即已失联"场景
    （status=UNHEALTHY），等价于外部 Agent 启动后尚未上报心跳/已下线。"""

    body = dict(REGISTER_BODY)
    body["agentId"] = "ext-agent-disconnected"
    body["name"] = "Disconnected Agent"
    # 显式声明注册时为 UNHEALTHY（HealthStatus 合法值，等价"已失联"语义）
    body["status"] = "UNHEALTHY"

    resp = await client.post(
        f"{BASE}/registry/register", json=body, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["agentId"] == "ext-agent-disconnected"
    # 关键断言：服务端不应把调用方显式给的 UNHEALTHY 偷偷改写成默认 HEALTHY
    assert data["status"] == "UNHEALTHY", (
        f"注册时显式指定 status=UNHEALTHY，"
        f"服务端应原样落库，实际 status={data['status']}"
    )

    # 同时核对：另一个合法取值 UNKNOWN 也能被正确保留
    body2 = dict(REGISTER_BODY)
    body2["agentId"] = "ext-agent-unknown"
    body2["name"] = "Unknown Agent"
    body2["status"] = "UNKNOWN"
    resp = await client.post(
        f"{BASE}/registry/register", json=body2, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "UNKNOWN"

    # 反向：缺省 status 时仍为 HEALTHY（向后兼容）
    body3 = dict(REGISTER_BODY)
    body3["agentId"] = "ext-agent-default"
    body3["name"] = "Default Status Agent"
    resp = await client.post(
        f"{BASE}/registry/register", json=body3, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "HEALTHY"
