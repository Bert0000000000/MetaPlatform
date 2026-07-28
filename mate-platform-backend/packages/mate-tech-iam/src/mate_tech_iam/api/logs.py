"""Audit log query and export endpoints (FR-DASH-006-04)."""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.audit import AuditAction, AuditLog
from ..services.deps import AdminDep, SessionDep
from .response import ok, page

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/admin/logs", tags=["admin-logs"])


def _parse_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


@router.get("/audit")
async def list_audit_logs(
    caller: AdminDep,
    session: SessionDep,
    actor: str | None = Query(default=None, description="按 actor_name / actor_id 模糊"),
    module: str | None = Query(default=None, description="user/role/org/config/..."),
    action: AuditAction | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    resource_id: str | None = Query(default=None),
    start: str | None = Query(default=None, description="ISO8601 起时间"),
    end: str | None = Query(default=None, description="ISO8601 止时间"),
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=50, ge=1, le=500, alias="pageSize"),
) -> dict[str, Any]:
    base = select(AuditLog).where(AuditLog.tenant_id == caller.tenant_id)
    if actor:
        like = f"%{actor}%"
        base = base.where(or_(AuditLog.actor_name.like(like), AuditLog.actor_id.like(like)))
    if module:
        base = base.where(AuditLog.module == module)
    if action is not None:
        base = base.where(AuditLog.action == action)
    if resource_type:
        base = base.where(AuditLog.resource_type == resource_type)
    if resource_id:
        base = base.where(AuditLog.resource_id == resource_id)
    start_dt = _parse_dt(start)
    end_dt = _parse_dt(end)
    if start_dt:
        base = base.where(AuditLog.occurred_at >= start_dt)
    if end_dt:
        base = base.where(AuditLog.occurred_at <= end_dt)

    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt = base.order_by(AuditLog.occurred_at.desc()).offset((page_num - 1) * page_size).limit(page_size)
    rows = (await session.execute(stmt)).scalars().all()
    items = [
        {
            "id": log.id,
            "actorId": log.actor_id,
            "actorName": log.actor_name,
            "module": log.module,
            "action": log.action.value if log.action else None,
            "resourceType": log.resource_type,
            "resourceId": log.resource_id,
            "resourceName": log.resource_name,
            "summary": log.summary,
            "detail": log.detail,
            "ip": log.ip,
            "userAgent": log.user_agent,
            "occurredAt": log.occurred_at.isoformat(),
        }
        for log in rows
    ]
    return page(items=items, total=total, page=page_num, page_size=page_size)


@router.get("/audit/export")
async def export_audit_logs(
    caller: AdminDep,
    session: SessionDep,
    actor: str | None = Query(default=None),
    module: str | None = Query(default=None),
    action: AuditAction | None = Query(default=None),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    fmt: str = Query(default="csv", pattern="^(csv|json)$"),
) -> StreamingResponse:
    base = select(AuditLog).where(AuditLog.tenant_id == caller.tenant_id)
    if actor:
        like = f"%{actor}%"
        base = base.where(or_(AuditLog.actor_name.like(like), AuditLog.actor_id.like(like)))
    if module:
        base = base.where(AuditLog.module == module)
    if action is not None:
        base = base.where(AuditLog.action == action)
    start_dt = _parse_dt(start)
    end_dt = _parse_dt(end)
    if start_dt:
        base = base.where(AuditLog.occurred_at >= start_dt)
    if end_dt:
        base = base.where(AuditLog.occurred_at <= end_dt)

    rows = (await session.execute(base.order_by(AuditLog.occurred_at.desc()).limit(50000))).scalars().all()

    if fmt == "json":
        import json as jsonlib
        payload = [
            {
                "id": log.id,
                "actorId": log.actor_id,
                "actorName": log.actor_name,
                "module": log.module,
                "action": log.action.value if log.action else None,
                "resourceType": log.resource_type,
                "resourceId": log.resource_id,
                "resourceName": log.resource_name,
                "summary": log.summary,
                "detail": log.detail,
                "ip": log.ip,
                "userAgent": log.user_agent,
                "occurredAt": log.occurred_at.isoformat(),
            }
            for log in rows
        ]
        body = jsonlib.dumps(payload, ensure_ascii=False, default=str)
        return StreamingResponse(
            iter([body]),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="audit-logs.json"'},
        )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "id", "occurred_at", "actor_id", "actor_name", "module", "action",
        "resource_type", "resource_id", "resource_name", "summary", "ip",
    ])
    for log in rows:
        writer.writerow([
            log.id,
            log.occurred_at.isoformat(),
            log.actor_id,
            log.actor_name or "",
            log.module,
            log.action.value if log.action else "",
            log.resource_type or "",
            log.resource_id or "",
            log.resource_name or "",
            log.summary or "",
            log.ip or "",
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit-logs.csv"'},
    )


@router.get("/audit/{log_id}")
async def get_audit_log(
    caller: AdminDep,
    session: SessionDep,
    log_id: int,
) -> dict[str, Any]:
    log = (
        await session.execute(
            select(AuditLog).where(and_(AuditLog.id == log_id, AuditLog.tenant_id == caller.tenant_id))
        )
    ).scalar_one_or_none()
    if not log:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "日志不存在"})
    return ok({
        "id": log.id,
        "actorId": log.actor_id,
        "actorName": log.actor_name,
        "module": log.module,
        "action": log.action.value if log.action else None,
        "resourceType": log.resource_type,
        "resourceId": log.resource_id,
        "resourceName": log.resource_name,
        "summary": log.summary,
        "detail": log.detail,
        "ip": log.ip,
        "userAgent": log.user_agent,
        "occurredAt": log.occurred_at.isoformat(),
    })


@router.get("/modules")
async def list_modules(
    caller: AdminDep,
    session: SessionDep,
) -> dict[str, Any]:
    """枚举当前租户出现过的 module + action，便于前端过滤."""
    mods = (
        await session.execute(
            select(AuditLog.module, func.count(AuditLog.id))
            .where(AuditLog.tenant_id == caller.tenant_id)
            .group_by(AuditLog.module)
        )
    ).all()
    actions = (
        await session.execute(
            select(AuditLog.action, func.count(AuditLog.id))
            .where(AuditLog.tenant_id == caller.tenant_id)
            .group_by(AuditLog.action)
        )
    ).all()
    return ok({
        "modules": [{"value": m, "count": c} for m, c in mods],
        "actions": [{"value": a.value, "count": c} for a, c in actions if a is not None],
    })
