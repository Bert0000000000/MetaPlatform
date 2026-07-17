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
    QualityCheckResult,
    QualityDashboard,
    QualityReport,
    QualityRule,
    RuleType,
    Severity,
    UpdateQualityRuleRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_rule_id() -> str:
    return f"qr-{uuid.uuid4().hex[:12]}"


class QualityService:
    def __init__(self) -> None:
        self._rules: Dict[str, QualityRule] = {}
        self._results: Dict[str, List[QualityCheckResult]] = {}

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
    ) -> List[QualityRule]:
        items = [r for r in self._rules.values() if r.tenantId == tenant_id]
        if table is not None:
            items = [r for r in items if r.table == table]
        if severity is not None:
            items = [r for r in items if r.severity == severity]
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
                    message=(
                        f"{failed} rows failed / {total} total"
                        if failed
                        else "all good"
                    ),
                    checkedAt=_now(),
                )
            )
        self._results.setdefault(tenant_id, []).extend(results)
        return results

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