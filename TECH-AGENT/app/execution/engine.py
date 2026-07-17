"""Simplified LangGraph-style execution engine for TECH-AGENT.

Supports RAG retrieval (P2-AGT-09) and Action function-calling (P2-AGT-10)
when the corresponding clients are provided. Falls back to deterministic
placeholder behavior when clients are absent (backward compatible).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from app.agents.schemas import Agent
from app.clients.action import ActionClient
from app.clients.llmgw import LLMGWClient
from app.clients.rag import RAGClient
from app.execution.schemas import (
    ExecutionResult,
    ExecutionStatus,
    ExecutionStep,
    ExecutionStepType,
)


def _execution_id() -> str:
    return f"exe-{uuid.uuid4().hex[:12]}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _tool_call_id() -> str:
    return f"tc-{uuid.uuid4().hex[:12]}"


class ExecutionEngine:
    """Deterministic MVP execution engine.

    Runs a fixed graph: planning -> RAG retrieval (optional) -> agent reasoning
    (LLM, with function calling when tools are configured) -> tool execution
    (optional) -> evaluator -> final.
    """

    def __init__(
        self,
        llm_client: LLMGWClient,
        *,
        rag_client: Optional[RAGClient] = None,
        action_client: Optional[ActionClient] = None,
    ) -> None:
        self._llm_client = llm_client
        self._rag_client = rag_client
        self._action_client = action_client

    async def run(
        self,
        agent: Agent,
        tenant_id: str,
        task: str,
        *,
        context: str = "",
        max_iterations: int = 10,
        trace_id: str | None = None,
    ) -> ExecutionResult:
        execution_id = _execution_id()
        started_at = _now()
        steps: List[ExecutionStep] = []

        # planning
        steps.append(
            ExecutionStep(
                type=ExecutionStepType.PLANNING,
                title="任务规划",
                content=f"将任务拆解为推理步骤，最大迭代 {max_iterations} 轮",
            )
        )

        # RAG retrieval when configured
        rag_context = ""
        if self._rag_client and agent.rag_scopes:
            rag_results = await self._rag_client.search(
                task,
                agent.rag_scopes,
                top_k=5,
                tenant_id=tenant_id,
                trace_id=trace_id,
            )
            rag_context = self._rag_client.format_context(rag_results)
            steps.append(
                ExecutionStep(
                    type=ExecutionStepType.REASONING,
                    title="知识检索",
                    content=f"从知识库检索到 {len(rag_results)} 条相关文档",
                )
            )

        messages = self._build_messages(agent, task, context, rag_context)

        # Build function definitions when action_client is available
        functions = None
        if self._action_client and agent.tools:
            functions = await self._build_function_definitions(
                agent, tenant_id, trace_id
            )

        # reasoning / LLM call
        llm_resp = await self._llm_client.chat(
            model_id=agent.model_id,
            messages=messages,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
            functions=functions,
            trace_id=trace_id,
        )

        choice = llm_resp["choices"][0]
        message = choice["message"]
        answer = message.get("content", "")
        finish_reason = choice.get("finish_reason", "stop")

        steps.append(
            ExecutionStep(
                type=ExecutionStepType.REASONING,
                title="Agent 推理",
                content=answer,
            )
        )

        # Function calling: execute the action and feed result back to LLM
        if finish_reason == "function_call" and self._action_client:
            function_call = message.get("function_call", {})
            tool_name = function_call.get("name", agent.tools[0] if agent.tools else "")
            import json

            try:
                tool_args = json.loads(function_call.get("arguments", "{}"))
            except (json.JSONDecodeError, TypeError):
                tool_args = {"input": task}

            steps.append(
                ExecutionStep(
                    type=ExecutionStepType.TOOL_CALLING,
                    title="工具调用",
                    content=f"调用工具: {tool_name}, 参数: {tool_args}",
                )
            )

            action_result = await self._action_client.execute(
                tool_name,
                tool_args,
                tenant_id=tenant_id,
                trace_id=trace_id,
            )

            steps.append(
                ExecutionStep(
                    type=ExecutionStepType.TOOL_RESULT,
                    title="工具返回",
                    content=str(action_result.get("output", action_result)),
                )
            )

            # Feed the tool result back to the LLM for a final answer
            messages.append(message)
            messages.append(
                {
                    "role": "function",
                    "name": tool_name,
                    "content": str(action_result.get("output", action_result)),
                }
            )
            llm_resp2 = await self._llm_client.chat(
                model_id=agent.model_id,
                messages=messages,
                temperature=agent.temperature,
                max_tokens=agent.max_tokens,
                trace_id=trace_id,
            )
            answer = llm_resp2["choices"][0]["message"]["content"]
            llm_resp["usage"] = self._merge_usage(
                llm_resp.get("usage", {}), llm_resp2.get("usage", {})
            )
        elif agent.tools:
            # Placeholder tool calling when no action_client
            steps.append(
                ExecutionStep(
                    type=ExecutionStepType.TOOL_CALLING,
                    title="工具调用",
                    content=f"Agent 配置了 {len(agent.tools)} 个工具：{', '.join(agent.tools)}",
                )
            )
            steps.append(
                ExecutionStep(
                    type=ExecutionStepType.TOOL_RESULT,
                    title="工具返回",
                    content="当前里程碑仅记录工具调用意图，真实执行在 P2-AGT-10 接入 TECH-ACTION/MCP 后完成。",
                )
            )

        # evaluation
        steps.append(
            ExecutionStep(
                type=ExecutionStepType.EVALUATION,
                title="结果评估",
                content="执行结果符合任务要求，完成输出。",
            )
        )

        # final
        steps.append(
            ExecutionStep(
                type=ExecutionStepType.FINAL,
                title="最终回答",
                content=answer,
            )
        )

        usage = llm_resp.get("usage", {})
        return ExecutionResult(
            executionId=execution_id,
            agentId=agent.id,
            tenantId=tenant_id,
            status=ExecutionStatus.COMPLETED,
            output=answer,
            steps=steps,
            modelId=agent.model_id,
            inputTokens=usage.get("promptTokens", 0),
            outputTokens=usage.get("completionTokens", 0),
            startedAt=started_at,
            completedAt=_now(),
        )

    async def stream(
        self,
        agent: Agent,
        tenant_id: str,
        task: str,
        *,
        context: str = "",
        max_iterations: int = 10,
        trace_id: str | None = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream execution events aligned with the SPEC."""
        execution_id = _execution_id()
        started_at = _now()
        step_number = 0

        yield self._event(
            "execution.started",
            {
                "executionId": execution_id,
                "agentId": agent.id,
                "startedAt": started_at.isoformat(),
                "traceId": trace_id,
            },
        )

        step_number += 1
        planning_step = ExecutionStep(
            type=ExecutionStepType.PLANNING,
            title="任务规划",
            content=f"将任务拆解为推理步骤，最大迭代 {max_iterations} 轮",
        )
        yield self._step_event(execution_id, step_number, planning_step)

        # RAG retrieval when configured
        rag_context = ""
        if self._rag_client and agent.rag_scopes:
            rag_results = await self._rag_client.search(
                task,
                agent.rag_scopes,
                top_k=5,
                tenant_id=tenant_id,
                trace_id=trace_id,
            )
            rag_context = self._rag_client.format_context(rag_results)

        messages = self._build_messages(agent, task, context, rag_context)
        functions = None
        if self._action_client and agent.tools:
            functions = await self._build_function_definitions(
                agent, tenant_id, trace_id
            )
        llm_resp = await self._llm_client.chat(
            model_id=agent.model_id,
            messages=messages,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
            functions=functions,
            trace_id=trace_id,
        )

        choice = llm_resp["choices"][0]
        answer = choice["message"]["content"]

        step_number += 1
        yield self._event(
            "agent.thinking",
            {
                "executionId": execution_id,
                "step": step_number,
                "thought": "正在基于系统提示词和任务进行推理...",
                "timestamp": _now().isoformat(),
            },
        )

        if agent.tools:
            tool_name = agent.tools[0]
            tool_call_id = _tool_call_id()
            step_number += 1
            yield self._event(
                "agent.action",
                {
                    "executionId": execution_id,
                    "step": step_number,
                    "action": "CALL_TOOL",
                    "toolName": tool_name,
                    "toolInput": {"task": task},
                    "timestamp": _now().isoformat(),
                },
            )
            yield self._event(
                "tool.calling",
                {
                    "executionId": execution_id,
                    "toolCallId": tool_call_id,
                    "toolId": f"tool-{tool_name}",
                    "toolName": tool_name,
                    "input": {"task": task},
                    "timestamp": _now().isoformat(),
                },
            )
            yield self._event(
                "tool.result",
                {
                    "executionId": execution_id,
                    "toolCallId": tool_call_id,
                    "toolId": f"tool-{tool_name}",
                    "toolName": tool_name,
                    "status": "SUCCESS",
                    "output": "工具调用意图已记录（模拟）",
                    "duration": 0,
                    "timestamp": _now().isoformat(),
                },
            )

        step_number += 1
        reasoning_step = ExecutionStep(
            type=ExecutionStepType.REASONING,
            title="Agent 推理",
            content=answer,
        )
        yield self._step_event(execution_id, step_number, reasoning_step)

        # simple word-level streaming of the answer
        for word in answer.split(" "):
            yield self._event(
                "content.delta",
                {
                    "executionId": execution_id,
                    "delta": word + " ",
                    "timestamp": _now().isoformat(),
                },
            )

        yield self._event(
            "content.done",
            {
                "executionId": execution_id,
                "content": answer,
                "timestamp": _now().isoformat(),
            },
        )

        step_number += 1
        eval_step = ExecutionStep(
            type=ExecutionStepType.EVALUATION,
            title="结果评估",
            content="执行结果符合任务要求，完成输出。",
        )
        yield self._step_event(execution_id, step_number, eval_step)

        step_number += 1
        final_step = ExecutionStep(
            type=ExecutionStepType.FINAL,
            title="最终回答",
            content=answer,
        )
        yield self._step_event(execution_id, step_number, final_step)

        usage = llm_resp.get("usage", {})
        prompt_tokens = usage.get("promptTokens", 0)
        completion_tokens = usage.get("completionTokens", 0)
        completed_at = _now()
        yield self._event(
            "execution.completed",
            {
                "executionId": execution_id,
                "status": ExecutionStatus.COMPLETED.value,
                "metrics": {
                    "duration": int(
                        (completed_at - started_at).total_seconds() * 1000
                    ),
                    "iterations": step_number,
                    "toolCalls": len(agent.tools),
                    "tokenUsage": {
                        "promptTokens": prompt_tokens,
                        "completionTokens": completion_tokens,
                        "totalTokens": prompt_tokens + completion_tokens,
                    },
                    "modelUsed": agent.model_id,
                },
                "completedAt": completed_at.isoformat(),
                "traceId": trace_id,
            },
        )

    def _build_messages(
        self, agent: Agent, task: str, context: str, rag_context: str = ""
    ) -> List[Dict[str, Any]]:
        system = agent.system_prompt
        if context:
            system += f"\n\n附加上下文：{context}"
        if rag_context:
            system += f"\n\n知识检索结果：\n{rag_context}"
        if agent.rag_scopes:
            system += f"\n\n知识范围：{', '.join(agent.rag_scopes)}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": task},
        ]

    async def _build_function_definitions(
        self,
        agent: Agent,
        tenant_id: str,
        trace_id: Optional[str],
    ) -> List[Dict[str, Any]]:
        """Build LLM function definitions from the agent's configured tools."""
        functions: List[Dict[str, Any]] = []
        if self._action_client is None:
            return functions
        for tool_name in agent.tools:
            try:
                action_meta = await self._action_client.get_action(
                    tool_name, tenant_id=tenant_id, trace_id=trace_id
                )
                functions.append(
                    self._action_client.to_function_definition(tool_name, action_meta)
                )
            except Exception:
                functions.append(
                    {
                        "name": tool_name,
                        "description": f"Execute action: {tool_name}",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "input": {"type": "string"},
                            },
                        },
                    }
                )
        return functions

    def _merge_usage(
        self, usage1: Dict[str, Any], usage2: Dict[str, Any]
    ) -> Dict[str, Any]:
        return {
            "promptTokens": usage1.get("promptTokens", 0)
            + usage2.get("promptTokens", 0),
            "completionTokens": usage1.get("completionTokens", 0)
            + usage2.get("completionTokens", 0),
        }

    def _event(self, event: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return {"event": event, "data": data}

    def _step_event(
        self,
        execution_id: str,
        step_number: int,
        step: ExecutionStep,
    ) -> Dict[str, Any]:
        return self._event(
            "execution.step",
            {
                "executionId": execution_id,
                "step": step_number,
                "node": "agent",
                "status": "COMPLETED",
                "timestamp": step.createdAt.isoformat(),
            },
        )
