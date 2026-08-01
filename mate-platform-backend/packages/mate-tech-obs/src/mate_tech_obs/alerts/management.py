"""Alertmanager alert-rule management — write operations (扩展能力 — backlog §3.7).

The obs spec only declares ``GET /api/v1/admin/operations/alerts/rules``
(the 10 built-in rules in ``rules.py``). ``Alertmanager 告警规则管理(写)``
is a declared gap. This module adds:

* ``ManagedAlertRule`` — a tenant-scoped custom alert rule (CRUD-able).
* ``AlertRuleStore`` — in-memory tenant-scoped repository. The 10
  built-in rules from ``rules.ALERT_RULES`` are seeded as
  ``system=True`` rows (immutable); tenant-created rules are
  ``system=False`` (mutable).
* Outbox integration — create / update / delete emit
  ``obs.alert_rule.created`` / ``obs.alert_rule.updated`` /
  ``obs.alert_rule.deleted`` events through the
  ``mate_platform.messaging.OutboxWriter`` Protocol when one is
  configured. The handler tolerates a missing outbox (test profile).

Production replaces the in-memory store with the SQL store (out of
scope per task constraint "不修改持久化层"); the API surface is
identical so the swap is mechanical.

The store is tenant-scoped: every method takes ``tenant_id`` from
the request context (never from the body / path) and refuses
cross-tenant reads / writes (SEC-TENANT-01 hard rule 3).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

import structlog

from mate_platform.messaging import Event, OutboxWriter

from .rules import ALERT_RULES

logger = structlog.get_logger(__name__)

RuleStatus = str  # "active" | "paused" | "deleted"
VALID_SEVERITIES = ("critical", "warning", "info")


@dataclass(frozen=True)
class ManagedAlertRule:
    """Custom or system alert rule with tenant + lifecycle metadata."""

    id: str
    tenant_id: str
    alert: str
    expr: str
    for_duration: str
    severity: str
    description: str
    annotations: dict[str, str]
    status: RuleStatus = "active"
    system: bool = False  # True for the 10 built-in rules (immutable)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


def _seed_system_rules(tenant_id: str) -> list[ManagedAlertRule]:
    """Materialize the 10 built-in rules as read-only system rows.

    System rules are visible to every tenant (the same 10 baseline
    rules apply platform-wide) but cannot be modified or deleted.
    """
    now = datetime.now(UTC)
    return [
        ManagedAlertRule(
            id=f"system-{i + 1:02d}",
            tenant_id=tenant_id,
            alert=r.alert,
            expr=r.expr,
            for_duration=r.for_duration,
            severity=r.severity,
            description=r.description,
            annotations=dict(r.annotations),
            status="active",
            system=True,
            created_at=now,
            updated_at=now,
        )
        for i, r in enumerate(ALERT_RULES)
    ]


class AlertRuleStore:
    """In-memory tenant-scoped alert rule repository.

    The store is seeded lazily per-tenant with the 10 system rules
    on first access; tenant-created rules are mutable.
    """

    def __init__(self) -> None:
        self._rules: dict[str, dict[str, ManagedAlertRule]] = {}
        self._counter: int = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"rule-{self._counter:08d}"

    def _ensure_seed(self, tenant_id: str) -> dict[str, ManagedAlertRule]:
        bucket = self._rules.get(tenant_id)
        if bucket is None:
            bucket = {r.id: r for r in _seed_system_rules(tenant_id)}
            self._rules[tenant_id] = bucket
        return bucket

    # ----- reads -----
    def list_rules(
        self,
        *,
        tenant_id: str,
        severity: str | None = None,
        status: RuleStatus | None = None,
        include_system: bool = True,
    ) -> list[ManagedAlertRule]:
        bucket = self._ensure_seed(tenant_id)
        rows = list(bucket.values())
        if not include_system:
            rows = [r for r in rows if not r.system]
        if severity:
            rows = [r for r in rows if r.severity == severity]
        if status:
            rows = [r for r in rows if r.status == status]
        return sorted(rows, key=lambda r: (r.system, r.alert, r.created_at))

    def get_rule(self, *, tenant_id: str, rule_id: str) -> ManagedAlertRule | None:
        bucket = self._ensure_seed(tenant_id)
        return bucket.get(rule_id)

    # ----- writes -----
    def create_rule(
        self,
        *,
        tenant_id: str,
        alert: str,
        expr: str,
        for_duration: str,
        severity: str,
        description: str,
        annotations: dict[str, str] | None = None,
    ) -> ManagedAlertRule:
        if not tenant_id:
            raise ValueError("tenant_id required")
        self._validate_rule_fields(
            alert=alert,
            expr=expr,
            for_duration=for_duration,
            severity=severity,
            description=description,
        )
        bucket = self._ensure_seed(tenant_id)
        # Reject duplicate alert names within the same tenant
        # (Prometheus requires globally unique alert names; within a
        # tenant is the strongest enforceable bound here).
        for existing in bucket.values():
            if existing.alert == alert and existing.status != "deleted":
                raise ValueError(
                    f"alert rule with name {alert!r} already exists in this tenant"
                )
        rule_id = self._next_id()
        rule = ManagedAlertRule(
            id=rule_id,
            tenant_id=tenant_id,
            alert=alert.strip(),
            expr=expr.strip(),
            for_duration=for_duration.strip(),
            severity=severity.strip(),
            description=description.strip(),
            annotations=dict(annotations) if annotations else {},
            system=False,
        )
        bucket[rule_id] = rule
        logger.info(
            "alert_rule.created",
            rule_id=rule_id,
            tenant_id=tenant_id,
            alert=alert,
        )
        return rule

    def update_rule(
        self,
        *,
        tenant_id: str,
        rule_id: str,
        alert: str | None = None,
        expr: str | None = None,
        for_duration: str | None = None,
        severity: str | None = None,
        description: str | None = None,
        annotations: dict[str, str] | None = None,
        status: RuleStatus | None = None,
    ) -> ManagedAlertRule:
        bucket = self._ensure_seed(tenant_id)
        existing = bucket.get(rule_id)
        if existing is None:
            raise KeyError(rule_id)
        if existing.system:
            raise PermissionError(
                f"system alert rule {rule_id!r} is immutable"
            )
        # Merge patches
        new_alert = alert if alert is not None else existing.alert
        new_expr = expr if expr is not None else existing.expr
        new_for = for_duration if for_duration is not None else existing.for_duration
        new_sev = severity if severity is not None else existing.severity
        new_desc = description if description is not None else existing.description
        new_ann = dict(annotations) if annotations is not None else dict(existing.annotations)
        new_status = status if status is not None else existing.status
        self._validate_rule_fields(
            alert=new_alert,
            expr=new_expr,
            for_duration=new_for,
            severity=new_sev,
            description=new_desc,
        )
        if new_status not in ("active", "paused", "deleted"):
            raise ValueError(f"invalid status {new_status!r}")
        # Reject name collision with another active rule.
        if new_alert != existing.alert:
            for other in bucket.values():
                if other.id == rule_id:
                    continue
                if other.alert == new_alert and other.status != "deleted":
                    raise ValueError(
                        f"alert rule with name {new_alert!r} already exists in this tenant"
                    )
        updated = ManagedAlertRule(
            id=existing.id,
            tenant_id=existing.tenant_id,
            alert=new_alert.strip(),
            expr=new_expr.strip(),
            for_duration=new_for.strip(),
            severity=new_sev.strip(),
            description=new_desc.strip(),
            annotations=new_ann,
            status=new_status,
            system=False,
            created_at=existing.created_at,
            updated_at=datetime.now(UTC),
        )
        bucket[rule_id] = updated
        logger.info(
            "alert_rule.updated",
            rule_id=rule_id,
            tenant_id=tenant_id,
            alert=updated.alert,
        )
        return updated

    def delete_rule(self, *, tenant_id: str, rule_id: str) -> bool:
        bucket = self._ensure_seed(tenant_id)
        existing = bucket.get(rule_id)
        if existing is None:
            return False
        if existing.system:
            raise PermissionError(
                f"system alert rule {rule_id!r} is immutable"
            )
        # Soft-delete: keep the row for audit but mark status=deleted.
        bucket[rule_id] = ManagedAlertRule(
            id=existing.id,
            tenant_id=existing.tenant_id,
            alert=existing.alert,
            expr=existing.expr,
            for_duration=existing.for_duration,
            severity=existing.severity,
            description=existing.description,
            annotations=existing.annotations,
            status="deleted",
            system=False,
            created_at=existing.created_at,
            updated_at=datetime.now(UTC),
        )
        logger.info(
            "alert_rule.deleted",
            rule_id=rule_id,
            tenant_id=tenant_id,
        )
        return True

    def reset(self) -> None:
        """Drop all data. Used by tests."""
        self._rules.clear()
        self._counter = 0

    # ----- helpers -----
    @staticmethod
    def _validate_rule_fields(
        *,
        alert: str,
        expr: str,
        for_duration: str,
        severity: str,
        description: str,
    ) -> None:
        if not alert or not alert.strip():
            raise ValueError("alert name required")
        if not expr or not expr.strip():
            raise ValueError("expr required")
        if not for_duration or not for_duration.strip():
            raise ValueError("for_duration required")
        if severity not in VALID_SEVERITIES:
            raise ValueError(
                f"severity must be one of {VALID_SEVERITIES}, got {severity!r}"
            )
        if not description or not description.strip():
            raise ValueError("description required")


# ---------------------------------------------------------------------------
# Outbox emission helpers
# ---------------------------------------------------------------------------
def emit_rule_event(
    outbox: OutboxWriter | None,
    *,
    action: str,
    rule: ManagedAlertRule,
    trace_id: str = "",
) -> None:
    """Append an outbox event for a rule mutation.

    The outbox is optional: when ``None`` (test profile) the call is
    a no-op so handlers can be exercised without a PG transaction.
    """
    if outbox is None:
        return
    event = Event.create(
        type=f"obs.alert_rule.{action}",
        tenant_id=rule.tenant_id,
        aggregate_id=rule.id,
        payload={
            "rule_id": rule.id,
            "alert": rule.alert,
            "severity": rule.severity,
            "expr": rule.expr,
            "for_duration": rule.for_duration,
            "status": rule.status,
            "system": rule.system,
        },
        trace_id=trace_id,
    )
    outbox.append(event)


__all__ = [
    "AlertRuleStore",
    "ManagedAlertRule",
    "RuleStatus",
    "VALID_SEVERITIES",
    "emit_rule_event",
]
