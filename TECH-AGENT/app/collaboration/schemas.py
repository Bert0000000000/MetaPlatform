"""Pydantic schemas for digital worker team collaboration (V15-04)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class CollaborationStatus(str, Enum):
    """Top-level status of a collaboration task."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SubTaskStatus(str, Enum):
    """Execution status of an individual subtask."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SplitStrategy(str, Enum):
    """How subtasks are scheduled relative to each other."""

    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    HYBRID = "hybrid"


class SubTask(BaseModel):
    """A single subtask assigned to one employee within a collaboration."""

    id: str
    employee_id: str
    title: str
    description: str = ""
    skill_tags: List[str] = Field(default_factory=list)
    status: SubTaskStatus = SubTaskStatus.PENDING
    progress: int = 0  # 0..100
    depends_on: List[str] = Field(default_factory=list)
    estimated_seconds: int = 60
    actual_seconds: int = 0
    result: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class CollaborationTask(BaseModel):
    """A multi-employee collaboration task composed of subtasks."""

    id: str
    tenant_id: str
    title: str
    description: str = ""
    goal: str
    split_strategy: SplitStrategy = SplitStrategy.PARALLEL
    subtasks: List[SubTask] = Field(default_factory=list)
    status: CollaborationStatus = CollaborationStatus.PENDING
    created_by: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    final_report: Optional[str] = None


class Contribution(BaseModel):
    """Per-employee contribution summary used in the collaboration report."""

    employee_id: str
    subtask_count: int = 0
    completed_count: int = 0
    failed_count: int = 0
    total_seconds: int = 0


class CollaborationReport(BaseModel):
    """Aggregated report produced after a collaboration completes."""

    collaboration_id: str
    title: str
    goal: str
    status: CollaborationStatus
    total_duration_seconds: int = 0
    total_subtasks: int = 0
    completed_subtasks: int = 0
    failed_subtasks: int = 0
    sequential_duration_seconds: int = 0
    parallel_duration_seconds: int = 0
    efficiency_improvement_pct: float = 0.0
    contributions: List[Contribution] = Field(default_factory=list)
    final_report: str = ""


class CreateCollaborationRequest(BaseModel):
    """Request body for ``POST /collaboration/tasks``.

    Field names follow the camelCase convention used by the APP-DW frontend
    (mirrors ``CreateAgentRequest`` and ``CreatePlanRequest``). The service
    layer performs the camelCase → snake_case translation when materializing
    the persisted ``CollaborationTask``.

    ``title`` is optional: when omitted, the service picks a template-derived
    name based on the goal (e.g. ``数据分析``, ``邮件任务``).
    """

    title: Optional[str] = Field(default=None, max_length=256)
    goal: str = Field(min_length=1, max_length=4096)
    description: str = ""
    employeeIds: List[str] = Field(min_length=1)
    splitStrategy: SplitStrategy = SplitStrategy.PARALLEL


def subtask_to_dict(st: SubTask) -> dict[str, Any]:
    return {
        "id": st.id,
        "employeeId": st.employee_id,
        "title": st.title,
        "description": st.description,
        "skillTags": list(st.skill_tags),
        "status": st.status.value,
        "progress": st.progress,
        "dependsOn": list(st.depends_on),
        "estimatedSeconds": st.estimated_seconds,
        "actualSeconds": st.actual_seconds,
        "result": st.result,
        "errorMessage": st.error_message,
        "startedAt": st.started_at,
        "completedAt": st.completed_at,
    }


def collaboration_to_dict(task: CollaborationTask) -> dict[str, Any]:
    return {
        "collaborationId": task.id,
        "tenantId": task.tenant_id,
        "title": task.title,
        "description": task.description,
        "goal": task.goal,
        "splitStrategy": task.split_strategy.value,
        "subtasks": [subtask_to_dict(s) for s in task.subtasks],
        "status": task.status.value,
        "createdBy": task.created_by,
        "createdAt": task.created_at,
        "updatedAt": task.updated_at,
        "startedAt": task.started_at,
        "completedAt": task.completed_at,
        "finalReport": task.final_report,
    }


def contribution_to_dict(c: Contribution) -> dict[str, Any]:
    return {
        "employeeId": c.employee_id,
        "subtaskCount": c.subtask_count,
        "completedCount": c.completed_count,
        "failedCount": c.failed_count,
        "totalSeconds": c.total_seconds,
    }


def report_to_dict(report: CollaborationReport) -> dict[str, Any]:
    return {
        "collaborationId": report.collaboration_id,
        "title": report.title,
        "goal": report.goal,
        "status": report.status.value,
        "totalDurationSeconds": report.total_duration_seconds,
        "totalSubtasks": report.total_subtasks,
        "completedSubtasks": report.completed_subtasks,
        "failedSubtasks": report.failed_subtasks,
        "sequentialDurationSeconds": report.sequential_duration_seconds,
        "parallelDurationSeconds": report.parallel_duration_seconds,
        "efficiencyImprovementPct": report.efficiency_improvement_pct,
        "contributions": [contribution_to_dict(c) for c in report.contributions],
        "finalReport": report.final_report,
    }
