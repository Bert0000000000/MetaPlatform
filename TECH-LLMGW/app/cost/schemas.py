"""Pydantic schemas for the Cost Report domain."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class TimeInterval(str, Enum):
    HOUR = "hour"
    DAY = "day"
    MONTH = "month"


class ExportFormat(str, Enum):
    CSV = "csv"
    JSON = "json"


class UsageRecord(BaseModel):
    """A single LLM usage event that contributes to cost calculation."""

    record_id: str
    tenant_id: str
    user_id: str
    application_id: Optional[str] = None
    model_id: str
    provider_id: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost: float = 0.0
    timestamp: datetime


class CostByCategory(BaseModel):
    """Aggregated cost per dimension (user, app, model, provider)."""

    key: str
    cost: float
    totalTokens: int = 0
    requestCount: int = 0


class CostSummary(BaseModel):
    tenantId: str
    startTime: datetime
    endTime: datetime
    totalCost: float
    totalTokens: int
    requestCount: int
    breakdown: List[CostByCategory] = Field(default_factory=list)


class TimeSeriesPoint(BaseModel):
    bucket: str
    cost: float
    tokens: int = 0
    requestCount: int = 0


class TimeSeriesResponse(BaseModel):
    tenantId: str
    interval: str
    startTime: datetime
    endTime: datetime
    points: List[TimeSeriesPoint] = Field(default_factory=list)


class ExportRequest(BaseModel):
    format: ExportFormat = ExportFormat.CSV
    dimension: str = "model"  # user / app / model / provider
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None