"""FastAPI routes for Alertmanager alert-rule management — write operations (扩展能力 — backlog §3.7).

Endpoints (all under ``/api/v1/admin/operations/alerts/rules``):

  POST   /api/v1/admin/operations/alerts/rules            — create custom rule
  GET    /api/v1/admin/operations/alerts/rules/managed    — list managed rules (system + custom)
  GET    /api/v1/admin/operations/alerts/rules/{rule_id}  — get one rule
  PUT    /api/v1/admin/operations/alerts/rules/{rule_id}  — update custom rule
  DELETE /api/v1/admin/operations/alerts/rules/{rule_id}  — soft-delete custom rule

The legacy ``GET /api/v1/admin/operations/alerts/rules`` (list, in
``admin/router.py``) is preserved untouched for backward
compatibility. The new ``GET .../managed`` endpoint provides the
tenant-aware unified listing with full lifecycle metadata.

Spec status: ``contracts/openapi/services/obs.yaml`` only declares the
``GET /alerts/rules`` (list) endpoint. The write operations are
extension capabilities per backlog §3.7 ("Alertmanager 告警规则管理(写)
未做"). They are wired under the canonical
``/api/v1/admin/operations`` prefix so a future contract amendment
lands them at the right path.

ADR-0014 5-step pattern
-----------------------
1. install_auth: wired in main.py (already done for the existing
   admin router).
2. require_tenant: every handler reads ``request.state.ctx`` and
   calls ``require_tenant(ctx)`` before touching the store.
3. Outbox: create / update / delete emit
   ``obs.alert_rule.created`` / ``obs.alert_rule.updated`` /
   ``obs.alert_rule.deleted`` events via the ``OutboxWriter`` (when
   configured). The handler tolerates a missing outbox (test profile).
4. BearerAuth: install_auth already enforces it.
5. Cross-tenant negative tests: see
   ``tests/test_alert_rule_management.py``.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from mate_platform.tenancy.guards import require_tenant

from ..alerts.management import (
    AlertRuleStore,
    ManagedAlertRule,
    VALID_SEVERITIES,
    emit_rule_event,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/admin/operations/alerts/rules", tags=["obs-alert-rules"])

# Module-level store (created in main.py and re-exported here for
# tests that import the router directly). main.py overrides this
# with its own instance at app-import time.
alert_rule_store: AlertRuleStore = AlertRuleStore()
# Optional outbox writer (None in test profile).
alert_rule_outbox: Any = None


def _set_store(store: AlertRuleStore) -> None:
    """Called by main.py to share its store instance with the router."""
    global alert_rule_store  # noqa: PLW0603
    alert_rule_store = store


def _set_outbox(outbox: Any) -> None:
    """Called by main.py to share its outbox instance with the router."""
    global alert_rule_outbox  # noqa: PLW0603
    alert_rule_outbox = outbox


def _tenant_id(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _serialize_rule(rule: ManagedAlertRule) -> dict[str, Any]:
    d = asdict(rule)
    d["created_at"] = rule.created_at.isoformat()
    d["updated_at"] = rule.updated_at.isoformat()
    return d


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class CreateAlertRuleRequest(BaseModel):
    alert: str = Field(..., min_length=1, description="Prometheus alert name (unique per tenant)")
    expr: str = Field(..., min_length=1, description="PromQL expression")
    for_duration: str = Field(..., description="duration, e.g. '5m', '1h'")
    severity: str = Field(..., description=f"one of {VALID_SEVERITIES}")
    description: str = Field(..., min_length=1)
    annotations: dict[str, str] = Field(default_factory=dict)


class UpdateAlertRuleRequest(BaseModel):
    alert: str | None = None
    expr: str | None = None
    for_duration: str | None = None
    severity: str | None = None
    description: str | None = None
    annotations: dict[str, str] | None = None
    status: str | None = Field(default=None, description="active | paused | deleted")


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
@router.post("", status_code=201)
async def create_alert_rule_endpoint(
    request: Request,
    req: CreateAlertRuleRequest,
) -> dict[str, Any]:
    """Create a custom alert rule for the calling tenant."""
    tenant_id = _tenant_id(request)
    try:
        rule = alert_rule_store.create_rule(
            tenant_id=tenant_id,
            alert=req.alert,
            expr=req.expr,
            for_duration=req.for_duration,
            severity=req.severity,
            description=req.description,
            annotations=req.annotations,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    emit_rule_event(alert_rule_outbox, action="created", rule=rule)
    return {"rule": _serialize_rule(rule)}


@router.get("/managed")
async def list_managed_alert_rules_endpoint(
    request: Request,
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
    include_system: bool = Query(default=True),
) -> dict[str, Any]:
    """List managed alert rules — system + custom for the calling tenant.

    The legacy ``GET /alerts/rules`` (in ``admin/router.py``) is
    preserved for backward compatibility and returns only the static
    system rules in the legacy response shape. This endpoint returns
    the tenant-aware unified listing with full lifecycle metadata.
    """
    tenant_id = _tenant_id(request)
    rules = alert_rule_store.list_rules(
        tenant_id=tenant_id,
        severity=severity,
        status=status,
        include_system=include_system,
    )
    return {
        "items": [_serialize_rule(r) for r in rules],
        "total": len(rules),
    }


@router.get("/{rule_id}")
async def get_alert_rule_endpoint(
    request: Request,
    rule_id: str,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    rule = alert_rule_store.get_rule(tenant_id=tenant_id, rule_id=rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="alert rule not found")
    return {"rule": _serialize_rule(rule)}


@router.put("/{rule_id}")
async def update_alert_rule_endpoint(
    request: Request,
    rule_id: str,
    req: UpdateAlertRuleRequest,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    try:
        rule = alert_rule_store.update_rule(
            tenant_id=tenant_id,
            rule_id=rule_id,
            alert=req.alert,
            expr=req.expr,
            for_duration=req.for_duration,
            severity=req.severity,
            description=req.description,
            annotations=req.annotations,
            status=req.status,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="alert rule not found") from None
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    emit_rule_event(alert_rule_outbox, action="updated", rule=rule)
    return {"rule": _serialize_rule(rule)}


@router.delete("/{rule_id}")
async def delete_alert_rule_endpoint(
    request: Request,
    rule_id: str,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    rule = alert_rule_store.get_rule(tenant_id=tenant_id, rule_id=rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="alert rule not found")
    try:
        ok = alert_rule_store.delete_rule(tenant_id=tenant_id, rule_id=rule_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    if not ok:
        raise HTTPException(status_code=404, detail="alert rule not found")
    # Re-fetch the soft-deleted row to emit the deletion event with
    # the new status.
    deleted = alert_rule_store.get_rule(tenant_id=tenant_id, rule_id=rule_id)
    if deleted is not None:
        emit_rule_event(alert_rule_outbox, action="deleted", rule=deleted)
    return {"deleted": True, "rule_id": rule_id}


__all__ = ["router", "alert_rule_store", "_set_store", "_set_outbox"]
