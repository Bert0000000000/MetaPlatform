"""Request/response schemas for the ETL domain."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class EtlTaskType(str, Enum):
    EXTRACT = "EXTRACT"
    TRANSFORM = "TRANSFORM"
    LOAD = "LOAD"


class EtlTaskStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class EtlRunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class CreateEtlTaskRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    type: EtlTaskType
    config: dict[str, Any] = Field(default_factory=dict)
    schedule: Optional[str] = None
    enabled: bool = True


class UpdateEtlTaskRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    config: Optional[dict[str, Any]] = None
    schedule: Optional[str] = None
    enabled: Optional[bool] = None


class EtlTask(BaseModel):
    id: str
    tenantId: str
    name: str
    type: EtlTaskType
    config: dict[str, Any]
    schedule: Optional[str] = None
    enabled: bool
    lastRunAt: Optional[datetime] = None
    lastStatus: Optional[EtlRunStatus] = None
    createdAt: datetime
    updatedAt: datetime


class EtlRunInfo(BaseModel):
    runId: str
    taskId: str
    status: EtlRunStatus
    startedAt: datetime
    finishedAt: Optional[datetime] = None
    recordsProcessed: int = 0
    message: Optional[str] = None