"""Quality schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class RuleType(str, Enum):
    NOT_NULL = "not_null"
    UNIQUE = "unique"
    RANGE = "range"
    ENUM = "enum"
    PATTERN = "pattern"
    CUSTOM_SQL = "custom_sql"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CheckResultStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    ERROR = "ERROR"


class QualityRule(BaseModel):
    id: str
    tenantId: str
    name: str
    table: str
    column: Optional[str] = None
    ruleType: RuleType
    params: dict[str, Any] = Field(default_factory=dict)
    severity: Severity = Severity.MEDIUM
    enabled: bool = True
    createdAt: datetime
    updatedAt: datetime


class CreateQualityRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    table: str
    column: Optional[str] = None
    ruleType: RuleType
    params: dict[str, Any] = Field(default_factory=dict)
    severity: Severity = Severity.MEDIUM
    enabled: bool = True


class UpdateQualityRuleRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    column: Optional[str] = None
    params: Optional[dict[str, Any]] = None
    severity: Optional[Severity] = None
    enabled: Optional[bool] = None


class QualityCheckResult(BaseModel):
    ruleId: str
    ruleName: str
    table: str
    column: Optional[str] = None
    ruleType: RuleType
    status: CheckResultStatus
    severity: Severity
    failedCount: int = 0
    totalCount: int = 0
    message: Optional[str] = None
    checkedAt: datetime


class QualityReport(BaseModel):
    id: str
    tenantId: str
    generatedAt: datetime
    totalRules: int
    passedRules: int
    failedRules: int
    results: List[QualityCheckResult]


class QualityDashboard(BaseModel):
    tenantId: str
    totalRules: int
    enabledRules: int
    passRate: float
    failedRules: int
    criticalIssues: int
    recentResults: List[QualityCheckResult]