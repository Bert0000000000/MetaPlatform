"""Agent loop unit tests: FC decision → dispatch → feed-back → events."""
from __future__ import annotations

import asyncio

import pytest

from mate_app_copilot.agent_loop import (
    _await_task_result,
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


def _drop_reasoning(events: list[dict]) -> list[dict]:
    return [e for e in events if e.get("type") != "reasoning"]


class FakeLlm:
    """Fake non-streaming llmgw FC client: returns a scripted list of decisions."""

    def __init__(self, decisions: list[dict]) -> None:
        self._decisions = list(decisions)
        self.calls: list[dict] = []

    async def chat_with_tools(self, *, messages, model, tools, **kwargs):
        self.calls.append({"messages": messages, "tools": tools})
        assert tools
        return self._decisions.pop(0)


class FakeStreamLlm:
    """Fake streaming llmgw FC client: yields token/done events per turn."""

    def __init__(self, turns: list[list[dict]]) -> None:
        self._turns = list(turns)
        self.calls: list[dict] = []

    async def stream_chat_real_tools(self, *, messages, model, tools, **kwargs):
        self.calls.append({"messages": messages, "tools": tools})
        assert tools
        for ev in self._turns.pop(0):
            yield ev


def _stream_for_decision(content: str = "", reasoning: str = "", tool_calls: list[dict] | None = None) -> list[dict]:
    events: list[dict] = []
    if reasoning:
        events.append({
            "type": "token",
            "content": "",
            "reasoning_content": reasoning,
            "tool_calls": [],
        })
    events.append({
        "type": "done",
        "content": content,
        "reasoning_content": reasoning,
        "tool_calls": tool_calls or [],
        "finish_reason": "stop",
        "usage": {},
    })
    return events


class FakeOrch:
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.status_calls: list[str] = []
        self.task_statuses: dict[str, dict] = {}

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

    async def get_task_status(self, *, task_id, tenant_id, fallback_token=None):
        self.status_calls.append(task_id)
        return self.task_statuses.get(task_id, {"status": {"state": "submitted"}})


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
    """reasoning placeholder → tool_call → dispatch → tool_result → final text."""
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
    assert types[0] == "reasoning" and events[0]["text"]
    dropped = _drop_reasoning(events)
    assert [e["type"] for e in dropped] == ["tool_call", "tool_result", "final"]

    tc = dropped[0]
    assert tc["tool"] == "dispatch_employee"
    assert tc["args"] == {"target_rid": "workflow", "message": "处理对账单"}

    tr = dropped[1]
    assert tr["status"] == "success"
    assert tr["result"]["role"] == "workflow"
    assert tr["result"]["result"]["target_agent_id"] == "agent-recon"

    assert dropped[2]["content"] == "已调度 workflow 处理对账单，任务 task-a2a-1 已提交。"


@pytest.mark.asyncio
async def test_loop_streaming_reasoning_and_decision() -> None:
    """Streaming decision turn surfaces reasoning tokens live, then dispatches."""
    llm = FakeStreamLlm([
        _stream_for_decision(
            content="我来调度 workflow 员工处理。",
            reasoning="用户在要求调度对账任务，workflow 员工最合适。",
            tool_calls=[{
                "id": "call-s1", "type": "function",
                "function": {"name": "dispatch_employee",
                             "arguments": '{"target_rid": "workflow", "message": "处理对账单"}'},
            }],
        ),
        _stream_for_decision(content="已调度完成。", reasoning=""),
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
    reasoning = [e for e in events if e["type"] == "reasoning"]
    assert reasoning[0]["text"] == "正在分析任务并选择数字员工…"
    assert any("workflow 员工最合适" in e["text"] for e in reasoning)
    dropped = _drop_reasoning(events)
    assert [e["type"] for e in dropped] == ["tool_call", "tool_result", "final"]
    assert orch.calls == [{"target_rid": "workflow", "arguments": {"message": "处理对账单"}}]


@pytest.mark.asyncio
async def test_loop_parallel_dispatch() -> None:
    """One decision with two dispatch calls → both dispatched, both results fed back."""
    decision = {
        "content": "并行调度两个员工。",
        "tool_calls": [
            {"id": "c1", "type": "function",
             "function": {"name": "dispatch_employee",
                          "arguments": '{"target_rid": "workflow", "message": "处理对账"}'}},
            {"id": "c2", "type": "function",
             "function": {"name": "dispatch_employee",
                          "arguments": '{"target_rid": "knowledge", "message": "检索资料"}'}},
        ],
    }
    llm = FakeLlm([decision, _plain_decision("两个员工都调度完成。")])
    orch = FakeOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "同时调度 workflow 和 knowledge"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ])
    tool_calls = [e for e in events if e["type"] == "tool_call"]
    tool_results = [e for e in events if e["type"] == "tool_result"]
    assert len(tool_calls) == 2
    assert len(tool_results) == 2
    assert {t["args"]["target_rid"] for t in tool_calls} == {"workflow", "knowledge"}
    assert all(t["status"] == "success" for t in tool_results)
    assert sorted(c["target_rid"] for c in orch.calls) == ["knowledge", "workflow"]
    last = llm.calls[-1]["messages"]
    assistant_tc = [m for m in last if m["role"] == "assistant" and m.get("tool_calls")]
    assert len(assistant_tc) == 1
    assert len(assistant_tc[0]["tool_calls"]) == 2


@pytest.mark.asyncio
async def test_loop_invalid_target_rid_no_network() -> None:
    """A dispatch_employee call with an unknown target_rid → error, no network call."""
    decision = {
        "content": "调度一个不存在的员工。",
        "tool_calls": [{
            "id": "c-bad", "type": "function",
            "function": {"name": "dispatch_employee",
                         "arguments": '{"target_rid": "ghost", "message": "随便"}'},
        }],
    }
    llm = FakeLlm([decision, _plain_decision("无法调度。")])
    orch = FakeOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "调度 ghost 员工"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ])
    tr = next(e for e in events if e["type"] == "tool_result")
    assert tr["status"] == "error"
    assert "ghost" in tr["result"]["error"]
    assert orch.calls == []


@pytest.mark.asyncio
async def test_loop_dispatch_timeout() -> None:
    """Dispatch exceeding the deadline → tool_result error, loop continues."""

    class SlowOrch(FakeOrch):
        async def dispatch(self, **kwargs):
            await asyncio.sleep(5)
            return {"status": "completed"}

    llm = FakeLlm([
        _tool_call_decision("workflow", "任务", "call-t"),
        _plain_decision("调度超时，请稍后重试。"),
    ])
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=SlowOrch(),
            messages=[{"role": "user", "content": "调度 workflow"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            dispatch_timeout=0.05,
        )
    ])
    tr = next(e for e in events if e["type"] == "tool_result")
    assert tr["status"] == "error"
    assert "timeout" in tr["result"]["error"]


@pytest.mark.asyncio
async def test_loop_polls_async_task() -> None:
    """A submitted/pending dispatch is polled until a terminal state."""

    class AsyncOrch(FakeOrch):
        def __init__(self) -> None:
            super().__init__()
            self.polls = 0

        async def dispatch(self, **kwargs):
            return {"task_id": "task-abc", "status": "submitted",
                    "worker_kind": "a2a"}

        async def get_task_status(self, **kwargs):
            self.polls += 1
            if self.polls >= 2:
                return {"id": "task-abc", "status": {"state": "completed"},
                        "artifacts": [{"parts": [{"kind": "data",
                                                  "data": {"result": {"out": "done"}}}]}]}
            return {"id": "task-abc", "status": {"state": "working"}}

    llm = FakeLlm([
        _tool_call_decision("workflow", "异步任务", "call-p"),
        _plain_decision("任务已完成。"),
    ])
    orch = AsyncOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "调度 workflow 异步任务"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            poll_timeout=5,
            poll_interval=0.01,
        )
    ])
    tr = next(e for e in events if e["type"] == "tool_result")
    assert tr["status"] == "success"
    assert tr["result"]["status"] == "completed"
    assert tr["result"]["polled_result"] == {"out": "done"}
    assert orch.polls >= 2


@pytest.mark.asyncio
async def test_loop_poll_timeout_truthful() -> None:
    """A task that never reaches terminal state → polled_state timeout, no fake success."""
    llm = FakeLlm([
        _tool_call_decision("workflow", "挂起的任务", "call-h"),
        _plain_decision("任务仍在处理中。"),
    ])

    class PendingOrch(FakeOrch):
        async def dispatch(self, **kwargs):
            return {"task_id": "task-xyz", "status": "submitted", "worker_kind": "a2a"}

        async def get_task_status(self, **kwargs):
            return {"id": "task-xyz", "status": {"state": "submitted"}}

    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=PendingOrch(),
            messages=[{"role": "user", "content": "调度 workflow"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            poll_timeout=0.02,
            poll_interval=0.005,
        )
    ])
    tr = next(e for e in events if e["type"] == "tool_result")
    assert tr["status"] == "success"
    assert tr["result"]["polled_state"] == "timeout"


@pytest.mark.asyncio
async def test_loop_cap_structured_summary() -> None:
    """Hitting the iteration cap → structured summary listing dispatched employees."""
    llm = FakeLlm([
        _tool_call_decision("workflow", "任务1", "call-a"),
        _tool_call_decision("knowledge", "任务2", "call-b"),
        _plain_decision("不需要了。"),
    ])
    orch = FakeOrch()
    events = _collect([
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "调度多个员工"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            max_iterations=2,
        )
    ])
    final = events[-1]
    assert final["type"] == "final"
    assert "workflow" in final["content"]
    assert "knowledge" in final["content"]
    assert "orch-knowledge-1" in final["content"]


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
    assert [e["type"] for e in events] == ["reasoning", "final"]
    assert events[-1]["content"] == "好的，还有什么可以帮你？"
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
    assert events[-1] == {"type": "final", "content": "没有可用的数字员工。"}


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
    tr = events[2]
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
    assert [e["type"] for e in _drop_reasoning(events)] == ["tool_call", "tool_result", "final"]
    tc = next(e for e in events if e["type"] == "tool_call")
    assert tc["args"]["target_rid"] == "workflow"
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
    assert events[-1] == {"type": "final", "content": "LLM 决策服务不可用，且未匹配到可调度的数字员工。"}
    assert orch.calls == []


def test_fallback_decision_keyword_match() -> None:
    d = _fallback_decision(
        [{"role": "user", "content": "调度 knowledge 员工做检索"}], ROLES,
    )
    assert d is not None
    assert d["tool_calls"][0]["function"]["name"] == "dispatch_employee"
    assert d["tool_calls"][0]["function"]["arguments"].find("knowledge") != -1
    assert _fallback_decision([{"role": "user", "content": "你好"}], ROLES) is None


@pytest.mark.asyncio
async def test_await_task_result_returns_early_when_terminal() -> None:
    """Non-submitted/pending results are returned unchanged (no polling)."""
    orch = FakeOrch()
    result = {"task_id": "t1", "status": "completed"}
    out = await _await_task_result(
        orch, result, tenant_id="t", fallback_token="", timeout=5, interval=0.01,
    )
    assert out == result
    assert not orch.status_calls