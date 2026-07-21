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


# ============ V11-01: 与前端对齐的质量维度 / 问题严重度 / 问题状态 ============


class QualityDimension(str, Enum):
    """数据质量维度（与前端 QualityDimension 对齐）"""

    COMPLETENESS = "completeness"
    ACCURACY = "accuracy"
    CONSISTENCY = "consistency"
    TIMELINESS = "timeliness"
    UNIQUENESS = "uniqueness"
    VALIDITY = "validity"


class IssueSeverity(str, Enum):
    """问题严重度（与前端 QualitySeverity 对齐，3 档）"""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class QualityIssueStatus(str, Enum):
    """问题状态（与前端 QualityIssueStatus 对齐）"""

    OPEN = "open"
    RESOLVED = "resolved"
    IGNORED = "ignored"


# ----- ruleType ↔ dimension 映射 -----
_RULE_TYPE_TO_DIMENSION: dict[RuleType, QualityDimension] = {
    RuleType.NOT_NULL: QualityDimension.COMPLETENESS,
    RuleType.UNIQUE: QualityDimension.UNIQUENESS,
    RuleType.RANGE: QualityDimension.VALIDITY,
    RuleType.ENUM: QualityDimension.VALIDITY,
    RuleType.PATTERN: QualityDimension.VALIDITY,
    RuleType.CUSTOM_SQL: QualityDimension.ACCURACY,
}

_DIMENSION_TO_RULE_TYPE: dict[QualityDimension, RuleType] = {
    QualityDimension.COMPLETENESS: RuleType.NOT_NULL,
    QualityDimension.UNIQUENESS: RuleType.UNIQUE,
    QualityDimension.VALIDITY: RuleType.RANGE,
    QualityDimension.ACCURACY: RuleType.CUSTOM_SQL,
    QualityDimension.CONSISTENCY: RuleType.CUSTOM_SQL,
    QualityDimension.TIMELINESS: RuleType.CUSTOM_SQL,
}


def rule_type_to_dimension(rt: RuleType) -> QualityDimension:
    return _RULE_TYPE_TO_DIMENSION.get(rt, QualityDimension.VALIDITY)


def dimension_to_rule_type(dim: QualityDimension) -> RuleType:
    return _DIMENSION_TO_RULE_TYPE.get(dim, RuleType.CUSTOM_SQL)


# ----- severity ↔ issueSeverity 映射 -----
_SEVERITY_TO_ISSUE: dict[Severity, IssueSeverity] = {
    Severity.LOW: IssueSeverity.INFO,
    Severity.MEDIUM: IssueSeverity.WARNING,
    Severity.HIGH: IssueSeverity.CRITICAL,
    Severity.CRITICAL: IssueSeverity.CRITICAL,
}

_ISSUE_TO_SEVERITY: dict[IssueSeverity, Severity] = {
    IssueSeverity.INFO: Severity.LOW,
    IssueSeverity.WARNING: Severity.MEDIUM,
    IssueSeverity.CRITICAL: Severity.HIGH,
}


def severity_to_issue_severity(s: Severity) -> IssueSeverity:
    return _SEVERITY_TO_ISSUE.get(s, IssueSeverity.WARNING)


def issue_severity_to_severity(s: IssueSeverity) -> Severity:
    return _ISSUE_TO_SEVERITY.get(s, Severity.MEDIUM)


# ============ 原有 QualityRule / 检查结果 / 报告 ============


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


# ============ V11-01 新增：质量问题 / 概览 / 评分卡 ============


class QualityIssue(BaseModel):
    """数据质量问题（与前端 QualityIssue 对齐）"""

    issueId: str
    ruleId: str
    ruleName: str
    dimension: QualityDimension
    severity: IssueSeverity
    status: QualityIssueStatus
    conceptId: str  # V1.1 暂用 table 字段兼容
    conceptName: Optional[str] = None
    attributeId: Optional[str] = None  # V1.1 暂用 column 字段兼容
    attributeName: Optional[str] = None
    entityId: Optional[str] = None
    entityName: Optional[str] = None
    message: str
    detectedAt: datetime
    resolvedAt: Optional[datetime] = None
    suggestion: Optional[str] = None


class UpdateIssueStatusRequest(BaseModel):
    status: QualityIssueStatus


class QualityScoreCard(BaseModel):
    """质量维度评分卡"""

    dimension: QualityDimension
    score: float  # 0-100
    issueCount: int
    trend: float = 0.0  # delta vs last period, can be negative


class QualityOverview(BaseModel):
    """质量概览（与前端 QualityOverview 对齐）"""

    overallScore: float
    totalRules: int
    enabledRules: int
    totalIssues: int
    openIssues: int
    criticalIssues: int
    lastRunAt: Optional[datetime] = None
    scores: List[QualityScoreCard] = Field(default_factory=list)


class RunQualityCheckRequest(BaseModel):
    """触发质量检测任务请求"""

    conceptId: Optional[str] = None  # V1.1 暂映射为 table
    table: Optional[str] = None


class QualityCheckJob(BaseModel):
    """质量检测任务"""

    jobId: str
    startedAt: datetime
    finishedAt: Optional[datetime] = None
    status: str = "running"  # running / completed / failed
    totalRules: int = 0
    failedCount: int = 0
    issuesGenerated: int = 0
