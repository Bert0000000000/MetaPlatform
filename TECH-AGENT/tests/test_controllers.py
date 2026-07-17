"""HTTP controller tests for TECH-AGENT API endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/agent"
TENANT = "tenant-test"
TRACE = "test-trace-001"


CREATE_BODY = {
    "name": "采购助手",
    "code": "purchase-assistant",
    "description": "协助处理采购审批流程的数字员工",
    "modelId": "doubao-pro-32k",
    "systemPrompt": "你是一个专业的采购助手。",
    "tools": ["tool-001", "tool-002"],
    "ragScopes": ["scope-001"],
    "temperature": 0.3,
    "maxTokens": 2048,
    "status": "DRAFT",
}


# --------------------------------------------------- POST /agents


async def test_create_agent_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /agents creates an agent and returns code 0."""

    resp = await client.post(
        f"{BASE}/agents",
        json=CREATE_BODY,
        headers=tenant_headers,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == TRACE
    data = body["data"]
    assert data["name"] == "采购助手"
    assert data["code"] == "purchase-assistant"
    assert data["modelId"] == "doubao-pro-32k"
    assert data["systemPrompt"] == "你是一个专业的采购助手。"
    assert data["tools"] == ["tool-001", "tool-002"]
    assert data["ragScopes"] == ["scope-001"]
    assert data["temperature"] == 0.3
    assert data["maxTokens"] == 2048
    assert data["status"] == "DRAFT"
    assert data["tenantId"] == TENANT
    assert data["agentId"].startswith("agt-")


async def test_create_agent_api_requires_auth(
    client: AsyncClient,
) -> None:
    """POST /agents rejects requests without a valid JWT."""

    resp = await client.post(
        f"{BASE}/agents",
        json=CREATE_BODY,
        headers={"X-Tenant-Id": TENANT, "X-Trace-Id": TRACE},
    )

    assert resp.status_code == 401
    assert resp.json()["code"] == int(ErrorCode.UNAUTHORIZED)


async def test_create_agent_api_rejects_duplicate_code(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /agents rejects duplicate code within the same tenant."""

    resp = await client.post(
        f"{BASE}/agents",
        json=CREATE_BODY,
        headers=tenant_headers,
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"{BASE}/agents",
        json=CREATE_BODY,
        headers=tenant_headers,
    )
    assert resp.status_code == 409
    body = resp.json()
    assert body["code"] == int(ErrorCode.DUPLICATE_AGENT_CODE)
    assert body["data"]["code"] == "purchase-assistant"


async def test_create_agent_api_validation_error(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /agents returns 400 on missing required fields."""

    body = dict(CREATE_BODY)
    body.pop("systemPrompt")
    resp = await client.post(
        f"{BASE}/agents",
        json=body,
        headers=tenant_headers,
    )

    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.MISSING_REQUIRED_FIELD)


# ---------------------------------------------------- GET /agents


async def test_list_agents_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /agents returns a paginated list."""

    for i in range(2):
        body = dict(CREATE_BODY)
        body["code"] = f"assistant-{i}"
        body["name"] = f"助手 {i}"
        resp = await client.post(f"{BASE}/agents", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/agents", headers=tenant_headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert data["page"] == 1
    assert len(data["items"]) == 2


async def test_list_agents_api_status_filter(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /agents supports status filtering."""

    body = dict(CREATE_BODY)
    body["code"] = "active-assistant"
    body["status"] = "ACTIVE"
    resp = await client.post(f"{BASE}/agents", json=body, headers=tenant_headers)
    assert resp.status_code == 200

    resp = await client.get(
        f"{BASE}/agents",
        params={"status": "ACTIVE"},
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["status"] == "ACTIVE"


async def test_list_agents_api_invalid_status(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /agents returns 400 for invalid status enum."""

    resp = await client.get(
        f"{BASE}/agents",
        params={"status": "BOGUS"},
        headers=tenant_headers,
    )

    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


# ------------------------------------------------ GET /agents/{id}


async def test_get_agent_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /agents/{id} returns agent details."""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.get(f"{BASE}/agents/{agent_id}", headers=tenant_headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["agentId"] == agent_id
    assert data["code"] == "purchase-assistant"


async def test_get_agent_api_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /agents/{id} returns 404 for unknown agent."""

    resp = await client.get(
        f"{BASE}/agents/agt-does-not-exist", headers=tenant_headers
    )

    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_FOUND)


# ------------------------------------------------ PUT /agents/{id}


async def test_update_agent_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """PUT /agents/{id} updates allowed fields."""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    agent_id = resp.json()["data"]["agentId"]

    update = {"name": "updated-name", "maxTokens": 1024}
    resp = await client.put(
        f"{BASE}/agents/{agent_id}", json=update, headers=tenant_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "updated-name"
    assert data["maxTokens"] == 1024
    assert data["code"] == "purchase-assistant"


async def test_update_agent_api_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """PUT /agents/{id} returns 404 for unknown agent."""

    resp = await client.put(
        f"{BASE}/agents/agt-does-not-exist",
        json={"name": "x"},
        headers=tenant_headers,
    )

    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_FOUND)


# --------------------------------------------- DELETE /agents/{id}


async def test_delete_agent_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """DELETE /agents/{id} removes a DRAFT agent."""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.delete(
        f"{BASE}/agents/{agent_id}", headers=tenant_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["deleted"] is True
    assert data["agentId"] == agent_id

    resp = await client.get(f"{BASE}/agents/{agent_id}", headers=tenant_headers)
    assert resp.status_code == 404


async def test_delete_active_agent_api_fails(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """DELETE /agents/{id} rejects ACTIVE agents."""

    body = dict(CREATE_BODY)
    body["code"] = "active-to-delete"
    body["status"] = "ACTIVE"
    resp = await client.post(f"{BASE}/agents", json=body, headers=tenant_headers)
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.delete(
        f"{BASE}/agents/{agent_id}", headers=tenant_headers
    )

    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


# ------------------------------------------------------------- meta


async def test_health_endpoint(client: AsyncClient) -> None:
    """Health endpoint is publicly accessible."""

    resp = await client.get(f"{BASE}/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_api_envelope_on_error(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """Error responses follow the standard envelope."""

    resp = await client.get(
        f"{BASE}/agents/agt-does-not-exist", headers=tenant_headers
    )
    body = resp.json()
    assert set(body.keys()) >= {"code", "message", "data", "traceId"}
    assert body["code"] != 0
