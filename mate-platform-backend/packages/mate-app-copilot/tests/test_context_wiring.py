"""ADR-0065 / `MP-CONTEXT-AWARE-01` S1 的**接线**判据：信封真的进了 system prompt。

`test_context_envelope.py` 验的是解析与渲染这个**纯函数**。这里补的是另一半：
`POST /chat/agent/stream` 拿到 `context` 之后，**确实**把渲染出来的标记挂到了交给
agent loop 的 messages 上。两半缺一不可——只测渲染的话，"函数很对但没人调它"
会一路绿到底。

<200 行、一个用例，所以不另开目录。
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest
from fastapi.testclient import TestClient


class _StubOrchestratorClient:
    """最小的角色快照桩（与 `test_agent_stream_persistence` 同款）。

    没有它，`/chat/agent/stream` 会在**角色快照**那一步就 `return` 掉
    （`role_snapshot_unavailable`），根本走不到 agent loop——那样这条用例就变成
    "什么都没验"的假绿。
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.auth = kwargs.get("auth")

    async def authorized_role_snapshot(
        self, *, tenant_id: str, fallback_token: str | None = None
    ) -> dict[str, Any]:
        return {
            "items": [
                {
                    "role": "workflow",
                    "name": "Workflow Employee",
                    "capabilities": [
                        {"name": "delegate_run", "worker_kind": "a2a", "ref": "agent-recon"}
                    ],
                }
            ],
            "capability_version": "snapshot-v1",
            "actor_roles_digest": "actor-roles-v1",
        }


@pytest.fixture
def captured_messages(monkeypatch: pytest.MonkeyPatch) -> list[list[dict[str, Any]]]:
    """把 `run_agent_loop` 换成"记下 messages 就收工"的桩。

    返回的列表每项是一次调用的 messages——用例断言系统消息里有没有那段标记。
    """
    from mate_app_copilot.api import app as copilot_app

    captured: list[list[dict[str, Any]]] = []

    async def _fake(**kwargs: Any) -> AsyncIterator[dict[str, Any]]:
        captured.append(list(kwargs.get("messages") or []))
        yield {"type": "content", "content": "ok"}
        yield {"type": "done"}

    monkeypatch.setattr(copilot_app, "OrchestratorClient", _StubOrchestratorClient)
    monkeypatch.setattr(copilot_app, "run_agent_loop", _fake)
    return captured


def _system_content(messages: list[dict[str, Any]]) -> str:
    return "\n".join(str(m.get("content", "")) for m in messages if m.get("role") == "system")


def test_layered_context_is_attached_to_the_system_message(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    captured_messages: list[list[dict[str, Any]]],
) -> None:
    response = client.post(
        "/api/v1/copilot/chat/agent/stream",
        json={
            "messages": [{"role": "user", "content": "这个对象最近怎么样"}],
            "model": "doubao-pro-32k",
            "context": {
                "navigation": {"view": "ontology-objects", "url": "/ontology/objects?c=customer"},
                "selection": {
                    "kind": "ontology.instances",
                    "items": [{"rid": "obj-123", "label": "客户A"}],
                },
            },
        },
        headers=auth_headers_acme,
    )
    assert response.status_code == 200, response.text
    assert captured_messages, "agent loop 没被调用，这条用例没验到接线"

    system = _system_content(captured_messages[0])
    assert "- selected[ontology.instances]: obj-123 客户A" in system
    assert "[Context Protocol]" in system
    assert "按 RID 取回当前状态" in system, "水合约定（准出 ② 的行为落点）必须在 prompt 里"


def test_legacy_only_context_still_reaches_the_prompt_unchanged(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    captured_messages: list[list[dict[str, Any]]],
) -> None:
    """R3 的端到端那一半：旧宿主发的东西到了 prompt 里，且**没有**多出协议段。"""
    response = client.post(
        "/api/v1/copilot/chat/agent/stream",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "model": "doubao-pro-32k",
            "context": {
                "interaction": {"appCode": "app-x", "pageCode": "ontology-domain"},
                "subject": {"conceptCode": "customer"},
            },
        },
        headers=auth_headers_acme,
    )
    assert response.status_code == 200, response.text
    system = _system_content(captured_messages[0])
    assert "- appCode: app-x" in system
    assert "- subject_concept: customer" in system
    assert "[Context Protocol]" not in system, "旧宿主不该被塞进新协议段"


def test_string_context_does_not_break_the_stream(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    captured_messages: list[list[dict[str, Any]]],
) -> None:
    """既有探针（把 context 直接传字符串）必须仍然只是"没有上下文"，不 500。"""
    response = client.post(
        "/api/v1/copilot/chat/agent/stream",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "model": "doubao-pro-32k",
            "context": "please send an email to the customer",
        },
        headers=auth_headers_acme,
    )
    assert response.status_code == 200, response.text
    assert "[Interaction Context]" not in _system_content(captured_messages[0])


__all__: list[str] = []
