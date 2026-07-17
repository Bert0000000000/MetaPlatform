"""Execution endpoint tests (P2-AGT-04/05)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/agent"


async def _create_active_agent(
    client: AsyncClient,
    tenant_headers: dict[str, str],
    code: str = "exec-assistant",
) -> str:
    body = {
        "name": "执行助手",
        "code": code,
        "description": "用于测试执行",
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个执行助手。",
        "tools": ["tool-001"],
        "ragScopes": ["scope-001"],
        "temperature": 0.3,
        "maxTokens": 2048,
        "status": "ACTIVE",
    }
    resp = await client.post(f"{BASE}/agents", json=body, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["agentId"]


async def test_execute_agent_success(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    agent_id = await _create_active_agent(client, tenant_headers)

    resp = await client.post(
        f"{BASE}/agents/{agent_id}/execute",
        json={
            "input": "帮我检查采购订单状态",
            "inputType": "TEXT",
            "context": {
                "conversationId": "conv-001",
                "taskId": "task-001",
                "userId": "user-001",
            },
            "options": {
                "timeout": 180,
                "maxIterations": 15,
            },
        },
        headers=tenant_headers,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["agentId"] == agent_id
    assert data["agentKey"] == "exec-assistant"
    assert data["status"] == "COMPLETED"
    assert data["input"] == "帮我检查采购订单状态"
    assert data["output"]["content"]
    assert data["metrics"]["tokenUsage"]["totalTokens"] >= 0
    assert data["conversationId"] == "conv-001"
    assert data["taskId"] == "task-001"


async def test_execute_agent_rejects_draft(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    body = {
        "name": "草稿助手",
        "code": "draft-assistant",
        "description": "",
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个草稿助手。",
        "status": "DRAFT",
    }
    resp = await client.post(f"{BASE}/agents", json=body, headers=tenant_headers)
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.post(
        f"{BASE}/agents/{agent_id}/execute",
        json={"input": "test"},
        headers=tenant_headers,
    )

    assert resp.status_code == 409
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_ACTIVE)


async def test_execute_agent_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/agents/agt-not-exist/execute",
        json={"input": "test"},
        headers=tenant_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_FOUND)


async def test_stream_agent_success(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    agent_id = await _create_active_agent(client, tenant_headers, code="stream-assistant")

    async with client.stream(
        "POST",
        f"{BASE}/agents/{agent_id}/execute/stream",
        json={"input": "流式测试"},
        headers=tenant_headers,
    ) as resp:
        assert resp.status_code == 200, resp.text
        assert resp.headers["content-type"] == "text/event-stream; charset=utf-8"
        chunks = []
        async for chunk in resp.aiter_text():
            chunks.append(chunk)
        text = "".join(chunks)
        assert "event: execution.started" in text
        assert "event: agent.thinking" in text
        assert "event: agent.action" in text
        assert "event: tool.calling" in text
        assert "event: tool.result" in text
        assert "event: content.delta" in text
        assert "event: content.done" in text
        assert "event: execution.step" in text
        assert "event: execution.completed" in text
        assert "流式测试" in text


async def test_stream_agent_rejects_draft(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    body = {
        "name": "草稿助手2",
        "code": "draft-assistant-2",
        "modelId": "doubao-pro-32k",
        "systemPrompt": "...",
        "status": "DRAFT",
    }
    resp = await client.post(f"{BASE}/agents", json=body, headers=tenant_headers)
    agent_id = resp.json()["data"]["agentId"]

    resp = await client.post(
        f"{BASE}/agents/{agent_id}/execute/stream",
        json={"input": "test"},
        headers=tenant_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_ACTIVE)


async def test_stream_agent_rejects_unknown_agent(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """Regression: SSE endpoint must surface 404 for unknown agents.

    The validation must happen BEFORE the StreamingResponse starts sending,
    so that the global exception handler can produce the standard JSON
    error envelope. Otherwise starlette raises
    ``RuntimeError: Caught handled exception, but response already started``.
    """

    resp = await client.post(
        f"{BASE}/agents/agt-not-exist/execute/stream",
        json={"input": "test"},
        headers=tenant_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.AGENT_NOT_FOUND)
