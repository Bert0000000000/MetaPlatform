"""P3-W7 A2A real delegation tests (TD-4).

Tests cover:
  - test_a2a_delegate_happy_path: POST /a2a/delegate creates a task
  - test_a2a_delegate_agent_not_found: unknown agent → 404
  - test_a2a_delegate_tenant_isolation: cross-tenant agents invisible
  - test_a2a_external_call: POST /a2a/external calls external agent via mock
  - test_a2a_external_timeout_handling: timeout returns status=timeout
  - test_a2a_external_emits_outbox_event: a2a.external.called emitted
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from mate_app_a2a.clients import ExternalAgentClient
from mate_app_a2a.delegate import A2ADelegator
from mate_platform.messaging.outbox import InMemoryOutboxWriter


def _mock_external_client(response_body: dict, *, raise_exc: Exception | None = None) -> MagicMock:
    """Build a mock ExternalAgentClient for tests."""
    mock = MagicMock(spec=ExternalAgentClient)
    mock.aclose = AsyncMock(return_value=None)
    if raise_exc is not None:
        mock.call = AsyncMock(side_effect=raise_exc)
    else:
        mock.call = AsyncMock(return_value=response_body)
    return mock


def test_a2a_delegate_happy_path(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /a2a/delegate creates a delegation task with status pending."""
    r = client.post(
        "/api/v1/a2a/delegate",
        json={
            "target_agent_id": "agent-recon",
            "message": "Reconcile Q3 ledger",
            "context": {"period": "Q3"},
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert "task_id" in body

    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "a2a.delegation.created" in types


def test_a2a_delegate_agent_not_found(client, auth_headers_acme) -> None:
    """POST /a2a/external with unknown agent returns 404."""
    # Inject a mock delegator so we don't hit a real network.
    mock_client = _mock_external_client({"reply": "ok"})
    from mate_app_a2a.delegate import set_default_delegator
    set_default_delegator(A2ADelegator(client=mock_client))

    try:
        r = client.post(
            "/api/v1/a2a/external",
            json={
                "target_agent_id": "ext-nonexistent",
                "message": "do something",
                "context": {},
            },
            headers=auth_headers_acme,
        )
        assert r.status_code == 404, r.text
        detail = r.json()["detail"]
        assert detail["code"] == "E_AGENT_NOT_FOUND"
    finally:
        set_default_delegator(None)


def test_a2a_delegate_tenant_isolation(client, auth_headers_acme, auth_headers_globex) -> None:
    """External agents registered in tenant A are invisible to tenant B."""
    # Register a custom external agent in tenant-acme
    reg = client.post(
        "/api/v1/a2a/register",
        json={
            "name": "Acme Private Agent",
            "endpoint": "https://acme-private.example.com/a2a",
            "capabilities": ["custom"],
        },
        headers=auth_headers_acme,
    )
    assert reg.status_code == 200
    acme_agent_id = reg.json()["agent_id"]

    # Tenant globex should NOT see acme's registered agent
    r_globex = client.get("/api/v1/a2a/external", headers=auth_headers_globex)
    assert r_globex.status_code == 200
    globex_ids = {item["id"] for item in r_globex.json()["items"]}
    assert acme_agent_id not in globex_ids

    # Tenant acme SHOULD see it
    r_acme = client.get("/api/v1/a2a/external", headers=auth_headers_acme)
    assert r_acme.status_code == 200
    acme_ids = {item["id"] for item in r_acme.json()["items"]}
    assert acme_agent_id in acme_ids


def test_a2a_external_call(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /a2a/external calls the external agent endpoint via mock."""
    mock_response = {"reply": "task completed", "data": {"rows": 42}}
    mock_client = _mock_external_client(mock_response)
    from mate_app_a2a.delegate import set_default_delegator
    set_default_delegator(A2ADelegator(client=mock_client))

    try:
        r = client.post(
            "/api/v1/a2a/external",
            json={
                "target_agent_id": "ext-openai-assistant",
                "message": "summarize this document",
                "context": {"doc_id": "doc-1"},
            },
            headers=auth_headers_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "completed"
        assert body["result"] == mock_response
        assert body["agent"]["id"] == "ext-openai-assistant"

        # Verify the mock client was called with the right endpoint
        mock_client.call.assert_awaited_once()
        call_kwargs = mock_client.call.call_args.kwargs
        assert "openai.com" in call_kwargs["endpoint"]

        # Outbox event emitted
        events = [rec.event for rec in outbox.all_records()]
        types = {e.type for e in events}
        assert "a2a.external.called" in types
    finally:
        set_default_delegator(None)


def test_a2a_external_timeout_handling(client, auth_headers_acme) -> None:
    """POST /a2a/external returns status=timeout when the agent times out."""
    mock_client = _mock_external_client(
        {}, raise_exc=httpx.ReadTimeout("connection timed out"),
    )
    from mate_app_a2a.delegate import set_default_delegator
    set_default_delegator(A2ADelegator(client=mock_client))

    try:
        r = client.post(
            "/api/v1/a2a/external",
            json={
                "target_agent_id": "ext-dify-workflow",
                "message": "run workflow",
                "context": {},
            },
            headers=auth_headers_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "timeout"
        assert "timeout" in body["result"]["error"]
    finally:
        set_default_delegator(None)


@pytest.mark.asyncio
async def test_delegator_internal_agent_completes_synchronously() -> None:
    """A2ADelegator.delegate_and_update with internal agent completes in-process."""
    from mate_app_a2a.repositories import in_memory as repo

    repo.reset_store()
    mock_client = _mock_external_client({})
    delegator = A2ADelegator(client=mock_client)

    # Create a delegation task targeting an internal agent
    task = repo.create_delegation("tenant-test", "agent-recon", "test msg", {})
    outcome = await delegator.delegate_and_update(
        tenant_id="tenant-test",
        task_id=task.id,
        target_agent_id="agent-recon",
        message="test msg",
        context={},
    )
    assert outcome["status"] == "completed"
    assert outcome["result"]["agent_name"] == "Finance Recon Bot"
    # Internal path should NOT call the external HTTP client
    mock_client.call.assert_not_awaited()

    # Verify the task was updated
    updated = repo.get_delegation("tenant-test", task.id)
    assert updated is not None
    assert updated.status == "completed"
    repo.reset_store()
