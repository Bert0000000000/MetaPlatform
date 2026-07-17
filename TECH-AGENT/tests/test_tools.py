"""Tool management API tests (P2-AGT-18/19)."""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/agent"

CREATE_TOOL_BODY = {
    "agentId": "agt-001",
    "name": "query-order",
    "description": "查询订单状态",
    "toolType": "ACTION",
    "config": {"actionCode": "query-order-status"},
    "inputSchema": {"type": "object", "properties": {"orderNo": {"type": "string"}}},
    "outputSchema": {"type": "object", "properties": {"status": {"type": "string"}}},
    "enabled": True,
}


async def _create_tool(client: AsyncClient, headers: dict, **overrides) -> str:
    body = dict(CREATE_TOOL_BODY)
    body.update(overrides)
    resp = await client.post(f"{BASE}/tools", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["toolId"]


async def test_register_tool_api(client: AsyncClient, tenant_headers: dict):
    resp = await client.post(
        f"{BASE}/tools", json=CREATE_TOOL_BODY, headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["toolId"].startswith("tool-")
    assert data["name"] == "query-order"
    assert data["toolType"] == "ACTION"
    assert data["enabled"] is True


async def test_list_tools_api(client: AsyncClient, tenant_headers: dict):
    await _create_tool(client, tenant_headers, name="tool-1")
    await _create_tool(client, tenant_headers, name="tool-2")

    resp = await client.get(
        f"{BASE}/tools", params={"agentId": "agt-001"}, headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2


async def test_get_tool_api(client: AsyncClient, tenant_headers: dict):
    tool_id = await _create_tool(client, tenant_headers)

    resp = await client.get(f"{BASE}/tools/{tool_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["toolId"] == tool_id


async def test_update_tool_api(client: AsyncClient, tenant_headers: dict):
    tool_id = await _create_tool(client, tenant_headers)

    resp = await client.put(
        f"{BASE}/tools/{tool_id}",
        json={"name": "updated-name", "description": "updated desc"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "updated-name"
    assert data["description"] == "updated desc"


async def test_disable_enable_tool_api(client: AsyncClient, tenant_headers: dict):
    tool_id = await _create_tool(client, tenant_headers)

    resp = await client.post(
        f"{BASE}/tools/{tool_id}/disable", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["enabled"] is False

    resp = await client.post(
        f"{BASE}/tools/{tool_id}/enable", headers=tenant_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["enabled"] is True


async def test_delete_tool_api(client: AsyncClient, tenant_headers: dict):
    tool_id = await _create_tool(client, tenant_headers)

    resp = await client.delete(f"{BASE}/tools/{tool_id}", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    resp = await client.get(f"{BASE}/tools/{tool_id}", headers=tenant_headers)
    assert resp.status_code == 400


async def test_invoke_action_tool_api(client: AsyncClient, tenant_headers: dict):
    tool_id = await _create_tool(client, tenant_headers)

    resp = await client.post(
        f"{BASE}/tools/{tool_id}/invoke",
        json={"input": {"orderNo": "ORD-001"}},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "SUCCESS"
    assert "output" in data


async def test_invoke_rag_tool_api(client: AsyncClient, tenant_headers: dict):
    tool_id = await _create_tool(
        client,
        tenant_headers,
        name="rag-search",
        toolType="RAG",
        config={"knowledgeBaseIds": ["kb-001"]},
    )

    resp = await client.post(
        f"{BASE}/tools/{tool_id}/invoke",
        json={"input": {"query": "采购流程"}},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "SUCCESS"
