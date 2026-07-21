"""Deliverable schemas (P3-DASH-08, 09)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DeliverableType(str, Enum):
    REPORT = "report"
    TASK_OUTPUT = "task_output"
    SCHEDULE_SUMMARY = "schedule_summary"
    ANALYSIS = "analysis"


class DeliverableFormat(str, Enum):
    PDF = "pdf"
    JSON = "json"
    MARKDOWN = "markdown"


class DeliverableStatus(str, Enum):
    READY = "ready"
    GENERATING = "generating"
    FAILED = "failed"


class DeliverableInfo(BaseModel):
    id: str
    tenant_id: str = Field(alias="tenantId")
    type: DeliverableType
    title: str
    source: str
    description: Optional[str] = None
    format: DeliverableFormat
    status: DeliverableStatus
    size: int = 0
    created_by: str = Field(alias="createdBy")
    created_at: datetime = Field(alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")
    download_url: Optional[str] = Field(default=None, alias="downloadUrl")

    model_config = {"populate_by_name": True}


class DeliverableListItem(BaseModel):
    id: str
    type: DeliverableType
    title: str
    source: str
    description: Optional[str] = None
    format: DeliverableFormat
    status: DeliverableStatus
    size: int = 0
    createdBy: str
    createdAt: datetime
    downloadUrl: Optional[str] = None


class DeliverableDownloadRequest(BaseModel):
    format: DeliverableFormat


class DeliverableDownloadResponse(BaseModel):
    download_url: str = Field(alias="downloadUrl")
    message: str

    model_config = {"populate_by_name": True}
