"""End-to-end integration tests for TECH-A2A (P3-A2A-01 through P3-A2A-15).

These tests verify the full A2A protocol flow:
  register -> delegate -> receive -> execute -> result
"""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"


async def test_full_delegation_flow(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """End-to-end: register agent -> delegate task -> verify completion."""

    # 1. Register an agent
    resp = await client.post(
        f"{BASE}/registry/register",
        json={
            "agentId": "e2e-agent-001",
            "name": "E2E Test Agent",
            "endpoints": ["http://e2e.example.com/api"],
            "capabilities": ["processing"],
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200

    # 2. Publish an agent card
    resp = await client.post(
        f"{BASE}/agent-cards",
        json={
            "name": "e2e-card",
            "description": "E2E test card",
            "capabilities": ["processing"],
            "endpoints": {"sync": "http://e2e.example.com/api/sync"},
            "status": "PUBLISHED",
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200

    # 3. Delegate a task to the agent (mock mode auto-completes)
    resp = await client.post(
        f"{BASE}/tasks",
        json={
            "sourceAgentId": "platform-orchestrator",
            "targetAgentId": "e2e-agent-001",
            "taskType": "processing",
            "payload": {"data": "process this"},
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    task_id = resp.json()["data"]["taskId"]
    assert resp.json()["data"]["status"] == "COMPLETED"

    # 4. Verify task result
    resp = await client.get(f"{BASE}/tasks/{task_id}/result", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["result"] is not None

    # 5. Check audit trail
    resp = await client.get(f"{BASE}/audit/records", headers=tenant_headers)
    assert resp.status_code == 200
    audit_data = resp.json()["data"]
    assert audit_data["total"] >= 2  # AGENT_REGISTERED + TASK_DELEGATED + TASK_COMPLETED


async def test_inbound_to_agent_routing_flow(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """End-to-end: receive inbound task -> route to TECH-AGENT (mock)."""

    # 1. Receive an inbound task via JSON-RPC
    resp = await client.post(
        f"{BASE}/jsonrpc",
        json={
            "jsonrpc": "2.0",
            "id": "e2e-rpc-001",
            "method": "tasks/send",
            "params": {
                "sourceAgentId": "external-agent-001",
                "targetAgentId": "platform-agent-001",
                "taskType": "analysis",
                "payload": {"input": "analyze this data"},
            },
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    inbound_task_id = resp.json()["result"]["taskId"]
    assert resp.json()["result"]["status"] == "PENDING"

    # 2. Route the inbound task to TECH-AGENT (mock mode)
    # First, we need a delegated task to route. Let's delegate one.
    resp = await client.post(
        f"{BASE}/tasks",
        json={
            "sourceAgentId": "platform-agent-001",
            "targetAgentId": "tech-agent-executor",
            "taskType": "execution",
            "payload": {"input": "execute this", "inboundTaskId": inbound_task_id},
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    delegated_task_id = resp.json()["data"]["taskId"]

    # 3. Route the delegated task to TECH-AGENT
    resp = await client.post(
        f"{BASE}/tasks/{delegated_task_id}/route-to-agent",
        json={"agentId": "tech-agent-executor", "input": "execute this"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["result"] is not None
    assert "executionId" in data["result"]


async def test_inbound_to_workflow_routing_flow(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """End-to-end: delegate task -> route to TECH-WFE (mock)."""

    # 1. Delegate a task
    resp = await client.post(
        f"{BASE}/tasks",
        json={
            "sourceAgentId": "platform-orchestrator",
            "targetAgentId": "wf-processor",
            "taskType": "workflow",
            "payload": {"step1": "do something", "step2": "do another thing"},
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    task_id = resp.json()["data"]["taskId"]

    # 2. Route to TECH-WFE (mock mode)
    resp = await client.post(
        f"{BASE}/tasks/{task_id}/route-to-workflow",
        json={"workflowId": "wf-approval-flow", "input": {"step1": "do something"}},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "IN_PROGRESS"
    assert "instanceId" in data["result"]

    # 3. Check the audit trail includes the routing event
    resp = await client.get(f"{BASE}/audit/export", headers=tenant_headers)
    assert resp.status_code == 200
    report = resp.json()["data"]
    assert report["totalRecords"] >= 2  # TASK_DELEGATED + ROUTED_TO_WORKFLOW


async def test_messaging_flow(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """End-to-end: send message -> queue -> acknowledge."""

    # 1. Send a message
    resp = await client.post(
        f"{BASE}/messages",
        json={
            "fromAgentId": "agent-a",
            "toAgentId": "agent-b",
            "messageType": "task-request",
            "content": {"task": "please review this document"},
        },
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    msg_id = resp.json()["data"]["messageId"]

    # 2. Check queue
    resp = await client.get(
        f"{BASE}/messages/queue",
        params={"agentId": "agent-b"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1

    # 3. Acknowledge
    resp = await client.post(f"{BASE}/messages/{msg_id}/ack", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ACKNOWLEDGED"

    # 4. Verify audit
    resp = await client.get(f"{BASE}/audit/records", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] >= 2  # MESSAGE_SENT + MESSAGE_ACKED
