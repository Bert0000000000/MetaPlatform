"""Pydantic schemas for Agent task management (P2-AGT-14/15)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class AgentTask(BaseModel):
    """A task assigned to an agent."""

    id: str
    tenant_id: str
    agent_id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_to: Optional[str] = None
    input: Optional[Dict[str, Any]] = None
    output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class CreateTaskRequest(BaseModel):
    agentId: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=512)
    description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    assignedTo: Optional[str] = None
    input: Optional[Dict[str, Any]] = None


class UpdateTaskStatusRequest(BaseModel):
    status: TaskStatus
    output: Optional[Dict[str, Any]] = None
    errorMessage: Optional[str] = None


class AssignTaskRequest(BaseModel):
    assignedTo: str = Field(min_length=1)


class TaskStatistics(BaseModel):
    total: int = 0
    completed: int = 0
    failed: int = 0
    running: int = 0
    pending: int = 0
    avg_duration_ms: float = 0.0


def task_to_dict(task: AgentTask) -> dict:
    return {
        "taskId": task.id,
        "tenantId": task.tenant_id,
        "agentId": task.agent_id,
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "priority": task.priority.value,
        "assignedTo": task.assigned_to,
        "input": task.input,
        "output": task.output,
        "errorMessage": task.error_message,
        "createdAt": task.created_at,
        "startedAt": task.started_at,
        "completedAt": task.completed_at,
    }


def stats_to_dict(stats: TaskStatistics) -> dict:
    return {
        "total": stats.total,
        "completed": stats.completed,
        "failed": stats.failed,
        "running": stats.running,
        "pending": stats.pending,
        "avgDurationMs": stats.avg_duration_ms,
    }
