"""Lakehouse ORM-style Pydantic models."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class LakeTableFormat(str, Enum):
    HUDI = "hudi"
    ICEBERG = "iceberg"


class IngestMode(str, Enum):
    CDC = "cdc"
    APPEND = "append"
    UPSERT = "upsert"


class IngestStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class LakeTableORM(BaseModel):
    id: str
    tenant_id: str
    name: str
    format: LakeTableFormat
    location: str
    partition_config: dict[str, Any] = Field(default_factory=dict)
    schema: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = None


class LakeIngestTaskORM(BaseModel):
    id: str
    tenant_id: str
    table_id: str
    source_datasource_id: Optional[str] = None
    mode: IngestMode = IngestMode.APPEND
    status: IngestStatus = IngestStatus.PENDING
    last_run_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))