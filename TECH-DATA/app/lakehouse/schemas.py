"""Lakehouse schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

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


class CreateLakeTableRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    format: LakeTableFormat
    location: str
    partitionConfig: dict[str, Any] = Field(default_factory=dict)
    schema: dict[str, Any] = Field(default_factory=dict)


class UpdateLakeTableRequest(BaseModel):
    location: Optional[str] = None
    partitionConfig: Optional[dict[str, Any]] = None
    schema: Optional[dict[str, Any]] = None


class LakeTable(BaseModel):
    id: str
    tenantId: str
    name: str
    format: LakeTableFormat
    location: str
    partitionConfig: dict[str, Any]
    schema: dict[str, Any]
    createdAt: datetime
    updatedAt: datetime


class CreateIngestTaskRequest(BaseModel):
    sourceDatasourceId: Optional[str] = None
    mode: IngestMode = IngestMode.APPEND


class IngestTask(BaseModel):
    id: str
    tenantId: str
    tableId: str
    sourceDatasourceId: Optional[str] = None
    mode: IngestMode
    status: IngestStatus
    lastRunAt: Optional[datetime] = None
    createdAt: datetime