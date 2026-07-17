"""Pydantic schemas for execution steps & thinking chain (P2-AGT-20)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class StepType(str, Enum):
    THINKING = "THINKING"
    TOOL_CALL = "TOOL_CALL"
    EVALUATION = "EVALUATION"
    ANSWER = "ANSWER"


class ExecutionStepRecord(BaseModel):
    """A recorded execution step (thinking, tool call, evaluation, answer)."""

    id: str
    execution_id: str
    tenant_id: str
    step_type: StepType
    content: str
    order: int = 0
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ToolCallRecord(BaseModel):
    """A tool call within an execution."""

    id: str
    execution_id: str
    tenant_id: str
    tool_name: str
    tool_input: Optional[Dict[str, Any]] = None
    tool_output: Optional[Dict[str, Any]] = None
    status: str = "SUCCESS"
    duration_ms: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EvaluationRecord(BaseModel):
    """An evaluation submitted for an execution."""

    id: str
    execution_id: str
    tenant_id: str
    score: float = Field(ge=0.0, le=1.0)
    feedback: str = ""
    evaluator: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ThinkingChain(BaseModel):
    """The thinking chain for an execution."""

    execution_id: str
    steps: List[ExecutionStepRecord] = Field(default_factory=list)
    total_steps: int = 0


class SubmitEvaluationRequest(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    feedback: str = ""
    evaluator: Optional[str] = None


def step_to_dict(step: ExecutionStepRecord) -> dict:
    return {
        "stepId": step.id,
        "executionId": step.execution_id,
        "tenantId": step.tenant_id,
        "stepType": step.step_type.value,
        "content": step.content,
        "order": step.order,
        "metadata": step.metadata,
        "createdAt": step.created_at,
    }


def tool_call_to_dict(tc: ToolCallRecord) -> dict:
    return {
        "toolCallId": tc.id,
        "executionId": tc.execution_id,
        "tenantId": tc.tenant_id,
        "toolName": tc.tool_name,
        "toolInput": tc.tool_input,
        "toolOutput": tc.tool_output,
        "status": tc.status,
        "durationMs": tc.duration_ms,
        "createdAt": tc.created_at,
    }


def evaluation_to_dict(ev: EvaluationRecord) -> dict:
    return {
        "evaluationId": ev.id,
        "executionId": ev.execution_id,
        "tenantId": ev.tenant_id,
        "score": ev.score,
        "feedback": ev.feedback,
        "evaluator": ev.evaluator,
        "createdAt": ev.created_at,
    }
