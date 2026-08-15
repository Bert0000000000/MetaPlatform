"""Test that /chat/agent/stream persists user + assistant messages.

Mirrors the persistence contract of /chat/completions/stream so multi-turn
context reloads survive via /conversations/{id}/messages. Agent timeline
(reasoning / tool_call / tool_result) is stashed under
MessageORM.metadata_json["agentSteps"].
"""
from __future__ import annotations

import os
import tempfile
from collections.abc import AsyncIterator
from typing import Any

# Import models so their tables register on Base.metadata before create_all
import mate_app_copilot.repositories.sql_models  # noqa: F401

import pytest
from fastapi.testclient import TestClient

from mate_app_copilot.main import create_app
from mate_app_copilot.repositories import in_memory as in_memory_repo
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_tech_db.base import Base, _state, create_all, reset_engine, init_engine


@pytest.fixture
def sql_client():
    """TestClient backed by a file-based SQLite DB (shared across threads).

    file-based SQLite (not :memory:) is used so every connection sees the
    same tables; :memory: would give each connection its own empty DB
    and INSERTs would `no such table` errors mid-request.
    """
    # Reset any prior engine and point MATE_DB_URL at a fresh temp file
    # before create_app() runs its startup hook.
    reset_engine()
    fd, db_path = tempfile.mkstemp(suffix=".sqlite", prefix="agent-persist-")
    os.close(fd)
    os.environ["MATE_DB_URL"] = f"sqlite:///{db_path}"
    init_engine(os.environ["MATE_DB_URL"])
    create_all()
    in_memory_repo.reset_store()
    app = create_app()
    app.state.outbox_writer = InMemoryOutboxWriter()
    try:
        yield TestClient(app)
    finally:
        if _state.engine is not None:
            Base.metadata.drop_all(_state.engine)
        in_memory_repo.reset_store()
        reset_engine()
        try:
            os.unlink(db_path)
        except OSError:
            pass


async def _fake_run_agent_loop(**kwargs: Any) -> AsyncIterator[dict[str, Any]]:
    """Stand-in for run_agent_loop that emits one of each event type.

    Avoids touching llmgw / orchestrator; the persistence path under test
    just consumes the event stream.
    """
    yield {"type": "reasoning", "text": "正在分析任务并选择数字员工…"}
    yield {
        "type": "tool_call",
        "callId": "call-test-1",
        "tool": "dispatch_employee",
        "args": {"target_rid": "workflow", "message": "task"},
    }
    yield {
        "type": "tool_result",
        "callId": "call-test-1",
        "status": "success",
        "result": {"task_id": "orch-workflow-1", "status": "completed"},
    }
    yield {"type": "final", "content": "调度完成。已提交 workflow 任务。"}


class _StubOrchestratorClient:
    """Minimal stub for OrchestratorClient.list_roles."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        # Mirror real OrchestratorClient(auth=...) signature
        self.auth = kwargs.get("auth")

    async def list_roles(self, *, tenant_id: str, fallback_token: str | None = None) -> list[dict[str, Any]]:
        return [
            {
                "role": "workflow",
                "name": "Workflow Employee",
                "capabilities": [{"name": "delegate_run", "worker_kind": "a2a", "ref": "agent-recon"}],
            },
        ]


def test_agent_stream_persists_user_and_assistant(
    sql_client, auth_headers_acme, monkeypatch,
) -> None:
    """POST /chat/agent/stream with conversationId → both rows land in DB."""
    from mate_app_copilot.api import app as copilot_app_module

    # Stub orchestrator + agent loop so we don't need real llmgw / a2a.
    monkeypatch.setattr(copilot_app_module, "OrchestratorClient", _StubOrchestratorClient)
    monkeypatch.setattr(copilot_app_module, "run_agent_loop", _fake_run_agent_loop)

    # 1) create a conversation row
    created = sql_client.post(
        "/api/v1/copilot/conversations",
        json={"title": "Agent 测试会话", "mode": "agent"},
        headers=auth_headers_acme,
    )
    assert created.status_code == 200, created.text
    conv_id = created.json()["data"]["id"]

    # 2) stream an agent chat turn with conversationId
    resp = sql_client.post(
        "/api/v1/copilot/chat/agent/stream",
        json={
            "messages": [{"role": "user", "content": "请帮我处理对账单"}],
            "model": "doubao-pro-32k",
            "conversationId": conv_id,
        },
        headers=auth_headers_acme,
    )
    assert resp.status_code == 200, resp.text
    # Drain the SSE stream so the event_stream() coroutine finishes the
    # post-stream DB write before we query back.
    body = resp.text
    assert "data: [DONE]" in body, body

    # 3) GET /conversations/{id}/messages — both rows should be persisted
    listed = sql_client.get(
        f"/api/v1/copilot/conversations/{conv_id}/messages",
        headers=auth_headers_acme,
    )
    assert listed.status_code == 200, listed.text
    items = listed.json()["data"]["items"]
    assert len(items) == 2, items

    by_role = {m["role"]: m for m in items}
    assert set(by_role) == {"user", "assistant"}, by_role

    user_msg = by_role["user"]
    assert user_msg["content"] == "请帮我处理对账单", user_msg
    user_meta = user_msg["metadata"]
    assert user_meta.get("model") == "doubao-pro-32k", user_meta

    ai_msg = by_role["assistant"]
    assert "调度完成" in ai_msg["content"], ai_msg
    ai_meta = ai_msg["metadata"]
    assert ai_meta.get("model") == "doubao-pro-32k", ai_meta

    # agentSteps timeline must include reasoning + tool_call + tool_result
    agent_steps = ai_meta.get("agentSteps")
    assert isinstance(agent_steps, list), ai_meta
    types = [s.get("type") for s in agent_steps]
    assert "reasoning" in types, types
    assert "tool_call" in types, types
    assert "tool_result" in types, types
    # the final assistant text itself should NOT be in agentSteps
    # (it's the parent message.content, not part of the timeline).
    assert "final" not in types, types

    # 4) conversation aggregate was updated
    convs = sql_client.get(
        "/api/v1/copilot/conversations",
        headers=auth_headers_acme,
    ).json()["items"]
    conv = next(c for c in convs if c["id"] == conv_id)
    assert conv["messageCount"] == 2, conv
    assert conv["preview"], conv


def test_agent_stream_without_conversation_id_still_streams(
    sql_client, auth_headers_acme, monkeypatch,
) -> None:
    """No conversationId → still works (back-compat), no DB rows written."""
    from mate_app_copilot.api import app as copilot_app_module

    monkeypatch.setattr(copilot_app_module, "OrchestratorClient", _StubOrchestratorClient)
    monkeypatch.setattr(copilot_app_module, "run_agent_loop", _fake_run_agent_loop)

    resp = sql_client.post(
        "/api/v1/copilot/chat/agent/stream",
        json={
            "messages": [{"role": "user", "content": "裸跑一个 agent turn"}],
            "model": "doubao-pro-32k",
        },
        headers=auth_headers_acme,
    )
    assert resp.status_code == 200, resp.text
    assert "data: [DONE]" in resp.text, resp.text