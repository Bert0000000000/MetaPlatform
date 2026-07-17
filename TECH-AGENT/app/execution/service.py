"""Execution service: validates the agent and delegates to the engine."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import AsyncIterator, Dict

from app.agents.schemas import Agent, AgentStatus
from app.agents.service import AgentService
from app.common.errors import AgentNotActiveError
from app.execution.engine import ExecutionEngine
from app.execution.schemas import (
    ExecuteContext,
    ExecuteOptions,
    ExecuteRequest,
    ExecuteResponse,
    ExecutionMetrics,
    ExecutionResult,
    OutputContent,
    TokenUsage,
)


class ExecutionService:
    def __init__(
        self,
        agent_service: AgentService,
        engine: ExecutionEngine,
    ) -> None:
        self._agent_service = agent_service
        self._engine = engine

    async def execute(
        self,
        tenant_id: str,
        agent_id: str,
        request: ExecuteRequest,
        *,
        trace_id: str | None = None,
    ) -> ExecuteResponse:
        agent = await self._agent_service.get(tenant_id, agent_id)
        if agent.status != AgentStatus.ACTIVE:
            raise AgentNotActiveError(
                "Agent 未激活，无法执行",
                data={"agentId": agent_id, "status": agent.status.value},
            )
        started_at = datetime.now(timezone.utc)
        result = await self._engine.run(
            agent,
            tenant_id,
            request.input,
            context=self._build_context_string(request.context),
            max_iterations=self._max_iterations(request.options),
            trace_id=trace_id,
        )
        return self._to_response(agent, request, result, started_at)

    async def stream(
        self,
        tenant_id: str,
        agent_id: str,
        request: ExecuteRequest,
        *,
        trace_id: str | None = None,
    ) -> AsyncIterator[Dict[str, object]]:
        agent = await self._agent_service.get(tenant_id, agent_id)
        if agent.status != AgentStatus.ACTIVE:
            raise AgentNotActiveError(
                "Agent 未激活，无法执行",
                data={"agentId": agent_id, "status": agent.status.value},
            )
        async for event in self._engine.stream(
            agent,
            tenant_id,
            request.input,
            context=self._build_context_string(request.context),
            max_iterations=self._max_iterations(request.options),
            trace_id=trace_id,
        ):
            yield event

    def _build_context_string(self, context: ExecuteContext | None) -> str:
        if not context:
            return ""
        parts: list[str] = []
        if context.userId:
            parts.append(f"用户ID: {context.userId}")
        if context.conversationId:
            parts.append(f"会话ID: {context.conversationId}")
        if context.taskId:
            parts.append(f"任务ID: {context.taskId}")
        if context.variables:
            parts.append(f"上下文变量: {context.variables}")
        return "\n".join(parts)

    def _max_iterations(self, options: ExecuteOptions | None) -> int:
        if options and options.maxIterations:
            return options.maxIterations
        return 10

    def _to_response(
        self,
        agent: Agent,
        request: ExecuteRequest,
        result: ExecutionResult,
        started_at: datetime,
    ) -> ExecuteResponse:
        duration = 0
        if result.completedAt:
            duration = int((result.completedAt - started_at).total_seconds() * 1000)
        token_usage = TokenUsage(
            promptTokens=result.inputTokens,
            completionTokens=result.outputTokens,
            totalTokens=result.inputTokens + result.outputTokens,
        )
        metrics = ExecutionMetrics(
            duration=duration,
            iterations=len(result.steps),
            toolCalls=sum(
                1 for step in result.steps if step.type.value == "TOOL_CALLING"
            ),
            tokenUsage=token_usage,
            modelUsed=result.modelId,
        )
        return ExecuteResponse(
            executionId=result.executionId,
            agentId=result.agentId,
            agentKey=agent.agent_code,
            status=result.status.value,
            input=request.input,
            output=OutputContent(content=result.output),
            metrics=metrics,
            conversationId=request.context.conversationId if request.context else None,
            taskId=request.context.taskId if request.context else None,
            startedAt=started_at,
            completedAt=result.completedAt,
        )
