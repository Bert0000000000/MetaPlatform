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

from mate_app_copilot.agent_loop import (
    build_system_prompt,
    run_agent_loop,
)
from mate_app_copilot.clients.llmgw_stream import LlmgwStreamError
from mate_app_copilot.dispatcher import (
    DEFAULT_CHAIN,
    DispatchResult,
    FallbackStep,
    make_keyword_substring_handler,
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
# LLM-down fallback via dispatcher chain
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_llm_down_falls_back_via_dispatcher_chain() -> None:
    """LLM down + dispatcher fallback → dispatcher keyword_substring hits."""
    orch = _FakeOrch()
    # Wrap the existing keyword_substring factory as dispatcher fn
    kw_handler = make_keyword_substring_handler()

    async def _dispatch_by_routing(user_message, available_roles, **_):
        res = kw_handler(user_message, available_roles)
        if res is None:
            return DispatchResult(
                source="none", target_rid=None,
                reason="no fallback step matched",
            )
        return res

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
    # routing_decision (pre) → reasoning → routing_decision (selected) → tool_call → tool_result → final
    rd_events = [e for e in events if e["type"] == "routing_decision"]
    assert len(rd_events) >= 2
    # First rd: candidates populated, selected None
    assert rd_events[0]["selected"] is None
    assert len(rd_events[0]["candidates"]) >= 1
    # Second rd: selected = workflow
    assert any(e["selected"] == "workflow" for e in rd_events)

    tc = next(e for e in events if e["type"] == "tool_call")
    assert tc["args"]["target_rid"] == "workflow"
    assert orch.calls and orch.calls[0]["target_rid"] == "workflow"


@pytest.mark.asyncio
async def test_llm_down_no_dispatcher_uses_old_fallback() -> None:
    """Without dispatcher injection, LLM-down still uses legacy _fallback_decision."""
    orch = _FakeOrch()
    events = [
        e async for e in run_agent_loop(
            llmgw_client=_DownLlm([]),
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "请帮我用 workflow 跑一下"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
            # dispatch_by_routing_fn NOT passed
        )
    ]
    tc = next(e for e in events if e["type"] == "tool_call")
    assert tc["args"]["target_rid"] == "workflow"
    assert orch.calls and orch.calls[0]["target_rid"] == "workflow"


# ---------------------------------------------------------------------------
# No-tool-call fallback via dispatcher chain
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_no_tool_call_falls_back_via_dispatcher() -> None:
    """LLM returns plain text (no tool call) → dispatcher fallback hits."""
    llm = _FakeLlm([_plain_decision("我不确定派谁"), _plain_decision("done")])
    orch = _FakeOrch()
    kw_handler = make_keyword_substring_handler()

    async def _dispatch_by_routing(user_message, available_roles, **_):
        res = kw_handler(user_message, available_roles)
        if res is None:
            return DispatchResult(source="none", target_rid=None, reason="no match")
        return res

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
    # tool_call should be emitted even though LLM didn't return dispatch_employee
    tc = next(e for e in events if e["type"] == "tool_call")
    assert tc["args"]["target_rid"] == "workflow"
    assert orch.calls and orch.calls[0]["target_rid"] == "workflow"


@pytest.mark.asyncio
async def test_no_tool_call_no_dispatcher_returns_final() -> None:
    """LLM returns plain text + no dispatcher → final answer, no dispatch."""
    llm = _FakeLlm([_plain_decision("好的，我帮你查询"), _plain_decision("done")])
    orch = _FakeOrch()
    events = [
        e async for e in run_agent_loop(
            llmgw_client=llm,
            orchestrator_client=orch,
            messages=[{"role": "user", "content": "帮我查一下天气"}],
            model="doubao-pro-32k",
            roles=ROLES,
            tenant_id="tenant-acme",
        )
    ]
    # No tool_call should be emitted
    assert not any(e["type"] == "tool_call" for e in events)
    final = next(e for e in events if e["type"] == "final")
    assert "好的" in final["content"]
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
    # types: routing_decision, reasoning, tool_call, tool_result, final
    types = [e["type"] for e in events]
    assert types[0] == "routing_decision"
    assert "routing_decision" in types
    assert "tool_call" in types
    assert "tool_result" in types
    assert types[-1] == "final"
    assert orch.calls and orch.calls[0]["target_rid"] == "workflow"


# ---------------------------------------------------------------------------
# DEFAULT_CHAIN smoke
# ---------------------------------------------------------------------------
def test_default_chain_includes_all_four_kinds() -> None:
    kinds = {s.kind for s in DEFAULT_CHAIN}
    assert kinds == {"a2a", "kernel_role", "embedding_match", "keyword_substring"}


def test_fallback_step_constructor() -> None:
    s = FallbackStep("a2a", target="agent-x")
    assert s.kind == "a2a"
    assert s.target == "agent-x"
    s2 = FallbackStep("keyword_substring")
    assert s2.target is None