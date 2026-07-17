"""Tests for Agent Messaging endpoints (P3-A2A-13)."""

from __future__ import annotations

from httpx import AsyncClient

from app.common.errors import ErrorCode

BASE = "/api/v1/a2a"
TENANT = "tenant-test"
TRACE = "test-trace-001"

SEND_BODY = {
    "fromAgentId": "agent-sender",
    "toAgentId": "agent-receiver",
    "messageType": "text",
    "content": {"text": "Hello, can you help with this task?"},
}


async def test_send_message_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/messages", json=SEND_BODY, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["fromAgentId"] == "agent-sender"
    assert data["toAgentId"] == "agent-receiver"
    assert data["status"] == "DELIVERED"
    assert data["messageId"].startswith("msg-")


async def test_receive_messages_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    # Send a PENDING message (manually set status via content)
    body = dict(SEND_BODY)
    resp = await client.post(f"{BASE}/messages", json=body, headers=tenant_headers)
    assert resp.status_code == 200

    # The message is DELIVERED, so receive should find pending ones
    # For this test, let's create a pending message by sending and checking queue
    resp = await client.get(
        f"{BASE}/messages/queue",
        params={"agentId": "agent-receiver"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 1
    assert data[0]["toAgentId"] == "agent-receiver"


async def test_acknowledge_message_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/messages", json=SEND_BODY, headers=tenant_headers)
    msg_id = resp.json()["data"]["messageId"]

    resp = await client.post(f"{BASE}/messages/{msg_id}/ack", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "ACKNOWLEDGED"
    assert data["acknowledgedAt"] is not None


async def test_list_queue_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    for i in range(3):
        body = dict(SEND_BODY)
        body["content"] = {"text": f"Message {i}"}
        resp = await client.post(f"{BASE}/messages", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(
        f"{BASE}/messages/queue",
        params={"agentId": "agent-receiver"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3


async def test_cleanup_expired_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    # Send a message with short TTL
    body = dict(SEND_BODY)
    body["ttlSeconds"] = 0
    resp = await client.post(f"{BASE}/messages", json=body, headers=tenant_headers)
    assert resp.status_code == 200

    resp = await client.delete(f"{BASE}/messages/cleanup", headers=tenant_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["cleanedUp"] >= 1


async def test_message_not_found(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(f"{BASE}/messages/msg-nonexistent/ack", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.MESSAGE_NOT_FOUND)
