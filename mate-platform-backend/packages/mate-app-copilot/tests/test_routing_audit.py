"""Regression coverage for fail-closed semantic-routing outbox evidence."""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import pytest

from mate_app_copilot.clients.orchestrator_client import OrchestratorClientError


class _SnapshotClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def authorized_role_snapshot(self, **kwargs: Any) -> dict[str, Any]:
        return {
            "items": [{"role": "workflow", "capabilities": [{"name": "approve"}]}],
            "capability_version": "capability-v7",
            "actor_roles_digest": "roles-sha256-abc",
        }


class _UnavailableSnapshotClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def authorized_role_snapshot(self, **kwargs: Any) -> dict[str, Any]:
        raise OrchestratorClientError("snapshot service unavailable")


class _UnexpectedSnapshotFailureClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def authorized_role_snapshot(self, **kwargs: Any) -> dict[str, Any]:
        raise ValueError("snapshot payload cannot be decoded")


class _MalformedSnapshotClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def authorized_role_snapshot(self, **kwargs: Any) -> dict[str, Any]:
        return {
            "items": "not-a-role-list",
            "capability_version": "capability-v7",
            "actor_roles_digest": "roles-sha256-abc",
        }


async def _selected_then_dispatch(
    dispatched: list[bool], **kwargs: Any
) -> AsyncIterator[dict[str, Any]]:
    yield {
        "type": "routing_decision",
        "stage": "pre_screen",
        "candidates": [{"role_slug": "workflow"}],
        "selected": None,
    }
    yield {
        "type": "routing_decision",
        "stage": "final",
        "outcome": "selected",
        "selected": "workflow",
        "reason_code": "model_selected",
        "candidates": [{"role_slug": "workflow"}],
        "policy_version": "semantic-router-v1",
        "trace_id": "trace-audit-selected",
        "correlation_id": "correlation-audit-selected",
    }
    dispatched.append(True)
    yield {"type": "tool_call", "tool": "dispatch_employee", "args": {}}
    yield {"type": "final", "content": "completed"}


async def _denied_loop(**kwargs: Any) -> AsyncIterator[dict[str, Any]]:
    yield {
        "type": "routing_decision",
        "stage": "final",
        "outcome": "denied",
        "selected": None,
        "reason_code": "no_authorized_candidates",
        "candidates": [],
        "policy_version": "semantic-router-v1",
        "trace_id": "trace-audit-denied",
        "correlation_id": "correlation-audit-denied",
    }


async def _legacy_selected_loop(**kwargs: Any) -> AsyncIterator[dict[str, Any]]:
    yield {
        "type": "routing_decision",
        "stage": "final",
        "outcome": "selected",
        "selected": {"role_slug": "workflow"},
        "reason_code": "model_selected",
        "candidates": [{"role_slug": "workflow"}],
        "policy_version": "semantic-router-v1",
        "trace_id": "trace-audit-legacy",
        "correlation_id": "correlation-audit-legacy",
    }


class _TwoDispatchLlm:
    """A real agent-loop decision source with two dispatches in one turn."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._decisions = [
            {
                "content": "同时处理审批和知识检索。",
                "tool_calls": [
                    {
                        "id": "call-workflow",
                        "type": "function",
                        "function": {
                            "name": "dispatch_employee",
                            "arguments": (
                                '{"target_rid":"workflow","message":"发起审批"}'
                            ),
                        },
                    },
                    {
                        "id": "call-knowledge",
                        "type": "function",
                        "function": {
                            "name": "dispatch_employee",
                            "arguments": (
                                '{"target_rid":"knowledge","message":"检索政策"}'
                            ),
                        },
                    },
                ],
            },
            {"content": "两个任务均已提交。", "tool_calls": []},
        ]

    async def chat_with_tools(self, **kwargs: Any) -> dict[str, Any]:
        return self._decisions.pop(0)


class _TwoDispatchSnapshotClient:
    dispatched_rids: list[str] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def authorized_role_snapshot(self, **kwargs: Any) -> dict[str, Any]:
        return {
            "items": [
                {"role": "workflow", "capabilities": [{"name": "approve"}]},
                {"role": "knowledge", "capabilities": [{"name": "kb_search"}]},
            ],
            "capability_version": "capability-v7",
            "actor_roles_digest": "roles-sha256-abc",
        }

    async def dispatch(
        self, *, target_rid: str, **kwargs: Any
    ) -> dict[str, Any]:
        type(self).dispatched_rids.append(target_rid)
        return {"task_id": f"task-{target_rid}", "status": "completed"}


def _post_agent_stream(client, headers: dict[str, str]):
    return client.post(
        "/api/v1/copilot/chat/agent/stream",
        json={
            "messages": [{"role": "user", "content": "private message bearer secret-token"}],
            "model": "audit-test-model",
        },
        headers=headers,
    )


def _routing_records(outbox) -> list:
    return [
        record.event for record in outbox.all_records()
        if record.event.type.startswith("copilot.routing.")
    ]


def test_selected_decision_writes_one_minimal_outbox_event(
    client, outbox, auth_headers_acme, monkeypatch,
) -> None:
    """Removing the final-decision audit must make this selected path fail."""
    from mate_app_copilot.api import app as copilot_app

    dispatched: list[bool] = []
    monkeypatch.setattr(copilot_app, "OrchestratorClient", _SnapshotClient)
    monkeypatch.setattr(
        copilot_app,
        "run_agent_loop",
        lambda **kwargs: _selected_then_dispatch(dispatched, **kwargs),
    )

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    assert dispatched == [True]
    records = _routing_records(outbox)
    assert len(records) == 1
    event = records[0]
    assert event.type == "copilot.routing.decided"
    assert event.tenant_id == "tenant-acme"
    assert event.trace_id == "trace-audit-selected"
    assert event.payload == {
        "tenant_id": "tenant-acme",
        "actor_id": "u-1",
        "role_snapshot_digest": "roles-sha256-abc",
        "policy_version": "semantic-router-v1",
        "capability_version": "capability-v7",
        "selected_rid": "workflow",
        "reason_code": "model_selected",
        "trace_id": "trace-audit-selected",
        "correlation_id": "correlation-audit-selected",
    }
    serialized = json.dumps(event.to_dict(), sort_keys=True)
    assert "private message" not in serialized
    assert "secret-token" not in serialized
    assert "realm_access" not in serialized


def test_selected_decision_audits_a_rid_not_legacy_selected_object(
    client, outbox, auth_headers_acme, monkeypatch,
) -> None:
    """A legacy selected object must be normalized before the audit boundary."""
    from mate_app_copilot.api import app as copilot_app

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _SnapshotClient)
    monkeypatch.setattr(copilot_app, "run_agent_loop", _legacy_selected_loop)

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    records = _routing_records(outbox)
    assert len(records) == 1
    assert records[0].payload["selected_rid"] == "workflow"


def test_denied_decision_writes_one_minimal_outbox_event(
    client, outbox, auth_headers_acme, monkeypatch,
) -> None:
    """A final denial is auditable once, with no selected RID."""
    from mate_app_copilot.api import app as copilot_app

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _SnapshotClient)
    monkeypatch.setattr(copilot_app, "run_agent_loop", _denied_loop)

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    records = _routing_records(outbox)
    assert len(records) == 1
    event = records[0]
    assert event.type == "copilot.routing.denied"
    assert event.tenant_id == "tenant-acme"
    assert event.trace_id == "trace-audit-denied"
    assert event.payload == {
        "tenant_id": "tenant-acme",
        "actor_id": "u-1",
        "role_snapshot_digest": "roles-sha256-abc",
        "policy_version": "semantic-router-v1",
        "capability_version": "capability-v7",
        "selected_rid": None,
        "reason_code": "no_authorized_candidates",
        "trace_id": "trace-audit-denied",
        "correlation_id": "correlation-audit-denied",
    }


def test_snapshot_failure_writes_a_denied_outbox_event(
    client, outbox, auth_headers_acme, monkeypatch,
) -> None:
    """Authorization snapshot failures deny and persist their safe evidence."""
    from mate_app_copilot.api import app as copilot_app

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _UnavailableSnapshotClient)

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    records = _routing_records(outbox)
    assert len(records) == 1
    event = records[0]
    assert event.type == "copilot.routing.denied"
    assert event.payload["reason_code"] == "role_snapshot_unavailable"
    assert event.payload["selected_rid"] is None
    assert event.payload["role_snapshot_digest"] == "unavailable"
    assert event.payload["capability_version"] == "unavailable"
    assert event.payload["policy_version"] == "semantic-router-v1"
    assert event.payload["trace_id"]
    assert event.payload["correlation_id"]


def test_unexpected_snapshot_failure_writes_a_denied_outbox_event(
    client, outbox, auth_headers_acme, monkeypatch,
) -> None:
    """A parsing failure must use the same audited fail-closed boundary."""
    from mate_app_copilot.api import app as copilot_app

    monkeypatch.setattr(
        copilot_app, "OrchestratorClient", _UnexpectedSnapshotFailureClient,
    )

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    records = _routing_records(outbox)
    assert len(records) == 1
    assert records[0].type == "copilot.routing.denied"
    assert records[0].payload["reason_code"] == "role_snapshot_unavailable"
    assert "routing_audit_unavailable" not in response.text
    assert "data: [DONE]" not in response.text


def test_malformed_snapshot_writes_a_denied_outbox_event(
    client, outbox, auth_headers_acme, monkeypatch,
) -> None:
    """Invalid snapshot structure must be denied before entering routing."""
    from mate_app_copilot.api import app as copilot_app

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _MalformedSnapshotClient)

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    records = _routing_records(outbox)
    assert len(records) == 1
    assert records[0].type == "copilot.routing.denied"
    assert records[0].payload["reason_code"] == "role_snapshot_unavailable"
    assert "routing_audit_unavailable" not in response.text
    assert "data: [DONE]" not in response.text


def test_multi_dispatch_audits_one_event_per_final_selected_role(
    client, outbox, auth_headers_acme, monkeypatch,
) -> None:
    """One real two-dispatch turn produces two selected-role audit records."""
    from mate_app_copilot.api import app as copilot_app

    _TwoDispatchSnapshotClient.dispatched_rids = []
    monkeypatch.setattr(
        copilot_app, "OrchestratorClient", _TwoDispatchSnapshotClient,
    )
    monkeypatch.setattr(copilot_app, "LlmgwStreamClient", _TwoDispatchLlm)

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    records = _routing_records(outbox)
    assert len(records) == 2
    assert [record.type for record in records] == [
        "copilot.routing.decided",
        "copilot.routing.decided",
    ]
    assert [record.payload["selected_rid"] for record in records] == [
        "workflow", "knowledge",
    ]
    assert _TwoDispatchSnapshotClient.dispatched_rids == ["workflow", "knowledge"]


def test_snapshot_audit_writer_failure_terminates_the_stream(
    client, auth_headers_acme, monkeypatch,
) -> None:
    """An unauditable snapshot denial must end without a completed stream."""
    from mate_app_copilot.api import app as copilot_app

    class _FailingWriter:
        def append(self, event: Any) -> None:
            raise RuntimeError("outbox unavailable")

    monkeypatch.setattr(
        copilot_app, "OrchestratorClient", _UnexpectedSnapshotFailureClient,
    )
    client.app.state.outbox_writer = _FailingWriter()

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    assert "routing_audit_unavailable" in response.text
    assert "data: [DONE]" not in response.text


@pytest.mark.parametrize("writer_mode", ["missing", "failing"])
def test_audit_writer_failure_stops_before_dispatch(
    client, auth_headers_acme, monkeypatch, writer_mode: str,
) -> None:
    """A missing or failed outbox append must not advance into dispatch."""
    from mate_app_copilot.api import app as copilot_app

    class _FailingWriter:
        def append(self, event: Any) -> None:
            raise RuntimeError("outbox unavailable")

    dispatched: list[bool] = []
    monkeypatch.setattr(copilot_app, "OrchestratorClient", _SnapshotClient)
    monkeypatch.setattr(
        copilot_app,
        "run_agent_loop",
        lambda **kwargs: _selected_then_dispatch(dispatched, **kwargs),
    )
    if writer_mode == "missing":
        delattr(client.app.state, "outbox_writer")
    else:
        client.app.state.outbox_writer = _FailingWriter()

    response = _post_agent_stream(client, auth_headers_acme)

    assert response.status_code == 200, response.text
    assert dispatched == []
    assert "routing_audit_unavailable" in response.text
    assert "data: [DONE]" not in response.text
