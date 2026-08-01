"""API Schemas for mate-tech-agent."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    message: Annotated[str, Field(min_length=1, max_length=4096)]
    thread_id: Annotated[str | None, Field(default=None)]
    scenario: Annotated[Literal["S1", "S2", "S3", "S4", "AUTO"], Field(default="S1")]


class ChatResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    thread_id: Annotated[str, Field()]
    scenario: Annotated[str, Field()]
    answer: Annotated[str, Field()]
    retrieved_chunks: Annotated[list[dict], Field(default_factory=list)]
    tool_calls: Annotated[list[dict], Field(default_factory=list)]
    latency_ms: Annotated[int, Field(ge=0)]


class HealthResponse(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)
    status: Annotated[str, Field()]
    service: Annotated[str, Field()]
    version: Annotated[str, Field()]


class HumanReviewRequest(BaseModel):
    """Human-in-the-loop review (S3): provide feedback or approval."""
    model_config = ConfigDict(strict=True)
    thread_id: Annotated[str, Field(min_length=1, description="thread id")]
    approved: Annotated[bool, Field(description="True to resume and complete, False to abort")]
    feedback: Annotated[str, Field(default="", description="optional human feedback")]


class HumanReviewResponse(BaseModel):
    """S3 review result."""
    model_config = ConfigDict(strict=True, frozen=True)
    thread_id: Annotated[str, Field()]
    status: Annotated[str, Field(description="approved | aborted | no_pending")]
    message: Annotated[str, Field()]

class BpmnProcessState(BaseModel):
    """BPMN process state (S4)."""
    model_config = ConfigDict(strict=True, frozen=True)
    process_key: Annotated[str, Field()]
    deployment_id: Annotated[str, Field(default="")]
    process_instance_id: Annotated[str, Field(default="")]
    process_status: Annotated[str, Field(default="unknown")]  # running | completed | failed
    process_result: Annotated[str, Field(default="")]


class PlanStep(BaseModel):
    """A single step in a cross-agent plan (P3-W8)."""

    model_config = ConfigDict(strict=True)
    agent_id: Annotated[str, Field(min_length=1, description="target agent id")]
    action: Annotated[str, Field(min_length=1, description="action to perform")]
    input: Annotated[dict, Field(default_factory=dict, description="step input payload")]


class PlanExecuteRequest(BaseModel):
    """Body schema for POST /plan/execute (P3-W8 cross-agent orchestration)."""

    model_config = ConfigDict(strict=True)
    plan_id: Annotated[str, Field(min_length=1, description="plan identifier")]
    steps: Annotated[list[PlanStep], Field(min_length=1, description="ordered plan steps")]


class PlanExecuteResponse(BaseModel):
    """Result of a cross-agent plan execution (P3-W8)."""

    model_config = ConfigDict(strict=True, frozen=True)
    execution_id: Annotated[str, Field()]
    plan_id: Annotated[str, Field()]
    status: Annotated[str, Field()]
    results: Annotated[list[dict], Field(default_factory=list)]
