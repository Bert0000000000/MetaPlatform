"""mate_app_copilot.agent_loop — FC-driven SuperAI agent loop.

Runs the "LLM decides which digital employees to schedule" loop:

  decision turn (streaming llmgw function calling, reasoning streamed live)
      → if dispatch_employee tool calls:
            yield tool_call events (all)
            dispatch in parallel → yield tool_result per call
            feed assistant(tool_calls) + tool results back to history
            loop
      → else: yield final answer → stop

The loop is a generator yielding event dicts; the SSE handler serializes
them. Dispatch is synchronous when the orchestrator's A2A worker executes
inline (returns real outcomes); genuinely-async submissions are polled up
to a timeout. The loop never fabricates a completed result — a timeout /
pending is reported truthfully back to the LLM.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any

from .clients.llmgw_stream import LlmgwStreamError
from .clients.orchestrator_client import OrchestratorClientError
from .dispatcher import DispatchResult, dispatch_by_routing
from .semantic_router import CandidateRole, SemanticRouter

MAX_TOOL_ITERATIONS = 5


def _strip_chain_of_thought(content: str) -> str:
    """Strip reasoning blocks (``<think>...</think>``) from LLM output.

    MiniMax reasoning models emit the whole think span in ``content``
    before the visible answer; leaking it into the chat card looks like
    an error. The visible reasoning is already surfaced as ``reasoning``
    events, so the final answer only needs the clean text.
    """
    return re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()


DISPATCH_TOOL_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "dispatch_employee",
        "description": "调度一个数字员工执行任务。调用后任务会委派给该员工。",
        "parameters": {
            "type": "object",
            "properties": {
                "target_rid": {
                    "type": "string",
                    "description": "数字员工 role slug（见 system prompt 列出的可用员工）",
                },
                "message": {
                    "type": "string",
                    "description": "委托给该员工的具体任务描述",
                },
            },
            "required": ["target_rid", "message"],
        },
    },
}


def build_system_prompt(
    roles: list[dict[str, Any]],
    object_cards: list[dict[str, Any]] | None = None,
    ontology_hint: bool = False,
    *,
    candidate_roles: list[CandidateRole] | None = None,
) -> str:
    """从 orchestrator 注册的数字员工角色动态生成 system prompt。

    MP-SAL-02（OAG）：``object_cards`` 非空时追加「相关对象上下文」段——
    检索命中的对象卡片（带 rid 可追溯）进入 prompt，AI「想」的时候本体在上下文里。
    MP-SAL 接线：``ontology_hint`` 提示本体工具选用语义（查=直连，干=派员工）。
    MP-SR-01（任务2）：``candidate_roles`` 非空时只列 top_k 候选，并在 prompt
    顶部加一段「候选已由 semantic_router 预筛」提示，LLM 在候选范围内选。
    """
    if candidate_roles:
        selected_roles = [
            {
                "role": c.role_slug,
                "name": c.display_name or c.role_slug,
                "capabilities": [{"name": t} for t in c.capability_tags],
            }
            for c in candidate_roles
        ]
    else:
        selected_roles = roles

    lines = [
        "你是 SuperAI 编排助手。用户要求执行业务任务时，用 dispatch_employee 工具调度数字员工完成。",
        "一次可以调用多个 dispatch_employee 把任务并行派给不同员工。",
    ]
    if candidate_roles:
        lines.append(
            "（候选已由 semantic_router 预筛，请从下列候选中选择最合适的数字员工。）"
        )
    lines.append("可调度的数字员工：")
    for r in selected_roles:
        caps = ", ".join(c.get("name", "") for c in r.get("capabilities", []))
        lines.append(f"- {r.get('role')}（{r.get('name') or r.get('role')}）：{caps}")
    if ontology_hint:
        lines.append(
            "本体能力：你可直接使用本体工具（list_classes/inspect_class/query_<类型>/"
            "search_objects 等）。用户问「系统里有什么对象/查数据/多少条」这类问题时"
            "直接调本体工具回答，不必派员工；要新增或修改数据时用 propose_* 工具提议"
            "（你只能提议，确认由用户完成）；只有执行业务流程/跨系统动作才 dispatch_employee。"
        )
    lines.append(
        "调度完成后，拿到每个员工的结果给用户简洁的中文汇总（用了哪些员工、各自结果如何）。"
        "不要凭空编造调度结果；调度结果以工具返回为准。"
    )
    if object_cards:
        lines.append("")
        lines.append("相关对象上下文（来自本体检索，rid 可追溯，回答时优先引用）：")
        for card in object_cards:
            lines.append(
                f"- [{card.get('individual_rid', '?')}] {card.get('card_text', '')}"
            )
    return "\n".join(lines)


def build_tools(
    roles: list[dict[str, Any]],
    ontology_tools: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """dispatch_employee（有可调度角色时）+ ontology 工具（MP-SAL-01，虚拟注册表）。"""
    tools: list[dict[str, Any]] = []
    if roles:
        schema = json.loads(json.dumps(DISPATCH_TOOL_SCHEMA))
        slug_values = [str(r.get("role")) for r in roles if r.get("role")]
        if slug_values:
            schema["function"]["parameters"]["properties"]["target_rid"]["enum"] = slug_values
        tools.append(schema)
    if ontology_tools:
        tools.extend(json.loads(json.dumps(t)) for t in ontology_tools)
    return tools


def _fallback_decision(
    messages: list[dict[str, Any]], roles: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Deterministic dispatch decision when the LLM FC turn is unavailable."""
    text = " ".join(
        str(m.get("content") or "") for m in messages if m.get("role") == "user"
    ).lower()
    for role in roles:
        slug = str(role.get("role") or "")
        if slug and slug in text:
            return {
                "content": f"（LLM 决策不可用，按关键词匹配到数字员工 {slug}）",
                "tool_calls": [{
                    "id": "call-fallback",
                    "type": "function",
                    "function": {
                        "name": "dispatch_employee",
                        "arguments": json.dumps({
                            "target_rid": slug,
                            "message": text[:120],
                        }, ensure_ascii=False),
                    },
                }],
            }
    return None


def _task_state_of(status: dict[str, Any]) -> str:
    """Extract the W3C task state from an A2A task dict (status.state or bare)."""
    st = status.get("status")
    if isinstance(st, dict):
        return str(st.get("state") or "")
    return str(st or "")


def _task_result_of(status: dict[str, Any]) -> dict[str, Any]:
    """Extract the result payload from A2A task artifacts (data part)."""
    for artifact in status.get("artifacts") or []:
        for part in artifact.get("parts") or []:
            if part.get("kind") == "data" and isinstance(part.get("data"), dict):
                res = part["data"].get("result")
                if isinstance(res, dict):
                    return res
    return {}


async def _await_task_result(
    orchestrator_client: Any,
    result: dict[str, Any],
    *,
    tenant_id: str,
    fallback_token: str,
    timeout: float,
    interval: float,
) -> dict[str, Any]:
    """Poll a submitted/pending A2A task until terminal or timeout."""
    if not (result.get("status") in ("submitted", "pending") and result.get("task_id")):
        return result
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        await asyncio.sleep(interval)
        try:
            status = await orchestrator_client.get_task_status(
                task_id=result["task_id"],
                tenant_id=tenant_id,
                fallback_token=fallback_token,
            )
        except OrchestratorClientError:
            break
        state = _task_state_of(status)
        if state in ("completed", "failed", "canceled"):
            return {
                **result,
                "status": "completed" if state == "completed" else "failed",
                "polled_state": state,
                "polled_result": _task_result_of(status),
            }
    return {
        **result,
        "polled_state": "timeout",
        "note": f"task did not reach a terminal state within {int(timeout)}s",
    }


async def _decision_turn(
    llmgw_client: Any,
    *,
    history: list[dict[str, Any]],
    model: str,
    tools: list[dict[str, Any]],
    llm_provider: str,
    llm_base_url: str | None,
    llm_api_key: str | None,
    temperature: float,
    max_tokens: int | None,
) -> AsyncIterator[dict[str, Any]]:
    """Run one LLM decision turn, yielding ``reasoning`` + ``_decision`` events."""
    if hasattr(llmgw_client, "stream_chat_real_tools"):
        got_done = False
        reasoning_last = 0
        try:
            async for ev in llmgw_client.stream_chat_real_tools(
                messages=history,
                model=model,
                tools=tools,
                temperature=temperature,
                max_tokens=max_tokens,
                provider=llm_provider,
                base_url=llm_base_url,
                api_key=llm_api_key,
            ):
                etype = ev.get("type")
                if etype == "token":
                    reasoning = str(ev.get("reasoning_content") or "")
                    if reasoning_last < len(reasoning):
                        yield {"type": "reasoning", "text": reasoning[reasoning_last:]}
                        reasoning_last = len(reasoning)
                elif etype == "done":
                    got_done = True
                    yield {
                        "type": "_decision",
                        "content": str(ev.get("content") or ""),
                        "tool_calls": ev.get("tool_calls") or [],
                        "reasoning": str(ev.get("reasoning_content") or ""),
                    }
        except LlmgwStreamError:
            got_done = False
        if got_done:
            return

    try:
        decision = await llmgw_client.chat_with_tools(
            messages=history,
            model=model,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
            provider=llm_provider,
            base_url=llm_base_url,
            api_key=llm_api_key,
        )
    except LlmgwStreamError:
        yield {"type": "_llm_down"}
        return
    reasoning = str(decision.get("reasoning_content") or "")
    if reasoning:
        yield {"type": "reasoning", "text": reasoning}
    yield {
        "type": "_decision",
        "content": str(decision.get("content") or ""),
        "tool_calls": decision.get("tool_calls") or [],
        "reasoning": reasoning,
    }


async def run_agent_loop(
    *,
    llmgw_client: Any,
    orchestrator_client: Any,
    messages: list[dict[str, Any]],
    model: str,
    roles: list[dict[str, Any]],
    tenant_id: str,
    fallback_token: str = "",
    max_iterations: int = MAX_TOOL_ITERATIONS,
    llm_provider: str = "openai",
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
    dispatch_timeout: float = 30.0,
    poll_timeout: float = 20.0,
    poll_interval: float = 2.0,
    ontology_tools: list[dict[str, Any]] | None = None,
    ontology_tool_exec: Any = None,
    object_cards: list[dict[str, Any]] | None = None,
    semantic_router: SemanticRouter | None = None,
    candidate_top_k: int = 3,
    dispatch_by_routing_fn: Any | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Run the decision→dispatch→feed-back loop, yielding event dicts.

    Events:
      {"type": "reasoning", "text": str}
      {"type": "tool_call", "callId": str, "tool": str, "args": dict}
      {"type": "tool_result", "callId": str, "status": "success"|"error", "result": dict}
      {"type": "routing_decision", "candidates": [...], "selected": str|None, "reason": str}
      {"type": "final", "content": str}

    MP-SAL 接线：``ontology_tools``（schema 列表）+ ``ontology_tool_exec``
    （name,args→dict，同步，内部 to_thread）让 SuperAI 直查本体；
    ``object_cards``（OAG 检索卡片）注入 system prompt——「想」的时候本体在上下文。

    MP-SR-01（任务2）：
      - ``semantic_router`` 给定时，第一轮 decision_turn 前用其预筛 top_k
        候选；候选注入 system prompt（LLM 决策面收窄）。
      - ``dispatch_by_routing_fn`` 给定时，LLM 决策不可用 / 不返回
        ``dispatch_employee`` 时走 4 级 fallback 链（a2a → kernel_role →
        embedding_match → keyword_substring），命中即派发。每轮都打
        ``routing_decision`` SSE event 供前端 trace。
    """
    # Pre-screen: 算 candidate_roles（仅取最后一条 user message 算语义）
    last_user_msg = next(
        (str(m.get("content") or "") for m in reversed(messages)
         if m.get("role") == "user"),
        "",
    )
    router = semantic_router or SemanticRouter()
    candidate_roles: list[CandidateRole] = []
    if last_user_msg and roles:
        candidate_roles = router.route(last_user_msg, roles, top_k=candidate_top_k)

    # Emit routing_decision（在 reasoning 前，让前端先看到候选）
    yield {
        "type": "routing_decision",
        "candidates": [c.to_dict() for c in candidate_roles],
        "selected": None,
        "reason": (
            "semantic_router pre-screened roles by embedding + keyword hit"
            if candidate_roles else "no candidates (empty roles or query)"
        ),
    }

    system_prompt = build_system_prompt(
        roles,
        object_cards=object_cards,
        ontology_hint=bool(ontology_tools),
        candidate_roles=candidate_roles or None,
    )
    tools = build_tools(roles, ontology_tools=ontology_tools)
    slug_enum = {str(r.get("role")) for r in roles if r.get("role")}
    onto_names = {
        t["function"]["name"] for t in (ontology_tools or ())
        if isinstance(t, dict) and "function" in t
    }

    history: list[dict[str, Any]] = [dict(m) for m in messages]
    if history and history[0].get("role") == "system":
        history[0] = {
            **history[0],
            "content": f"{system_prompt}\n\n{history[0].get('content', '')}",
        }
    else:
        history.insert(0, {"role": "system", "content": system_prompt})

    degraded = False
    dispatched: list[dict[str, Any]] = []
    for _ in range(max_iterations):
        yield {"type": "reasoning", "text": "正在分析任务并选择数字员工…"}

        decision: dict[str, Any] | None = None
        llm_down = False
        async for ev in _decision_turn(
            llmgw_client,
            history=history,
            model=model,
            tools=tools,
            llm_provider=llm_provider,
            llm_base_url=llm_base_url,
            llm_api_key=llm_api_key,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            etype = ev.get("type")
            if etype == "reasoning":
                yield ev
            elif etype == "_decision":
                decision = ev
            elif etype == "_llm_down":
                llm_down = True

        if llm_down:
            # MP-SR-01: 优先走 dispatcher fallback 链；未注入时回退到 _fallback_decision
            if dispatch_by_routing_fn is not None and roles:
                fallback_result = await _dispatch_fallback(
                    user_message=last_user_msg,
                    roles=roles,
                    dispatch_by_routing_fn=dispatch_by_routing_fn,
                )
                if fallback_result is not None:
                    decision = _synthesize_dispatch_decision(fallback_result, last_user_msg)
                    degraded = True
                    yield _routing_decision_event(fallback_result)
                else:
                    yield {
                        "type": "final",
                        "content": "LLM 决策服务不可用，且未匹配到可调度的数字员工。",
                    }
                    return
            else:
                decision = _fallback_decision(history, roles)
                if decision is None:
                    yield {
                        "type": "final",
                        "content": "LLM 决策服务不可用，且未匹配到可调度的数字员工。",
                    }
                    return
                degraded = True
        if decision is None:
            yield {"type": "final", "content": "LLM 决策服务不可用。"}
            return

        tool_calls = decision.get("tool_calls") or []
        content = str(decision.get("content") or "")

        if not tool_calls:
            # MP-SR-01: LLM 没返回 dispatch_employee → 试 dispatcher fallback
            if dispatch_by_routing_fn is not None and roles:
                fallback_result = await _dispatch_fallback(
                    user_message=last_user_msg,
                    roles=roles,
                    dispatch_by_routing_fn=dispatch_by_routing_fn,
                )
                if fallback_result is not None:
                    decision = _synthesize_dispatch_decision(fallback_result, last_user_msg)
                    degraded = True
                    yield _routing_decision_event(fallback_result)
                    tool_calls = decision.get("tool_calls") or []
                    content = str(decision.get("content") or "")
                    # fall through to dispatch below
                else:
                    yield {"type": "final", "content": _strip_chain_of_thought(content)}
                    return
            else:
                yield {"type": "final", "content": _strip_chain_of_thought(content)}
                return

        # MP-SAL：本体类工具调用（list/inspect/query/search/propose）——同步执行，
        # 结果回填历史，下一轮 LLM 拿着真实本体数据作答/继续决策。
        onto_calls: list[dict[str, Any]] = []
        for tc in tool_calls:
            fn = tc.get("function", {}) if isinstance(tc, dict) else {}
            name = fn.get("name", "") if isinstance(fn, dict) else ""
            if name in onto_names and ontology_tool_exec is not None:
                tc_id = tc.get("id") if isinstance(tc, dict) else None
                call_id = str(tc_id) if tc_id else f"call-{uuid.uuid4().hex[:10]}"
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                    if not isinstance(args, dict):
                        args = {}
                except (ValueError, TypeError):
                    args = {}
                onto_calls.append({"call_id": call_id, "name": name, "args": args})

        if onto_calls:
            assistant_tc = [
                {"id": c["call_id"], "type": "function",
                 "function": {"name": c["name"], "arguments": json.dumps(c["args"], ensure_ascii=False)}}
                for c in onto_calls
            ]
            history.append({
                "role": "assistant", "content": content or "", "tool_calls": assistant_tc,
            })
            for c in onto_calls:
                yield {"type": "tool_call", "callId": c["call_id"], "tool": c["name"], "args": c["args"]}
                status, result = "success", {}
                try:
                    result = await asyncio.to_thread(ontology_tool_exec, c["name"], c["args"])
                except Exception as e:
                    status, result = "error", {"error": f"{type(e).__name__}: {e}"}
                yield {"type": "tool_result", "callId": c["call_id"], "status": status, "result": result}
                history.append({
                    "role": "tool", "tool_call_id": c["call_id"],
                    "name": c["name"],
                    "content": json.dumps(result, ensure_ascii=False, default=str)[:8000],
                })
            continue  # 下一轮：LLM 基于本体数据继续（回答或再调度）

        # Collect + validate every dispatch_employee call in this decision.
        calls: list[dict[str, Any]] = []
        for tc in tool_calls:
            fn = tc.get("function", {}) if isinstance(tc, dict) else {}
            name = fn.get("name", "") if isinstance(fn, dict) else ""
            if name != "dispatch_employee":
                continue
            tc_id = tc.get("id") if isinstance(tc, dict) else None
            call_id = str(tc_id) if tc_id else f"call-{uuid.uuid4().hex[:10]}"
            try:
                args = json.loads(fn.get("arguments") or "{}")
                if not isinstance(args, dict):
                    args = {}
            except (ValueError, TypeError):
                args = {}
            target = str(args.get("target_rid", "") or "")
            message = str(args.get("message", "") or "")
            if not target or (slug_enum and target not in slug_enum):
                calls.append({
                    "call_id": call_id, "fn": fn, "args": args,
                    "valid": False, "error": f"未知或缺失 target_rid: {target!r}",
                })
            elif not message:
                calls.append({
                    "call_id": call_id, "fn": fn, "args": args,
                    "valid": False, "error": "missing message",
                })
            else:
                calls.append({
                    "call_id": call_id, "fn": fn, "args": args,
                    "valid": True, "error": "",
                })

        if not calls:
            yield {"type": "final", "content": _strip_chain_of_thought(content)}
            return

        # Emit all tool_call events first so the frontend renders all steps.
        for c in calls:
            yield {
                "type": "tool_call",
                "callId": c["call_id"],
                "tool": "dispatch_employee",
                "args": c["args"],
            }

        async def _do_dispatch(c: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
            if not c["valid"]:
                return (c["call_id"], {"error": c["error"]}, "error")
            try:
                result = await asyncio.wait_for(
                    orchestrator_client.dispatch(
                        tenant_id=tenant_id,
                        target_rid=str(c["args"].get("target_rid", "")),
                        action="",
                        arguments={"message": str(c["args"].get("message", ""))},
                        fallback_token=fallback_token,
                    ),
                    timeout=dispatch_timeout,
                )
                result = await _await_task_result(
                    orchestrator_client,
                    result,
                    tenant_id=tenant_id,
                    fallback_token=fallback_token,
                    timeout=poll_timeout,
                    interval=poll_interval,
                )
                return (c["call_id"], result, "success")
            except TimeoutError:
                return (
                    c["call_id"],
                    {"error": f"dispatch timeout after {int(dispatch_timeout)}s"},
                    "error",
                )
            except OrchestratorClientError as exc:
                return (c["call_id"], {"error": str(exc)}, "error")

        outcomes = await asyncio.gather(*(_do_dispatch(c) for c in calls))

        for c, (call_id, result, status) in zip(calls, outcomes, strict=False):
            yield {
                "type": "tool_result",
                "callId": call_id,
                "status": status,
                "result": result,
            }
            if status == "success":
                dispatched.append({
                    "target_rid": c["args"].get("target_rid", ""),
                    "task_id": result.get("task_id", "") if isinstance(result, dict) else "",
                    "status": result.get("status", "completed") if isinstance(result, dict) else "completed",
                    "worker_kind": result.get("worker_kind", "") if isinstance(result, dict) else "",
                })

        # Feed the full decision back: one assistant message with all
        # tool_calls, then one tool message per result (OpenAI protocol).
        history.append({
            "role": "assistant",
            "content": content,
            "tool_calls": [
                {"id": c["call_id"], "type": "function", "function": c["fn"]}
                for c in calls
            ],
        })
        for c, (_, result, _) in zip(calls, outcomes, strict=False):
            history.append({
                "role": "tool",
                "tool_call_id": c["call_id"],
                "content": json.dumps(result, ensure_ascii=False),
            })

        if degraded:
            yield {"type": "final", "content": "已通过降级模式完成数字员工调度。"}
            return

    # Hit the iteration cap without a final text — structured close.
    if dispatched:
        lines = [
            f"- {d['target_rid']}: {d['status']}"
            + (f"（task {d['task_id']}）" if d["task_id"] else "")
            for d in dispatched
        ]
        content = "已达到最大调度轮数，本次已完成的调度：\n" + "\n".join(lines)
    else:
        content = "已达到最大调度轮数，请补充说明以便继续。"
    yield {"type": "final", "content": content}


# ────────────────── MP-SR-01 helpers ──────────────────


async def _dispatch_fallback(
    *,
    user_message: str,
    roles: list[dict[str, Any]],
    dispatch_by_routing_fn: Any,
) -> DispatchResult | None:
    """Wrap ``dispatch_by_routing_fn`` for the agent loop.

    Returns ``None`` when no fallback step matched (chain returned
    ``source="none"``), so caller can decide between final-text /
    graceful-degradation.
    """
    try:
        result = await dispatch_by_routing_fn(
            user_message=user_message,
            available_roles=roles,
        )
    except Exception:
        return None
    if result is None or getattr(result, "source", None) in (None, "none"):
        return None
    if not getattr(result, "target_rid", None):
        return None
    return result


def _synthesize_dispatch_decision(
    fallback_result: DispatchResult,
    user_message: str,
) -> dict[str, Any]:
    """Build a ``decision`` dict (with synthetic ``dispatch_employee`` tool_call)
    from a fallback ``DispatchResult``.

    Lets the existing dispatch / history-append / tool_result paths handle the
    rest unchanged.
    """
    target = str(fallback_result.target_rid or "")
    return {
        "content": (
            f"（由 {fallback_result.source} 兜底选择 {target}：{fallback_result.reason}）"
        ),
        "tool_calls": [{
            "id": f"call-{uuid.uuid4().hex[:10]}",
            "type": "function",
            "function": {
                "name": "dispatch_employee",
                "arguments": json.dumps({
                    "target_rid": target,
                    "message": user_message[:120],
                }, ensure_ascii=False),
            },
        }],
    }


def _routing_decision_event(fallback_result: DispatchResult) -> dict[str, Any]:
    """Build a ``routing_decision`` SSE event from a fallback result."""
    return {
        "type": "routing_decision",
        "candidates": [c.to_dict() for c in fallback_result.candidates],
        "selected": fallback_result.target_rid,
        "reason": fallback_result.reason,
    }
