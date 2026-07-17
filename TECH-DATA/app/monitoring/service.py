"""Monitoring service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.common.errors import InvalidParamError
from app.monitoring.schemas import (
    AlertInfo,
    AlertLogEntry,
    AlertSeverity,
    AlertStatus,
    MonitoringOverview,
    SlaInfo,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_alert_id() -> str:
    return f"alt-{uuid.uuid4().hex[:12]}"


def _new_log_id() -> str:
    return f"alg-{uuid.uuid4().hex[:12]}"


class MonitoringService:
    def __init__(self) -> None:
        self._alerts: Dict[str, AlertInfo] = {}
        self._logs: Dict[str, List[AlertLogEntry]] = {}

    # ---------------------------------------------------- overview

    async def overview(self, tenant_id: str) -> MonitoringOverview:
        alerts = [a for a in self._alerts.values() if a.tenantId == tenant_id]
        critical = sum(
            1 for a in alerts
            if a.severity == AlertSeverity.CRITICAL
            and a.status == AlertStatus.ACTIVE
        )
        return MonitoringOverview(
            tenantId=tenant_id,
            totalPipelines=24,
            runningPipelines=18,
            failedPipelines24h=2,
            successRate24h=96.5,
            totalAlerts=len(alerts),
            criticalAlerts=critical,
            dataVolume24h=10_500_000,
            generatedAt=_now(),
        )

    # ---------------------------------------------------- sla

    async def list_sla(self, tenant_id: str) -> List[SlaInfo]:
        return [
            SlaInfo(
                pipelineName="orders_etl",
                target="completion_within_30min",
                thresholdMs=30 * 60 * 1000,
                actualMs=27 * 60 * 1000 + 300_000,
                status="WITHIN_SLA",
                breachCount=0,
                lastCheckedAt=_now(),
            ),
            SlaInfo(
                pipelineName="customer_dim",
                target="completion_within_60min",
                thresholdMs=60 * 60 * 1000,
                actualMs=72 * 60 * 1000,
                status="BREACHED",
                breachCount=3,
                lastCheckedAt=_now(),
            ),
        ]

    # ---------------------------------------------------- alerts

    async def create_alert(
        self,
        tenant_id: str,
        *,
        title: str,
        description: Optional[str],
        severity: AlertSeverity,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AlertInfo:
        if not title:
            raise InvalidParamError("title 不能为空", data={"field": "title"})
        alert = AlertInfo(
            id=_new_alert_id(),
            tenantId=tenant_id,
            title=title,
            description=description,
            severity=severity,
            status=AlertStatus.ACTIVE,
            source=source,
            triggeredAt=_now(),
            metadata=metadata or {},
        )
        self._alerts[alert.id] = alert
        self._append_log(
            alert.id,
            AlertLogEntry(
                logId=_new_log_id(),
                alertId=alert.id,
                action="TRIGGERED",
                message=alert.title,
                occurredAt=_now(),
            ),
        )
        return alert

    async def list_alerts(
        self,
        tenant_id: str,
        *,
        severity: Optional[AlertSeverity] = None,
        status: Optional[AlertStatus] = None,
    ) -> List[AlertInfo]:
        items = [a for a in self._alerts.values() if a.tenantId == tenant_id]
        if severity is not None:
            items = [a for a in items if a.severity == severity]
        if status is not None:
            items = [a for a in items if a.status == status]
        return sorted(items, key=lambda a: a.triggeredAt, reverse=True)

    async def acknowledge_alert(
        self,
        tenant_id: str,
        alert_id: str,
        operator: Optional[str] = None,
    ) -> AlertInfo:
        alert = self._get_alert(tenant_id, alert_id)
        alert = alert.model_copy(update={"status": AlertStatus.ACKNOWLEDGED})
        self._alerts[alert_id] = alert
        self._append_log(
            alert_id,
            AlertLogEntry(
                logId=_new_log_id(),
                alertId=alert_id,
                action="ACKNOWLEDGED",
                operator=operator,
                occurredAt=_now(),
            ),
        )
        return alert

    async def resolve_alert(
        self,
        tenant_id: str,
        alert_id: str,
        operator: Optional[str] = None,
    ) -> AlertInfo:
        alert = self._get_alert(tenant_id, alert_id)
        alert = alert.model_copy(
            update={"status": AlertStatus.RESOLVED, "resolvedAt": _now()}
        )
        self._alerts[alert_id] = alert
        self._append_log(
            alert_id,
            AlertLogEntry(
                logId=_new_log_id(),
                alertId=alert_id,
                action="RESOLVED",
                operator=operator,
                occurredAt=_now(),
            ),
        )
        return alert

    # ---------------------------------------------------- logs

    async def list_logs(
        self, tenant_id: str, alert_id: Optional[str] = None
    ) -> List[AlertLogEntry]:
        if alert_id is not None:
            return list(self._logs.get(alert_id, []))
        flat: List[AlertLogEntry] = []
        for entries in self._logs.values():
            flat.extend(entries)
        return sorted(flat, key=lambda e: e.occurredAt, reverse=True)

    # ---------------------------------------------------- helpers

    def _get_alert(self, tenant_id: str, alert_id: str) -> AlertInfo:
        alert = self._alerts.get(alert_id)
        if alert is None or alert.tenantId != tenant_id:
            raise InvalidParamError(
                f"告警不存在: id={alert_id}", data={"id": alert_id}
            )
        return alert

    def _append_log(self, alert_id: str, entry: AlertLogEntry) -> None:
        self._logs.setdefault(alert_id, []).append(entry)