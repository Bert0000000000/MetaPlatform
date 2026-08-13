"""mate_app_copilot.agent_loop — FC-driven SuperAI agent loop.

Runs the "LLM decides which digital employee to schedule" loop:

  decision turn (llmgw function calling)
      → if dispatch_employee tool call:
            yield tool_call event
            orchestrator.dispatch(...) → yield tool_result event
            feed assistant(tool_calls) + tool result back to history
            loop
      → else: yield final answer → stop

The loop is a generator yielding event dicts; the SSE handler serializes
them. Dispatch is fire-and-forget (the orchestrator returns "delegated /
submitted" with the A2A task id), so the loop feeds back the delegation
acknowledgement — a truthful record of the scheduling step, not a fake
agent answer.
"""
from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from .clients.llmgw_stream import LlmgwStreamError
from .clients.orchestrator_client import OrchestratorClientError

MAX_TOOL_ITERATIONS = 5

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


def build_system_prompt(roles: list[dict[str, Any]]) -> str:
    """从 orchestrator 注册的数字员工角色动态生成 system prompt。"""
    lines = [
        "你是 SuperAI 编排助手。用户要求执行业务任务时，用 dispatch_employee 工具调度数字员工完成。",
        "可调度的数字员工：",
    ]
    for r in roles:
        caps = ", ".join(c.get("name", "") for c in r.get("capabilities", []))
        lines.append(f"- {r.get('role')}（{r.get('name') or r.get('role')}）：{caps}")
    lines.append(
        "调度完成后，拿到结果给用户简洁的中文汇总（用了哪个员工、结果如何）。"
        "不要凭空编造调度结果。"
    )
    return "\n".join(lines)


def build_tools(roles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """有可调度角色时暴露 dispatch_employee，否则不暴露工具（纯对话）。"""
    if not roles:
        return []
    schema = json.loads(json.dumps(DISPATCH_TOOL_SCHEMA))
    slug_values = [str(r.get("role")) for r in roles if r.get("role")]
    if slug_values:
        schema["function"]["parameters"]["properties"]["target_rid"]["enum"] = slug_values
    return [schema]


def _fallback_decision(
    messages: list[dict[str, Any]], roles: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Deterministic dispatch decision when the LLM FC turn is unavailable.

    Keyword-matches the last user message against registered role slugs so
    the scheduling pipeline stays demonstrable even without a working LLM
    provider (mirrors the chat handler's stub-fallback pattern). Returns
    None when no role matches.
    """
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
) -> AsyncIterator[dict[str, Any]]:
    """Run the decision→dispatch→feed-back loop, yielding event dicts.

    Events:
      {"type": "reasoning", "text": str}
      {"type": "tool_call", "callId": str, "tool": str, "args": dict}
      {"type": "tool_result", "callId": str, "status": "success"|"error", "result": dict}
      {"type": "final", "content": str}
    """
    system_prompt = build_system_prompt(roles)
    tools = build_tools(roles)

    history: list[dict[str, Any]] = [dict(m) for m in messages]
    if history and history[0].get("role") == "system":
        history[0] = {
            **history[0],
            "content": f"{system_prompt}\n\n{history[0].get('content', '')}",
        }
    else:
        history.insert(0, {"role": "system", "content": system_prompt})

    degraded = False
    for _ in range(max_iterations):
        try:
            decision = await llmgw_client.chat_with_tools(
                messages=history,
                model=model,
                tools=tools,
                provider=llm_provider,
                base_url=llm_base_url,
                api_key=llm_api_key,
            )
        except LlmgwStreamError:
            # LLM FC turn unavailable (no provider in dev) → degrade to a
            # deterministic keyword match so the pipeline stays demonstrable.
            decision = _fallback_decision(history, roles)
            if decision is None:
                yield {
                    "type": "final",
                    "content": "LLM 决策服务不可用，且未匹配到可调度的数字员工。",
                }
                return
            degraded = True
        tool_calls = decision.get("tool_calls") or []
        content = str(decision.get("content") or "")

        if not tool_calls:
            yield {"type": "final", "content": content}
            return

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

            yield {"type": "tool_call", "callId": call_id, "tool": name, "args": args}

            try:
                result = await orchestrator_client.dispatch(
                    tenant_id=tenant_id,
                    target_rid=str(args.get("target_rid", "")),
                    action="",
                    arguments={"message": str(args.get("message", ""))},
                    fallback_token=fallback_token,
                )
                status = "success"
            except OrchestratorClientError as exc:
                result = {"error": str(exc)}
                status = "error"

            yield {"type": "tool_result", "callId": call_id, "status": status, "result": result}

            history.append({
                "role": "assistant",
                "content": content,
                "tool_calls": [{"id": call_id, "type": "function", "function": fn}],
            })
            history.append({
                "role": "tool",
                "tool_call_id": call_id,
                "content": json.dumps(result, ensure_ascii=False),
            })

        if degraded:
            # Fallback dispatch completed — don't re-enter an LLM turn that
            # will fail again; close with a summary note.
            yield {"type": "final", "content": "已通过降级模式完成数字员工调度。"}
            return

    # Hit the iteration cap without a final text — close with a note.
    yield {
        "type": "final",
        "content": "已达到最大调度轮数，我先给出已完成的调度结果汇总，如需继续请补充说明。",
    }
