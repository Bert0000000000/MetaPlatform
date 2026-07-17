"""Pydantic schemas for the Audit Log domain."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class AuditLogStatus(str, Enum):
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"


class ExportFormat(str, Enum):
    CSV = "csv"
    JSON = "json"


class AuditLogEntry(BaseModel):
    """A single LLM call audit log entry."""

    log_id: str
    tenant_id: str
    user_id: str
    application_id: Optional[str] = None
    model_id: str
    provider_id: str
    status: AuditLogStatus = AuditLogStatus.SUCCESS
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    cost: float = 0.0
    trace_id: Optional[str] = None
    timestamp: datetime


class AuditLogQuery(BaseModel):
    tenantId: Optional[str] = None
    userId: Optional[str] = None
    modelId: Optional[str] = None
    status: Optional[AuditLogStatus] = None
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    keyword: Optional[str] = None
    page: int = 1
    pageSize: int = 20


class LatencyStats(BaseModel):
    count: int
    p50: float
    p95: float
    p99: float
    min: float
    max: float
    avg: float


class LatencyByModel(BaseModel):
    modelId: str
    stats: LatencyStats