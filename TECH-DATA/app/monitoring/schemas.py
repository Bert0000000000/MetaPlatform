"""Monitoring schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    ACKNOWLEDGED = "ACKNOWLEDGED"


class MonitoringOverview(BaseModel):
    tenantId: str
    totalPipelines: int
    runningPipelines: int
    failedPipelines24h: int
    successRate24h: float
    totalAlerts: int
    criticalAlerts: int
    dataVolume24h: int
    generatedAt: datetime


class SlaInfo(BaseModel):
    pipelineName: str
    target: str
    thresholdMs: int
    actualMs: int
    status: str
    breachCount: int
    lastCheckedAt: datetime


class AlertInfo(BaseModel):
    id: str
    tenantId: str
    title: str
    description: Optional[str] = None
    severity: AlertSeverity
    status: AlertStatus
    source: str
    triggeredAt: datetime
    resolvedAt: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AlertLogEntry(BaseModel):
    logId: str
    alertId: str
    action: str
    message: Optional[str] = None
    operator: Optional[str] = None
    occurredAt: datetime