"""GET /marketplace/installed — 平台/租户级安装清单。

scope 决定可见范围:
  - platform.marketplace.read:全平台
  - platform.marketplace.read.tenant:当前租户
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from ..domain.install import Install

router = APIRouter(tags=["marketplace"])


@router.get("/installed")
async def list_installed(
    request: Request,
    kind: str | None = Query(None, pattern="^(mcp|agent|ontology|skill)$"),
    state: str | None = Query(
        None,
        pattern="^(downloading|verifying|installed|failed|uninstalled)$",
    ),
):
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="missing user context")

    # scope 决定过滤
    is_platform_admin = "platform.marketplace.read" in user.scopes
    is_tenant = "platform.marketplace.read.tenant" in user.scopes

    if not (is_platform_admin or is_tenant):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "MP_INSUFFICIENT_SCOPE",
                "message": (
                    "需要 platform.marketplace.read 或 "
                    "platform.marketplace.read.tenant scope"
                ),
            },
        )

    session = request.state.db
    stmt = select(Install)
    if kind is not None:
        stmt = stmt.where(Install.kind == kind)
    if state is not None:
        stmt = stmt.where(Install.state == state)
    if not is_platform_admin:
        # 租户过滤
        stmt = stmt.where(Install.tenant_id == user.tenant_id)

    rows = session.scalars(stmt).all()
    return {
        "items": [
            {
                "id": str(r.id),
                "kind": r.kind,
                "artifact_id": str(r.artifact_id),
                "version": r.version,
                "state": r.state,
                "installed_at": (
                    r.installed_at.isoformat() if r.installed_at else None
                ),
            }
            for r in rows
        ]
    }