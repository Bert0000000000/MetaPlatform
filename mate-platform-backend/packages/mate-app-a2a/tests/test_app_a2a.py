"""Happy-path tests for the mate-app-a2a endpoints (FR-APP-A2A-001..010).

Tests exercise the read endpoints (agents, capabilities, external
agents, tasks) and the write endpoints (delegate, submit-result,
register) including outbox event emission.
"""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter


def test_list_agents(client, auth_headers_acme, outbox: InMemoryOutboxWriter) -> None:
    r = client.get("/api/v1/a2a/agents", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 5, body
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])


def test_get_agent_detail(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/a2a/agents", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    agent_id = r.json()["items"][0]["id"]

    r2 = client.get(f"/api/v1/a2a/agents/{agent_id}", headers=auth_headers_acme)
    assert r2.status_code == 200, r2.text
    detail = r2.json()
    assert detail["id"] == agent_id
    assert detail["tenant_id"] == "tenant-acme"


def test_list_external_agents(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/a2a/external", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])


def test_delegate_creates_task(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/a2a/delegate",
        json={
            "target_agent_id": "agent-recon",
            "message": "Reconcile ledger",
            "context": {"period": "Q3"},
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "task_id" in body
    assert body["status"] == "pending"

    # Outbox should have an a2a.delegation.created event.
    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "a2a.delegation.created" in types, types


def test_submit_task_result(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    # First create a task to submit a result for.
    create = client.post(
        "/api/v1/a2a/delegate",
        json={
            "target_agent_id": "agent-analyst",
            "message": "Build revenue dashboard",
            "context": {},
        },
        headers=auth_headers_acme,
    )
    assert create.status_code == 200, create.text
    task_id = create.json()["task_id"]

    # Clear outbox so we only see the completion event.
    outbox._records.clear()

    r = client.post(
        f"/api/v1/a2a/tasks/{task_id}/result",
        json={"result": {"rows": 42}, "status": "completed"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["task_id"] == task_id
    assert body["status"] == "completed"

    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "a2a.delegation.completed" in types, types


def test_register_external_agent(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/a2a/register",
        json={
            "name": "Custom LLM Agent",
            "endpoint": "https://my-llm.example.com/a2a",
            "capabilities": ["chat", "summarize", "translate"],
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "agent_id" in body
    assert body["agent_id"].startswith("ext-")

    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "a2a.agent.registered" in types, types
