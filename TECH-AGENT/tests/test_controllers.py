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


# ------------------------------------------- V12-07 软删除 / 克隆


async def test_delete_agent_api_is_soft_delete(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: DELETE /agents/{id} 软删除 Agent，删除后 GET 不可见。"""

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

    # 删除后 list 不应包含该 Agent
    resp = await client.get(f"{BASE}/agents", headers=tenant_headers)
    items = resp.json()["data"]["items"]
    assert all(item["agentId"] != agent_id for item in items)

    # 删除后 GET 该 Agent 应返回 404
    resp = await client.get(f"{BASE}/agents/{agent_id}", headers=tenant_headers)
    assert resp.status_code == 404


async def test_delete_agent_records_audit_log(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: DELETE 必须记录 audit log，且审计端点可查询已软删除 Agent 的日志。"""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    agent_id = resp.json()["data"]["agentId"]

    await client.delete(f"{BASE}/agents/{agent_id}", headers=tenant_headers)

    # 审计端点允许查询已软删除 Agent 的操作日志
    resp = await client.get(
        f"{BASE}/agents/{agent_id}/logs", headers=tenant_headers
    )
    assert resp.status_code == 200
    logs = resp.json()["data"]["items"]
    actions = [log["action"] for log in logs]
    assert "create" in actions
    assert "delete" in actions


async def test_deleted_agent_versions_still_queryable(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: 软删除后审计端点仍可查询历史版本。"""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    agent_id = resp.json()["data"]["agentId"]

    await client.delete(f"{BASE}/agents/{agent_id}", headers=tenant_headers)

    resp = await client.get(
        f"{BASE}/agents/{agent_id}/versions", headers=tenant_headers
    )
    assert resp.status_code == 200
    versions = resp.json()["data"]["items"]
    assert len(versions) >= 1
    assert versions[0]["version"] == "1.0.0"


async def test_clone_agent_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: POST /agents/{id}/clone 创建新 Agent，复制源配置。"""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    source_id = resp.json()["data"]["agentId"]

    clone_body = {"name": "采购助手 - 副本", "code": "purchase-assistant-clone"}
    resp = await client.post(
        f"{BASE}/agents/{source_id}/clone",
        json=clone_body,
        headers=tenant_headers,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == TRACE

    data = body["data"]
    assert data["agentId"] != source_id
    assert data["agentId"].startswith("agt-")
    assert data["name"] == "采购助手 - 副本"
    assert data["code"] == "purchase-assistant-clone"
    # 复制源 Agent 全部能力配置
    assert data["modelId"] == "doubao-pro-32k"
    assert data["systemPrompt"] == "你是一个专业的采购助手。"
    assert data["tools"] == ["tool-001", "tool-002"]
    assert data["ragScopes"] == ["scope-001"]
    assert data["temperature"] == 0.3
    assert data["maxTokens"] == 2048
    # 新 Agent 状态固定为 DRAFT
    assert data["status"] == "DRAFT"
    assert data["deletedAt"] is None


async def test_clone_agent_api_rejects_duplicate_code(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: clone 端点对已存在的 code 返回 409。"""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    source_id = resp.json()["data"]["agentId"]

    # 再创建一个 second-agent
    second_body = dict(CREATE_BODY)
    second_body["code"] = "second-agent"
    second_body["name"] = "Second"
    await client.post(f"{BASE}/agents", json=second_body, headers=tenant_headers)

    # 尝试用 second-agent 的 code 来克隆 → 应 409
    clone_body = {"name": "克隆副本", "code": "second-agent"}
    resp = await client.post(
        f"{BASE}/agents/{source_id}/clone",
        json=clone_body,
        headers=tenant_headers,
    )
    assert resp.status_code == 409
    body = resp.json()
    assert body["code"] == int(ErrorCode.DUPLICATE_AGENT_CODE)
    assert body["data"]["code"] == "second-agent"


async def test_clone_agent_api_source_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: clone 不存在的 Agent 应返回 404。"""

    clone_body = {"name": "x", "code": "y"}
    resp = await client.post(
        f"{BASE}/agents/agt-does-not-exist/clone",
        json=clone_body,
        headers=tenant_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_FOUND)


async def test_clone_agent_api_records_version_snapshot(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: clone 后源 Agent 版本历史追加一条带"克隆"的快照。"""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    source_id = resp.json()["data"]["agentId"]

    clone_body = {"name": "克隆", "code": "clone-version-test"}
    await client.post(
        f"{BASE}/agents/{source_id}/clone",
        json=clone_body,
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/agents/{source_id}/versions", headers=tenant_headers
    )
    assert resp.status_code == 200
    versions = resp.json()["data"]["items"]
    # 1.0.0 初始 + 1.0.1 克隆
    assert len(versions) == 2
    assert versions[0]["version"] == "1.0.1"
    assert "克隆" in versions[0]["changeLog"]
    assert versions[0]["snapshot"] is not None


async def test_clone_agent_api_records_audit_log(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: clone 后源 Agent 与新 Agent 各自记录审计日志。"""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    source_id = resp.json()["data"]["agentId"]

    clone_body = {"name": "克隆", "code": "clone-audit-test"}
    resp = await client.post(
        f"{BASE}/agents/{source_id}/clone",
        json=clone_body,
        headers=tenant_headers,
    )
    cloned_id = resp.json()["data"]["agentId"]

    # 源 Agent 日志应包含 clone 动作
    resp = await client.get(
        f"{BASE}/agents/{source_id}/logs", headers=tenant_headers
    )
    source_logs = resp.json()["data"]["items"]
    source_actions = [log["action"] for log in source_logs]
    assert "create" in source_actions
    assert "clone" in source_actions

    # 新 Agent 日志应包含 create 动作
    resp = await client.get(
        f"{BASE}/agents/{cloned_id}/logs", headers=tenant_headers
    )
    target_logs = resp.json()["data"]["items"]
    target_actions = [log["action"] for log in target_logs]
    assert "create" in target_actions
    assert "clone" not in target_actions


async def test_clone_agent_api_validation_error(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """V12-07: clone 端点对缺失字段返回 400。"""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    source_id = resp.json()["data"]["agentId"]

    # 缺 code 字段
    resp = await client.post(
        f"{BASE}/agents/{source_id}/clone",
        json={"name": "x"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.MISSING_REQUIRED_FIELD)


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


# ----------------------------------------- GET /agents/{id}/versions|logs


async def test_agent_versions_and_logs_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """Create/update an agent and verify versions + logs endpoints."""

    resp = await client.post(
        f"{BASE}/agents", json=CREATE_BODY, headers=tenant_headers
    )
    agent_id = resp.json()["data"]["agentId"]

    # trigger an update to bump version 1.0.0 -> 1.0.1
    await client.put(
        f"{BASE}/agents/{agent_id}",
        json={"name": "采购助手 v2"},
        headers=tenant_headers,
    )

    resp = await client.get(
        f"{BASE}/agents/{agent_id}/versions", headers=tenant_headers
    )
    assert resp.status_code == 200
    versions = resp.json()["data"]["items"]
    assert versions[0]["version"] == "1.0.1"
    assert versions[1]["version"] == "1.0.0"
    assert versions[0]["changeLog"]
    assert versions[1]["changeLog"] == "初始创建"

    resp = await client.get(
        f"{BASE}/agents/{agent_id}/logs", headers=tenant_headers
    )
    assert resp.status_code == 200
    logs = resp.json()["data"]["items"]
    actions = [log["action"] for log in logs]
    assert "create" in actions
    assert "update" in actions


async def test_agent_versions_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /agents/{id}/versions returns 404 for unknown agent."""

    resp = await client.get(
        f"{BASE}/agents/agt-does-not-exist/versions", headers=tenant_headers
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_FOUND)
