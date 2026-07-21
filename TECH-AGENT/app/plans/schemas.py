"""Pydantic schemas for autonomous task planning (V15-02)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PlanStepStatus(str, Enum):
    """Execution status of an individual plan step."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    APPROVED = "approved"


class PlanStatus(str, Enum):
    """Top-level status of a plan."""

    DRAFT = "draft"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PlanStep(BaseModel):
    """A single step in an autonomous task plan."""

    id: str
    title: str
    description: str = ""
    action: str = ""
    status: PlanStepStatus = PlanStepStatus.PENDING
    order: int = 0
    requires_approval: bool = True
    input: Optional[Dict[str, Any]] = None
    output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class Plan(BaseModel):
    """A decomposed task plan with ordered steps."""

    id: str
    tenant_id: str
    title: str
    description: str = ""
    user_input: str
    agent_id: Optional[str] = None
    status: PlanStatus = PlanStatus.DRAFT
    steps: List[PlanStep] = Field(default_factory=list)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class CreatePlanRequest(BaseModel):
    """Request body for ``POST /plans``."""

    userInput: str = Field(min_length=1, max_length=4096)
    agentId: Optional[str] = None
    title: Optional[str] = None


def step_to_dict(step: PlanStep) -> dict:
    return {
        "stepId": step.id,
        "title": step.title,
        "description": step.description,
        "action": step.action,
        "status": step.status.value,
        "order": step.order,
        "requiresApproval": step.requires_approval,
        "input": step.input,
        "output": step.output,
        "errorMessage": step.error_message,
        "startedAt": step.started_at,
        "completedAt": step.completed_at,
    }


def plan_to_dict(plan: Plan) -> dict:
    return {
        "planId": plan.id,
        "tenantId": plan.tenant_id,
        "title": plan.title,
        "description": plan.description,
        "userInput": plan.user_input,
        "agentId": plan.agent_id,
        "status": plan.status.value,
        "steps": [step_to_dict(s) for s in plan.steps],
        "createdAt": plan.created_at,
        "updatedAt": plan.updated_at,
    }
