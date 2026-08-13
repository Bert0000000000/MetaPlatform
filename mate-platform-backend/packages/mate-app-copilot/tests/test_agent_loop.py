"""Agent loop unit tests: FC decision → dispatch → feed-back → events."""
from __future__ import annotations

import pytest

from mate_app_copilot.agent_loop import (
    _fallback_decision,
    build_system_prompt,
    build_tools,
    run_agent_loop,
)
from mate_app_copilot.clients.llmgw_stream import LlmgwStreamError
from mate_app_copilot.clients.orchestrator_client import OrchestratorClientError

ROLES = [
    {"role": "workflow", "name": "Workflow Employee",
     "capabilities": [{"name": "delegate_run", "worker_kind": "a2a", "ref": "agent-recon"}]},
    {"role": "knowledge", "name": "Knowledge Employee",
     "capabilities": [{"name": "kb_search", "worker_kind": "local", "ref": ""}]},
]


class FakeLlm:
    """Fake llmgw FC client: returns a scripted list of decision responses."""

    def __init__(self, decisions: list[dict]) -> None:
        self._decisions = list(decisions)
        self.calls: list[dict] = []

    async def chat_with_tools(self, *, messages, model, tools, **kwargs):
        self.calls.append({"messages": messages, "tools": tools})
        assert tools  # dispatch tool should be exposed when roles exist
        return self._decisions.pop(0)


class FakeOrch:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def list_roles(self, *, tenant_id, fallback_token=None):
        return ROLES

    async def dispatch(self, *, tenant_id, target_rid, action="", arguments=None, fallback_token=None):
        self.calls.append({"target_rid": target_rid, "arguments": arguments})
        return {
            "task_id": f"orch-{target_rid}-1",
            "role": target_rid,
            "capability": "delegate_run",
            "worker_kind": "a2a",
            "result": {"id": "task-a2a-1", "status": {"state": "submitted"},
                       "target_agent_id": "agent-recon"},
            "status": "completed",
        }


def _tool_call_decision(target: str, message: str, call_id: str = "call-1") -> dict:
    return {
        "content": "我来调度 workflow 员工处理。",
        "tool_calls": [{
            "id": call_id,
            "type": "function",
            "function": {"name": "dispatch_employee",
                         "arguments": f'{{"target_rid": "{target}", "message": "{message}"}}'},
        }],
    }


def _plain_decision(text: str) -> dict:
    return {"content": text, "tool_calls": []}


def _collect(events) -> list[dict]:
    return list(events)


@pytest.mark.asyncio
async def test_loop_dispatch_then_final() -> None:
    """tool_call → dispatch → tool_result → final text."""
    llm = FakeLlm([
        _tool_call_decision("workflow", "处理对账单", "call-abc"),
        _plain_decision("已调度 workflow 处理对账单，任务 task-a2a-1 已提交。"),
    ])
    orch = FakeOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "帮我调度 workflow 处理对账单"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ])
    types = [e["type"] for e in events]
    assert types == ["tool_call", "tool_result", "final"]

    tc = events[0]
    assert tc["tool"] == "dispatch_employee"
    assert tc["args"] == {"target_rid": "workflow", "message": "处理对账单"}

    tr = events[1]
    assert tr["status"] == "success"
    assert tr["result"]["role"] == "workflow"
    assert tr["result"]["result"]["target_agent_id"] == "agent-recon"

    assert events[2]["content"] == "已调度 workflow 处理对账单，任务 task-a2a-1 已提交。"

    # dispatch was really called with the right args.
    assert orch.calls == [{"target_rid": "workflow", "arguments": {"message": "处理对账单"}}]
    # tool result was fed back to the LLM as a tool message.
    last = llm.calls[-1]["messages"]
    assert any(m["role"] == "tool" and "task-a2a-1" in m["content"] for m in last)


@pytest.mark.asyncio
async def test_loop_plain_text_no_dispatch() -> None:
    """No tool call → final text only, no dispatch."""
    llm = FakeLlm([_plain_decision("好的，还有什么可以帮你？")])
    orch = FakeOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "你好"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ])
    assert [e["type"] for e in events] == ["final"]
    assert orch.calls == []


@pytest.mark.asyncio
async def test_loop_no_roles_no_tools() -> None:
    """No registered roles → tools empty → plain chat."""

    class NoToolLlm(FakeLlm):
        async def chat_with_tools(self, *, messages, model, tools, **kwargs):
            self.calls.append({"messages": messages, "tools": tools})
            assert not tools
            return self._decisions.pop(0)

    llm2 = NoToolLlm([_plain_decision("没有可用的数字员工。")])
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm2,
            orchestrator_client=FakeOrch(),
            messages=[{"role": "user", "content": "hi"}],
            model="doubao-pro-32k",
            roles=[],
            tenant_id="tenant-acme",
        )
    ])
    assert events == [{"type": "final", "content": "没有可用的数字员工。"}]


@pytest.mark.asyncio
async def test_loop_dispatch_error_reported() -> None:
    """orchestrator dispatch failure → tool_result error event → loop continues."""
    llm = FakeLlm([
        _tool_call_decision("workflow", "任务", "call-x"),
        _plain_decision("调度失败，请检查。"),
    ])

    class FailingOrch(FakeOrch):
        async def dispatch(self, **kwargs):
            raise OrchestratorClientError("role not registered")

    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=FailingOrch(),
            messages=[{"role": "user", "content": "调度 workflow"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ])
    tr = events[1]
    assert tr["status"] == "error"
    assert "role not registered" in tr["result"]["error"]


def test_build_system_prompt_lists_roles() -> None:
    prompt = build_system_prompt(ROLES)
    assert "workflow" in prompt and "knowledge" in prompt
    assert "delegate_run" in prompt


def test_build_tools_enum_slugs() -> None:
    tools = build_tools(ROLES)
    assert tools
    enum = tools[0]["function"]["parameters"]["properties"]["target_rid"]["enum"]
    assert enum == ["workflow", "knowledge"]
    assert build_tools([]) == []


@pytest.mark.asyncio
async def test_loop_llm_down_falls_back_to_keyword_dispatch() -> None:
    """LLM FC unavailable → keyword match triggers dispatch (degraded mode)."""

    class DownLlm(FakeLlm):
        async def chat_with_tools(self, **kwargs):
            raise LlmgwStreamError("provider unavailable")

    orch = FakeOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=DownLlm([]),
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请调度 workflow 处理对账单"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ])
    assert [e["type"] for e in events] == ["tool_call", "tool_result", "final"]
    assert events[0]["args"]["target_rid"] == "workflow"
    assert orch.calls[0]["target_rid"] == "workflow"


@pytest.mark.asyncio
async def test_loop_llm_down_no_match_final_note() -> None:
    """LLM down + no keyword match → graceful final note, no dispatch."""

    class DownLlm(FakeLlm):
        async def chat_with_tools(self, **kwargs):
            raise LlmgwStreamError("provider unavailable")

    orch = FakeOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=DownLlm([]),
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "今天天气怎么样"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ])
    assert events == [{"type": "final", "content": "LLM 决策服务不可用，且未匹配到可调度的数字员工。"}]
    assert orch.calls == []


def test_fallback_decision_keyword_match() -> None:
    d = _fallback_decision(
        [{"role": "user", "content": "调度 knowledge 员工做检索"}], ROLES,
    )
    assert d is not None
    assert d["tool_calls"][0]["function"]["name"] == "dispatch_employee"
    assert d["tool_calls"][0]["function"]["arguments"].find("knowledge") != -1
    assert _fallback_decision([{"role": "user", "content": "你好"}], ROLES) is None
