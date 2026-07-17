"""ORM-style Pydantic models for ETL tasks (in-memory; matches SQLAlchemy patterns).

Production deployments use the SQLAlchemy ORM equivalent declared via
``metadata``. Tests use the in-memory repository, so Pydantic here is sufficient.
"""

from __future__ import annotations

from datetime import datetime, timezone
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


class EtlTaskORM(BaseModel):
    """Persisted ETL task record."""

    id: str
    tenant_id: str
    name: str
    type: EtlTaskType
    config: dict[str, Any] = Field(default_factory=dict)
    schedule: Optional[str] = None
    enabled: bool = True
    last_run_at: Optional[datetime] = None
    last_status: Optional[EtlRunStatus] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EtlRunORM(BaseModel):
    id: str
    tenant_id: str
    task_id: str
    status: EtlRunStatus = EtlRunStatus.PENDING
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    records_processed: int = 0
    message: Optional[str] = None