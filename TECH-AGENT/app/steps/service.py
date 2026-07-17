"""Step service: record steps, thinking chain, tool calls, evaluations."""

from __future__ import annotations

from typing import List, Optional

from app.steps.repository import StepRepository
from app.steps.schemas import (
    EvaluationRecord,
    ExecutionStepRecord,
    StepType,
    SubmitEvaluationRequest,
    ThinkingChain,
    ToolCallRecord,
)


class StepService:
    def __init__(self, repository: StepRepository) -> None:
        self._repo = repository

    async def record_step(
        self,
        tenant_id: str,
        execution_id: str,
        step_type: StepType,
        content: str,
        *,
        order: int = 0,
        metadata: Optional[dict] = None,
    ) -> ExecutionStepRecord:
        step = ExecutionStepRecord(
            id="",
            execution_id=execution_id,
            tenant_id=tenant_id,
            step_type=step_type,
            content=content,
            order=order,
            metadata=metadata,
        )
        return await self._repo.add_step(step)

    async def get_steps(
        self,
        tenant_id: str,
        execution_id: str,
    ) -> List[ExecutionStepRecord]:
        return await self._repo.get_steps(execution_id, tenant_id)

    async def get_thinking_chain(
        self,
        tenant_id: str,
        execution_id: str,
    ) -> ThinkingChain:
        steps = await self._repo.get_steps(execution_id, tenant_id)
        thinking_steps = [s for s in steps if s.step_type == StepType.THINKING]
        return ThinkingChain(
            execution_id=execution_id,
            steps=thinking_steps,
            total_steps=len(thinking_steps),
        )

    async def get_tool_calls(
        self,
        tenant_id: str,
        execution_id: str,
    ) -> List[ToolCallRecord]:
        return await self._repo.get_tool_calls(execution_id, tenant_id)

    async def submit_evaluation(
        self,
        tenant_id: str,
        execution_id: str,
        request: SubmitEvaluationRequest,
    ) -> EvaluationRecord:
        evaluation = EvaluationRecord(
            id="",
            execution_id=execution_id,
            tenant_id=tenant_id,
            score=request.score,
            feedback=request.feedback,
            evaluator=request.evaluator,
        )
        return await self._repo.add_evaluation(evaluation)

    async def get_evaluations(
        self,
        tenant_id: str,
        execution_id: str,
    ) -> List[EvaluationRecord]:
        return await self._repo.get_evaluations(execution_id, tenant_id)
