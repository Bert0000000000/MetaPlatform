"""Pydantic schemas for Task Delegation (outbound)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class StatusHistoryEntry(BaseModel):
    status: TaskStatus
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    detail: str = ""


class TaskArtifact(BaseModel):
    name: str
    type: str = "text"
    content: str = ""


class DelegatedTask(BaseModel):
    """A task delegated to an external agent."""

    id: str
    tenant_id: str
    source_agent_id: str
    target_agent_id: str
    task_type: str = "generic"
    payload: Dict[str, Any] = Field(default_factory=dict)
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    trace_id: Optional[str] = None
    # Advanced fields (P3-A2A-15)
    timeout: Optional[float] = None
    callback_url: Optional[str] = None
    status_history: List[StatusHistoryEntry] = Field(default_factory=list)
    artifacts: List[TaskArtifact] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


class DelegateTaskRequest(BaseModel):
    sourceAgentId: str = Field(min_length=1, max_length=128)
    targetAgentId: str = Field(min_length=1, max_length=128)
    taskType: str = "generic"
    payload: Dict[str, Any] = Field(default_factory=dict)
    timeout: Optional[float] = None
    callbackUrl: Optional[str] = None


class UpdateTimeoutRequest(BaseModel):
    timeout: float = Field(ge=0)


class UpdateCallbackUrlRequest(BaseModel):
    callbackUrl: str = Field(min_length=1)


class AdditionalInputRequest(BaseModel):
    input: Dict[str, Any] = Field(default_factory=dict)


def task_to_dict(task: DelegatedTask) -> dict:
    status_value = task.status.value if isinstance(task.status, TaskStatus) else task.status
    return {
        "taskId": task.id,
        "tenantId": task.tenant_id,
        "sourceAgentId": task.source_agent_id,
        "targetAgentId": task.target_agent_id,
        "taskType": task.task_type,
        "payload": task.payload,
        "status": status_value,
        "result": task.result,
        "error": task.error,
        "traceId": task.trace_id,
        "timeout": task.timeout,
        "callbackUrl": task.callback_url,
        "statusHistory": [
            {
                "status": e.status.value if isinstance(e.status, TaskStatus) else e.status,
                "timestamp": e.timestamp,
                "detail": e.detail,
            }
            for e in task.status_history
        ],
        "artifacts": [
            {"name": a.name, "type": a.type, "content": a.content}
            for a in task.artifacts
        ],
        "createdAt": task.created_at,
        "updatedAt": task.updated_at,
        "completedAt": task.completed_at,
    }
