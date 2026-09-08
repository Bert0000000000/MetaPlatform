"""Integration tests for agent_loop + semantic_router + dispatcher (MP-SR-01).

Covers:
  - routing_decision SSE event emitted before first reasoning
  - candidate_roles narrows system prompt
  - LLM-down fallback via dispatcher chain
  - No-tool-call fallback via dispatcher chain
  - Existing LLM-FC happy path still works with semantic routing enabled
"""
from __future__ import annotations

import pytest

from mate_app_copilot import agent_loop
from mate_app_copilot.agent_loop import (
    build_system_prompt,
    run_agent_loop,
)
from mate_app_copilot.clients.llmgw_stream import LlmgwStreamError
from mate_app_copilot.dispatcher import (
    DEFAULT_CHAIN,
    DispatchResult,
    FallbackStep,
)
from mate_app_copilot.semantic_router import CandidateRole, SemanticRouter

# Reuse the ROLES fixture pattern from test_agent_loop.py
ROLES = [
    {"role": "workflow", "name": "Workflow Employee",
     "capabilities": [{"name": "delegate_run"}, {"name": "approve"}]},
    {"role": "knowledge", "name": "Knowledge Employee",
     "capabilities": [{"name": "kb_search"}, {"name": "rag_query"}]},
]


def _drop(events: list[dict], *types: str) -> list[dict]:
    return [e for e in events if e.get("type") not in types]


def _drop_reasoning_and_routing(events: list[dict]) -> list[dict]:
    return _drop(events, "reasoning", "routing_decision")


# ---------------------------------------------------------------------------
# Stub clients (same shape as test_agent_loop)
# ---------------------------------------------------------------------------
class _FakeLlm:
    def __init__(self, decisions: list[dict]) -> None:
        self._decisions = list(decisions)

    async def chat_with_tools(self, *, messages, model, tools, **kwargs):
        return self._decisions.pop(0)


class _DownLlm(_FakeLlm):
    async def chat_with_tools(self, **kwargs):
        raise LlmgwStreamError("provider unavailable")


class _FakeOrch:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def list_roles(self, **kwargs):
        return list(ROLES)

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

    async def get_task_status(self, **kwargs):
        return {"status": {"state": "completed"}}


def _tool_call_decision(target: str, message: str, call_id: str = "call-1") -> dict:
    return {
        "content": "我来调度员工",
        "tool_calls": [{
            "id": call_id, "type": "function",
            "function": {"name": "dispatch_employee",
                         "arguments": f'{{"target_rid": "{target}", "message": "{message}"}}'},
        }],
    }


def _plain_decision(text: str) -> dict:
    return {"content": text, "tool_calls": []}


def _assert_denied(event: dict, *, reason_code: str) -> None:
    assert event["type"] == "routing_decision"
    assert event["stage"] == "final"
    assert event["outcome"] == "denied"
    assert event["reason_code"] == reason_code
    assert event["selected"] is None
    assert isinstance(event["candidates"], list)
    assert event["candidate_count"] == len(event["candidates"])
    assert event["policy_version"] == "semantic-router-v1"
    assert event["trace_id"]
    assert event["trace_id"] == event["correlation_id"]
    assert "content" not in event


class _NoCandidateRouter:
    policy = SemanticRouter().policy

    def route(self, *args, **kwargs) -> list[CandidateRole]:
        return []


# ---------------------------------------------------------------------------
# routing_decision SSE event
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_routing_decision_event_emitted_before_reasoning() -> None:
    llm = _FakeLlm([_tool_call_decision("workflow", "任务", "c-1"),
                    _plain_decision("done")])
    orch = _FakeOrch()
    events = [
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我发起 approve 审批"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]
    types = [e["type"] for e in events]
    # routing_decision must be the FIRST event
    assert types[0] == "routing_decision"

    rd = events[0]
    assert "candidates" in rd
    assert "selected" in rd
    assert "reason" in rd
    assert isinstance(rd["candidates"], list)
    # all candidates have role_slug
    assert all("role_slug" in c for c in rd["candidates"])


@pytest.mark.asyncio
async def test_model_selected_role_emits_final_decision_before_dispatch() -> None:
    llm = _FakeLlm([
        _tool_call_decision("workflow", "发起审批", "c-1"),
        _plain_decision("done"),
    ])
    orch = _FakeOrch()
    events = [
        event async for event in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请发起审批"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]

    selected_index = next(
        index for index, event in enumerate(events)
        if event.get("type") == "routing_decision"
        and event.get("stage") == "final"
        and event.get("outcome") == "selected"
    )
    tool_call_index = next(
        index for index, event in enumerate(events)
        if event.get("type") == "tool_call"
    )
    selected = events[selected_index]
    assert selected["selected"] == "workflow"
    assert selected["reason_code"] == "model_selected"
    assert selected_index < tool_call_index


@pytest.mark.asyncio
async def test_routing_decision_candidates_are_top_k() -> None:
    llm = _FakeLlm([_tool_call_decision("workflow", "任务", "c-1"),
                    _plain_decision("done")])
    orch = _FakeOrch()
    events = [
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我发起 approve 审批"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            candidate_top_k=2,
        )
    ]
    rd = events[0]
    assert len(rd["candidates"]) == 2
    sims = [c["similarity"] for c in rd["candidates"]]
    assert sims == sorted(sims, reverse=True)


@pytest.mark.asyncio
async def test_routing_decision_empty_when_no_user_message() -> None:
    llm = _FakeLlm([_plain_decision("done")])
    orch = _FakeOrch()
    events = [
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "system", "content": "system only"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]
    rd = events[0]
    assert rd["candidates"] == []


@pytest.mark.asyncio
async def test_empty_authorized_snapshot_is_denied_without_model_or_dispatch() -> None:
    llm = _FakeLlm([_tool_call_decision("workflow", "should not run")])
    orch = _FakeOrch()
    events = [
        event async for event in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请处理订单"}],
            model="doubao-pro-32k",
            roles=[],
            tenant_id="tenant-acme",
            capability_version="snapshot-empty",
        )
    ]

    _assert_denied(events[0], reason_code="no_authorized_roles")
    assert llm._decisions
    assert orch.calls == []


@pytest.mark.asyncio
async def test_candidate_outside_authorized_snapshot_is_denied_without_dispatch() -> None:
    llm = _FakeLlm([_tool_call_decision("forbidden-role", "should not run")])
    orch = _FakeOrch()
    events = [
        event async for event in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请处理订单"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]

    _assert_denied(events[-1], reason_code="target_not_authorized")
    assert events[-1]["taken_path"] == "llm_fc"
    assert orch.calls == []


@pytest.mark.asyncio
async def test_empty_authorized_candidates_are_denied_before_model_or_dispatch() -> None:
    llm = _FakeLlm([_tool_call_decision("workflow", "should not run")])
    orch = _FakeOrch()
    events = [
        event async for event in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请处理订单"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            semantic_router=_NoCandidateRouter(),
        )
    ]

    _assert_denied(events[-1], reason_code="no_authorized_candidates")
    assert llm._decisions
    assert not any(event["type"] == "tool_call" for event in events)
    assert orch.calls == []


@pytest.mark.asyncio
async def test_empty_candidates_with_ontology_tools_still_reject_employee_dispatch() -> None:
    llm = _FakeLlm([_tool_call_decision("workflow", "should not run")])
    orch = _FakeOrch()
    events = [
        event async for event in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "查本体后帮我派发"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            semantic_router=_NoCandidateRouter(),
            ontology_tools=[
                {"type": "function", "function": {"name": "list_classes", "parameters": {}}}
            ],
            ontology_tool_exec=lambda _name, _args: {},
        )
    ]

    _assert_denied(events[-1], reason_code="no_authorized_candidates")
    assert not any(event["type"] == "tool_call" for event in events)
    assert orch.calls == []


# ---------------------------------------------------------------------------
# candidate_roles narrows system prompt
# ---------------------------------------------------------------------------
def test_build_system_prompt_with_candidate_roles_only_lists_them() -> None:
    cand = [
        CandidateRole(
            role_slug="workflow", role_rid="wfe.x",
            display_name="Workflow Employee",
            capability_tags=("delegate_run", "approve"),
            similarity=0.42, reason="embedding cosine",
        ),
    ]
    prompt = build_system_prompt(ROLES, candidate_roles=cand)
    assert "workflow" in prompt
    assert "knowledge" not in prompt  # knowledge excluded
    assert "候选已由 semantic_router 预筛" in prompt


def test_build_system_prompt_without_candidate_lists_all() -> None:
    prompt = build_system_prompt(ROLES)
    assert "workflow" in prompt and "knowledge" in prompt
    assert "候选已由 semantic_router 预筛" not in prompt


def test_build_system_prompt_with_empty_candidate_lists_all() -> None:
    prompt = build_system_prompt(ROLES, candidate_roles=[])
    assert "workflow" in prompt and "knowledge" in prompt


# ---------------------------------------------------------------------------
# Routing uncertainty is fail-closed
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_llm_down_is_denied_before_any_tool_call() -> None:
    """A lost LLM decision must not become a keyword-selected dispatch."""
    orch = _FakeOrch()
    events = [
        e async for e in run_agent_loop(
            llmgw_client=_DownLlm([]),
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我用 workflow 跑一下"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]
    _assert_denied(events[-1], reason_code="llm_unavailable")
    assert not any(event["type"] == "tool_call" for event in events)
    assert orch.calls == []


@pytest.mark.asyncio
async def test_missing_dispatch_tool_call_is_denied_before_any_tool_call() -> None:
    """Plain LLM text must not be upgraded by semantic or keyword matching."""
    llm = _FakeLlm([_plain_decision("我不确定派谁")])
    orch = _FakeOrch()

    async def _dispatch_by_routing(user_message, available_roles, **_):
        return DispatchResult(
            source="embedding_match",
            target_rid="workflow",
            reason="semantic match must not authorize dispatch",
        )

    events = [
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我用 workflow 处理对账"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            dispatch_by_routing_fn=_dispatch_by_routing,
        )
    ]
    _assert_denied(events[-1], reason_code="missing_dispatch_tool_call")
    assert not any(event["type"] == "tool_call" for event in events)
    assert orch.calls == []


@pytest.mark.asyncio
async def test_llm_down_is_denied_without_calling_dispatcher() -> None:
    """All LLM outages deny; dispatcher is not an outage fallback."""
    orch = _FakeOrch()
    dispatcher_called = False

    async def _dispatch_by_routing(**_):
        nonlocal dispatcher_called
        dispatcher_called = True
        return DispatchResult(source="a2a", target_rid="workflow", reason="authorized")

    events = [
        e async for e in run_agent_loop(
            llmgw_client=_DownLlm([]),
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我用 workflow 跑一下"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            dispatch_by_routing_fn=_dispatch_by_routing,
        )
    ]
    _assert_denied(events[-1], reason_code="llm_unavailable")
    assert dispatcher_called is False
    assert not any(event["type"] == "tool_call" for event in events)
    assert orch.calls == []


@pytest.mark.asyncio
async def test_missing_llm_decision_is_denied_before_any_tool_call(monkeypatch) -> None:
    async def _empty_decision_turn(*args, **kwargs):
        if False:
            yield {}

    monkeypatch.setattr(agent_loop, "_decision_turn", _empty_decision_turn)
    orch = _FakeOrch()
    events = [
        event async for event in run_agent_loop(
            llmgw_client=_FakeLlm([]),
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请处理订单"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]

    _assert_denied(events[-1], reason_code="llm_decision_missing")
    assert not any(event["type"] == "tool_call" for event in events)
    assert orch.calls == []


# ---------------------------------------------------------------------------
# Semantic router injection
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_custom_semantic_router_used() -> None:
    """Caller-provided SemanticRouter is reused (cache size grows)."""
    router = SemanticRouter()
    llm = _FakeLlm([_tool_call_decision("workflow", "任务", "c-1"),
                    _plain_decision("done")])
    orch = _FakeOrch()
    [
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我发起 approve 审批"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            semantic_router=router,
        )
    ]
    # after the run, router has cached entries for both roles
    assert router.cache_size() >= 1


# ---------------------------------------------------------------------------
# Existing happy path with semantic routing enabled
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_full_happy_path_with_semantic_routing_enabled() -> None:
    llm = _FakeLlm([_tool_call_decision("workflow", "对账", "c-1"),
                    _plain_decision("完成")])
    orch = _FakeOrch()
    events = [
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我用 workflow 跑对账"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]
    # First iteration dispatches; the follow-up text is the ordinary user answer.
    types = [e["type"] for e in events]
    assert types[0] == "routing_decision"
    assert "routing_decision" in types
    assert "tool_call" in types
    assert "tool_result" in types
    assert types[-1] == "final"
    assert orch.calls and orch.calls[0]["target_rid"] == "workflow"
    final_selection = next(
        event for event in events
        if event["type"] == "routing_decision" and event.get("selected") == "workflow"
    )
    assert final_selection["taken_path"] == "llm_fc"
    assert events[-1]["content"] == "完成"


# ---------------------------------------------------------------------------
# DEFAULT_CHAIN smoke
# ---------------------------------------------------------------------------
def test_default_chain_includes_only_authorized_a2a() -> None:
    kinds = {s.kind for s in DEFAULT_CHAIN}
    assert kinds == {"a2a"}


def test_fallback_step_constructor() -> None:
    s = FallbackStep("a2a", target="agent-x")
    assert s.kind == "a2a"
    assert s.target == "agent-x"
    s2 = FallbackStep("keyword_substring")
    assert s2.target is None
