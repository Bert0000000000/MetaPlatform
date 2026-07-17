"""Pydantic schemas for Inbound Tasks (A2A Server)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.delegation.schemas import TaskStatus


class InboundTask(BaseModel):
    """A task received from an external agent via JSON-RPC."""

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
    jsonrpc_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


class JsonRpcRequest(BaseModel):
    """JSON-RPC 2.0 request envelope."""

    jsonrpc: str = "2.0"
    id: Optional[str] = None
    method: str
    params: Dict[str, Any] = Field(default_factory=dict)


def inbound_task_to_dict(task: InboundTask) -> dict:
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
        "jsonrpcId": task.jsonrpc_id,
        "createdAt": task.created_at,
        "updatedAt": task.updated_at,
        "completedAt": task.completed_at,
    }
