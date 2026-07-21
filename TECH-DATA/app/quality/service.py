"""Quality service."""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.common.errors import (
    DataSourceNotFoundError,
    InvalidParamError,
)
from app.quality.schemas import (
    CheckResultStatus,
    CreateQualityRuleRequest,
    IssueSeverity,
    QualityCheckJob,
    QualityCheckResult,
    QualityDashboard,
    QualityDimension,
    QualityIssue,
    QualityIssueStatus,
    QualityOverview,
    QualityReport,
    QualityRule,
    QualityScoreCard,
    RuleType,
    RunQualityCheckRequest,
    Severity,
    UpdateIssueStatusRequest,
    UpdateQualityRuleRequest,
    dimension_to_rule_type,
    issue_severity_to_severity,
    rule_type_to_dimension,
    severity_to_issue_severity,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_rule_id() -> str:
    return f"qr-{uuid.uuid4().hex[:12]}"


def _new_issue_id() -> str:
    return f"qi-{uuid.uuid4().hex[:12]}"


def _new_job_id() -> str:
    return f"job-{uuid.uuid4().hex[:12]}"


# 6 个维度的默认评分基线（用于无数据时仍给出合理概览）
_DIMENSION_BASELINE: dict[QualityDimension, float] = {
    QualityDimension.COMPLETENESS: 92.0,
    QualityDimension.ACCURACY: 85.0,
    QualityDimension.CONSISTENCY: 78.0,
    QualityDimension.TIMELINESS: 88.0,
    QualityDimension.UNIQUENESS: 95.0,
    QualityDimension.VALIDITY: 80.0,
}


class QualityService:
    def __init__(self) -> None:
        self._rules: Dict[str, QualityRule] = {}
        # tenant_id -> list of check results (历史检查结果)
        self._results: Dict[str, List[QualityCheckResult]] = {}
        # tenant_id -> list of issues (问题列表)
        self._issues: Dict[str, List[QualityIssue]] = {}
        # tenant_id -> last run datetime
        self._last_run: Dict[str, datetime] = {}
        # tenant_id -> list of jobs (检测任务历史)
        self._jobs: Dict[str, List[QualityCheckJob]] = {}

    # ---------------------------------------------------- CRUD

    async def create_rule(
        self, tenant_id: str, request: CreateQualityRuleRequest
    ) -> QualityRule:
        rule = QualityRule(
            id=_new_rule_id(),
            tenantId=tenant_id,
            name=request.name,
            table=request.table,
            column=request.column,
            ruleType=request.ruleType,
            params=request.params,
            severity=request.severity,
            enabled=request.enabled,
            createdAt=_now(),
            updatedAt=_now(),
        )
        self._rules[rule.id] = rule
        return rule

    async def list_rules(
        self,
        tenant_id: str,
        *,
        table: Optional[str] = None,
        severity: Optional[Severity] = None,
        dimension: Optional[QualityDimension] = None,
    ) -> List[QualityRule]:
        items = [r for r in self._rules.values() if r.tenantId == tenant_id]
        if table is not None:
            items = [r for r in items if r.table == table]
        if severity is not None:
            items = [r for r in items if r.severity == severity]
        if dimension is not None:
            expected_rt = dimension_to_rule_type(dimension)
            items = [r for r in items if r.ruleType == expected_rt]
        return items

    async def get_rule(self, tenant_id: str, rule_id: str) -> QualityRule:
        r = self._rules.get(rule_id)
        if r is None or r.tenantId != tenant_id:
            raise DataSourceNotFoundError(
                f"质量规则不存在: id={rule_id}", data={"id": rule_id}
            )
        return r

    async def update_rule(
        self,
        tenant_id: str,
        rule_id: str,
        request: UpdateQualityRuleRequest,
    ) -> QualityRule:
        rule = await self.get_rule(tenant_id, rule_id)
        fields: Dict[str, Any] = {"updatedAt": _now()}
        if request.name is not None:
            fields["name"] = request.name
        if request.column is not None:
            fields["column"] = request.column
        if request.params is not None:
            fields["params"] = request.params
        if request.severity is not None:
            fields["severity"] = request.severity
        if request.enabled is not None:
            fields["enabled"] = request.enabled
        updated = rule.model_copy(update=fields)
        self._rules[rule_id] = updated
        return updated

    async def delete_rule(self, tenant_id: str, rule_id: str) -> Dict[str, Any]:
        await self.get_rule(tenant_id, rule_id)
        self._rules.pop(rule_id, None)
        return {"id": rule_id, "deleted": True}

    # ---------------------------------------------------- checks

    async def execute_checks(
        self, tenant_id: str, table: Optional[str] = None
    ) -> List[QualityCheckResult]:
        rules = await self.list_rules(tenant_id, table=table)
        results: List[QualityCheckResult] = []
        new_issues: List[QualityIssue] = []
        now = _now()
        for r in rules:
            if not r.enabled:
                continue
            status = CheckResultStatus.PASS
            failed = 0
            total = 1000
            # simple heuristic to make output interesting
            if r.ruleType == RuleType.NOT_NULL:
                failed = random.randint(0, 5)
            elif r.ruleType == RuleType.UNIQUE:
                failed = random.randint(0, 2)
            else:
                failed = random.randint(0, 10)
            if failed > 0:
                status = CheckResultStatus.FAIL
            message = (
                f"{failed} rows failed / {total} total"
                if failed
                else "all good"
            )
            results.append(
                QualityCheckResult(
                    ruleId=r.id,
                    ruleName=r.name,
                    table=r.table,
                    column=r.column,
                    ruleType=r.ruleType,
                    status=status,
                    severity=r.severity,
                    failedCount=failed,
                    totalCount=total,
                    message=message,
                    checkedAt=now,
                )
            )
            # FAIL 时同步生成 issue
            if status == CheckResultStatus.FAIL:
                new_issues.append(
                    self._result_to_issue(r, results[-1])
                )
        self._results.setdefault(tenant_id, []).extend(results)
        if new_issues:
            self._issues.setdefault(tenant_id, []).extend(new_issues)
        self._last_run[tenant_id] = now
        return results

    @staticmethod
    def _result_to_issue(
        rule: QualityRule, result: QualityCheckResult
    ) -> QualityIssue:
        """将 FAIL 的检查结果转换为 QualityIssue（字段映射）。"""
        dim = rule_type_to_dimension(rule.ruleType)
        sev = severity_to_issue_severity(rule.severity)
        return QualityIssue(
            issueId=_new_issue_id(),
            ruleId=rule.id,
            ruleName=rule.name,
            dimension=dim,
            severity=sev,
            status=QualityIssueStatus.OPEN,
            conceptId=rule.table,  # V1.1: table 兼容 conceptId
            conceptName=None,
            attributeId=rule.column,  # V1.1: column 兼容 attributeId
            attributeName=None,
            entityId=None,
            entityName=None,
            message=result.message or f"规则 {rule.name} 校验失败",
            detectedAt=result.checkedAt,
            resolvedAt=None,
            suggestion=QualityService._build_suggestion(rule, dim),
        )

    @staticmethod
    def _build_suggestion(rule: QualityRule, dim: QualityDimension) -> str:
        if dim == QualityDimension.COMPLETENESS:
            return f"请检查 {rule.table}.{rule.column or '*'} 是否存在空值，建议在数据集成层增加 NOT NULL 约束"
        if dim == QualityDimension.UNIQUENESS:
            return f"请检查 {rule.table}.{rule.column or '*'} 是否存在重复记录，建议增加唯一索引或去重逻辑"
        if dim == QualityDimension.VALIDITY:
            return f"请核查 {rule.table}.{rule.column or '*'} 取值是否符合规则参数：{rule.params}"
        return f"请核查 {rule.table}.{rule.column or '*'} 数据，并复核规则表达式"

    async def generate_report(
        self, tenant_id: str, table: Optional[str] = None
    ) -> QualityReport:
        results = await self.execute_checks(tenant_id, table)
        passed = sum(1 for r in results if r.status == CheckResultStatus.PASS)
        failed = sum(1 for r in results if r.status == CheckResultStatus.FAIL)
        return QualityReport(
            id=f"rep-{uuid.uuid4().hex[:12]}",
            tenantId=tenant_id,
            generatedAt=_now(),
            totalRules=len(results),
            passedRules=passed,
            failedRules=failed,
            results=results,
        )

    async def dashboard(self, tenant_id: str) -> QualityDashboard:
        rules = await self.list_rules(tenant_id)
        recent = self._results.get(tenant_id, [])[-20:]
        total = len(rules)
        enabled = sum(1 for r in rules if r.enabled)
        failed = sum(
            1 for r in recent if r.status == CheckResultStatus.FAIL
        )
        critical = sum(
            1 for r in recent
            if r.status == CheckResultStatus.FAIL
            and r.severity == Severity.CRITICAL
        )
        pass_rate = (
            round((len(recent) - failed) / len(recent) * 100, 1)
            if recent
            else 0.0
        )
        return QualityDashboard(
            tenantId=tenant_id,
            totalRules=total,
            enabledRules=enabled,
            passRate=pass_rate,
            failedRules=failed,
            criticalIssues=critical,
            recentResults=recent,
        )

    # ---------------------------------------------------- V11-01 新增：issues / overview / run

    async def list_issues(
        self,
        tenant_id: str,
        *,
        status: Optional[QualityIssueStatus] = None,
        dimension: Optional[QualityDimension] = None,
        severity: Optional[IssueSeverity] = None,
        concept_id: Optional[str] = None,
    ) -> List[QualityIssue]:
        items = list(self._issues.get(tenant_id, []))
        if status is not None:
            items = [i for i in items if i.status == status]
        if dimension is not None:
            items = [i for i in items if i.dimension == dimension]
        if severity is not None:
            items = [i for i in items if i.severity == severity]
        if concept_id is not None:
            items = [i for i in items if i.conceptId == concept_id]
        return items

    async def get_issue(
        self, tenant_id: str, issue_id: str
    ) -> QualityIssue:
        for i in self._issues.get(tenant_id, []):
            if i.issueId == issue_id:
                return i
        raise DataSourceNotFoundError(
            f"质量问题不存在: id={issue_id}", data={"id": issue_id}
        )

    async def update_issue_status(
        self,
        tenant_id: str,
        issue_id: str,
        request: UpdateIssueStatusRequest,
    ) -> QualityIssue:
        issue = await self.get_issue(tenant_id, issue_id)
        fields: Dict[str, Any] = {"status": request.status}
        if request.status == QualityIssueStatus.RESOLVED:
            fields["resolvedAt"] = _now()
        elif request.status == QualityIssueStatus.IGNORED:
            # ignored 也记录处理时间，保留原 resolvedAt
            if issue.resolvedAt is None:
                fields["resolvedAt"] = _now()
        else:  # OPEN
            fields["resolvedAt"] = None
        updated = issue.model_copy(update=fields)
        # 替换列表中的元素
        lst = self._issues.setdefault(tenant_id, [])
        for idx, i in enumerate(lst):
            if i.issueId == issue_id:
                lst[idx] = updated
                break
        return updated

    async def get_overview(self, tenant_id: str) -> QualityOverview:
        rules = await self.list_rules(tenant_id)
        issues = self._issues.get(tenant_id, [])
        total_rules = len(rules)
        enabled_rules = sum(1 for r in rules if r.enabled)
        total_issues = len(issues)
        open_issues = sum(
            1 for i in issues if i.status == QualityIssueStatus.OPEN
        )
        critical_issues = sum(
            1
            for i in issues
            if i.status == QualityIssueStatus.OPEN
            and i.severity == IssueSeverity.CRITICAL
        )

        # 按维度统计 issue 数并计算评分
        scores: List[QualityScoreCard] = []
        for dim in QualityDimension:
            cnt = sum(1 for i in issues if i.dimension == dim)
            baseline = _DIMENSION_BASELINE.get(dim, 80.0)
            # issue 越多分数越低，每个 issue 扣 1.5 分，最低 30
            score = max(30.0, baseline - cnt * 1.5)
            # 简单 trend 模拟：基于 open_issues 比例
            open_ratio = (open_issues / total_issues) if total_issues else 0
            trend = round(-open_ratio * 5 + (1 - open_ratio) * 2, 1)
            scores.append(
                QualityScoreCard(
                    dimension=dim,
                    score=round(score, 1),
                    issueCount=cnt,
                    trend=trend,
                )
            )
        # 综合分 = 维度分数加权平均
        overall = (
            round(sum(s.score for s in scores) / len(scores), 1)
            if scores
            else 0.0
        )
        return QualityOverview(
            overallScore=overall,
            totalRules=total_rules,
            enabledRules=enabled_rules,
            totalIssues=total_issues,
            openIssues=open_issues,
            criticalIssues=critical_issues,
            lastRunAt=self._last_run.get(tenant_id),
            scores=scores,
        )

    async def run_check_job(
        self,
        tenant_id: str,
        request: RunQualityCheckRequest,
    ) -> QualityCheckJob:
        # V1.1: conceptId 兼容映射为 table
        table = request.table or request.conceptId
        job = QualityCheckJob(
            jobId=_new_job_id(),
            startedAt=_now(),
            status="running",
        )
        try:
            results = await self.execute_checks(tenant_id, table=table)
            job.totalRules = len(results)
            job.failedCount = sum(
                1 for r in results if r.status == CheckResultStatus.FAIL
            )
            job.issuesGenerated = job.failedCount
            job.status = "completed"
        except Exception:  # pragma: no cover
            job.status = "failed"
        job.finishedAt = _now()
        self._jobs.setdefault(tenant_id, []).append(job)
        return job

    # ---------------------------------------------------- 规则 → 前端 QualityRule 视图（可选）

    def rule_to_frontend_view(self, rule: QualityRule) -> Dict[str, Any]:
        """把后端 QualityRule 转换为前端期望的字段（dimension/severity/conceptId/attributeId）。"""
        return {
            "ruleId": rule.id,
            "name": rule.name,
            "dimension": rule_type_to_dimension(rule.ruleType).value,
            "description": rule.params.get("description", "")
            if rule.params
            else "",
            "conceptId": rule.table,  # V1.1 兼容
            "attributeId": rule.column,  # V1.1 兼容
            "expression": rule.params.get("expression", "")
            if rule.params
            else f"{rule.ruleType.value}({rule.column or '*'})",
            "severity": severity_to_issue_severity(rule.severity).value,
            "enabled": rule.enabled,
        }
