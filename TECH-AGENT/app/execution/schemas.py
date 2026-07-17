"""Pydantic schemas for Agent execution runtime (P2-AGT-04/05)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ExecutionStepType(str, Enum):
    PLANNING = "PLANNING"
    REASONING = "REASONING"
    TOOL_CALLING = "TOOL_CALLING"
    TOOL_RESULT = "TOOL_RESULT"
    EVALUATION = "EVALUATION"
    FINAL = "FINAL"


class ExecutionStep(BaseModel):
    stepId: str = Field(default_factory=lambda: _step_id())
    type: ExecutionStepType
    title: str
    content: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _step_id() -> str:
    import uuid

    return f"step-{uuid.uuid4().hex[:12]}"


class ExecuteContext(BaseModel):
    """Execution context passed by the caller."""

    conversationId: Optional[str] = None
    taskId: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    userId: Optional[str] = None


class ExecuteOptions(BaseModel):
    """Runtime options that override Agent defaults."""

    timeout: Optional[int] = Field(default=120, ge=1)
    maxIterations: Optional[int] = Field(default=None, ge=1, le=50)
    enableTrace: Optional[bool] = True
    enableMemory: Optional[bool] = True
    streamCallback: Optional[bool] = False


class ExecuteRequest(BaseModel):
    """Request body for Agent sync / stream execution."""

    input: str = Field(min_length=1, max_length=8192)
    inputType: Optional[str] = Field(default="TEXT")
    context: Optional[ExecuteContext] = None
    options: Optional[ExecuteOptions] = None


class ExecutionResult(BaseModel):
    """Internal execution outcome produced by the engine."""

    executionId: str
    agentId: str
    tenantId: str
    status: ExecutionStatus
    output: str
    steps: List[ExecutionStep]
    modelId: str
    inputTokens: int = 0
    outputTokens: int = 0
    startedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completedAt: Optional[datetime] = None


class TokenUsage(BaseModel):
    promptTokens: int = 0
    completionTokens: int = 0
    totalTokens: int = 0


class ExecutionMetrics(BaseModel):
    duration: int = 0
    iterations: int = 0
    toolCalls: int = 0
    tokenUsage: TokenUsage = Field(default_factory=TokenUsage)
    modelUsed: str = ""


class OutputContent(BaseModel):
    content: str = ""
    structuredData: Optional[Dict[str, Any]] = None


class ExecuteResponse(BaseModel):
    """Payload returned by the synchronous execution endpoint."""

    executionId: str
    agentId: str
    agentKey: str
    status: str
    input: str
    output: OutputContent
    metrics: ExecutionMetrics
    conversationId: Optional[str] = None
    taskId: Optional[str] = None
    startedAt: datetime
    completedAt: Optional[datetime] = None


class StreamEvent(BaseModel):
    event: str
    data: Dict[str, Any]
