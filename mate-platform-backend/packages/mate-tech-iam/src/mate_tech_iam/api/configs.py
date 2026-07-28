"""System configuration endpoints (FR-DASH-006-05)."""
from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.audit import AuditAction
from ..domain.system_config import ConfigCategory, SystemConfig
from ..services.deps import AdminDep, SessionDep, write_audit
from .response import ok, page

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/admin/configs", tags=["admin-configs"])


# ---- Schemas ----
class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    value: Any
    raw_value: str | None = None
    value_type: str
    category: ConfigCategory
    label: str | None
    description: str | None
    enum_options: list[str] = Field(default_factory=list)
    is_sensitive: bool
    updated_by: str | None
    created_at: datetime
    updated_at: datetime


class ConfigUpdate(BaseModel):
    value: Any
    note: str | None = Field(default=None, max_length=512, description="变更原因")


# ---- helpers ----
SAFE_KEY_RE = re.compile(r"^[a-zA-Z0-9_.\-:]{1,128}$")


def _decode(value: str | None, value_type: str) -> Any:
    if value is None:
        return None
    if value_type == "string":
        return value
    if value_type == "int":
        try:
            return int(value)
        except Exception:
            return value
    if value_type == "bool":
        return value.strip().lower() in ("1", "true", "yes", "on")
    if value_type == "json":
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


def _encode(raw: Any, value_type: str) -> str:
    if raw is None:
        return ""
    if value_type == "json":
        return json.dumps(raw, ensure_ascii=False, default=str)
    if value_type == "bool":
        return "true" if bool(raw) else "false"
    return str(raw)


def _config_to_out(cfg: SystemConfig) -> ConfigOut:
    return ConfigOut(
        id=cfg.id or 0,
        key=cfg.key,
        value=_decode(cfg.value, cfg.value_type),
        raw_value="***" if cfg.is_sensitive else cfg.value,
        value_type=cfg.value_type,
        category=cfg.category,
        label=cfg.label,
        description=cfg.description,
        enum_options=[x for x in (cfg.enum_options or "").split(",") if x] if cfg.enum_options else [],
        is_sensitive=cfg.is_sensitive,
        updated_by=cfg.updated_by,
        created_at=cfg.created_at,
        updated_at=cfg.updated_at,
    )


async def _load_cfg(session: AsyncSession, key: str, tenant_id: str) -> SystemConfig | None:
    return (
        await session.execute(
            select(SystemConfig).where(
                and_(SystemConfig.key == key, SystemConfig.tenant_id == tenant_id)
            )
        )
    ).scalar_one_or_none()


def _validate_value(value: Any, value_type: str, enum_options: str | None) -> None:
    if value_type == "enum":
        options = [x for x in (enum_options or "").split(",") if x]
        if options and str(value) not in options:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "E400_VALIDATION",
                    "message": f"value 必须是 {options} 之一",
                },
            )


# ---- Endpoints ----
@router.get("")
async def list_configs(
    caller: AdminDep,
    session: SessionDep,
    category: ConfigCategory | None = Query(default=None),
    keyword: str | None = Query(default=None),
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=50, ge=1, le=200, alias="pageSize"),
) -> dict[str, Any]:
    base = select(SystemConfig).where(SystemConfig.tenant_id == caller.tenant_id)
    if category:
        base = base.where(SystemConfig.category == category)
    if keyword:
        like = f"%{keyword}%"
        base = base.where(SystemConfig.key.like(like))

    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt = base.order_by(SystemConfig.category, SystemConfig.key).offset((page_num - 1) * page_size).limit(page_size)
    rows = (await session.execute(stmt)).scalars().all()
    items = [_config_to_out(c).model_dump(mode="json") for c in rows]
    return page(items=items, total=total, page=page_num, page_size=page_size)


@router.get("/categories")
async def list_categories(
    caller: AdminDep,
    session: SessionDep,
) -> dict[str, Any]:
    rows = (
        await session.execute(
            select(SystemConfig.category, func.count(SystemConfig.id))
            .where(SystemConfig.tenant_id == caller.tenant_id)
            .group_by(SystemConfig.category)
        )
    ).all()
    return ok([{"value": cat.value, "count": cnt} for cat, cnt in rows])


@router.put("/{key:path}", status_code=status.HTTP_200_OK)
async def update_config(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    key: str,
    payload: ConfigUpdate,
) -> dict[str, Any]:
    if not SAFE_KEY_RE.match(key):
        raise HTTPException(status_code=400, detail={"code": "E400_VALIDATION", "message": "key 不合法"})
    cfg = await _load_cfg(session, key, caller.tenant_id)
    if not cfg:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "配置项不存在"})

    _validate_value(payload.value, cfg.value_type, cfg.enum_options)
    before_raw = cfg.value
    cfg.value = _encode(payload.value, cfg.value_type)
    cfg.updated_by = caller.username
    cfg.updated_at = datetime.now(UTC)

    await write_audit(
        session,
        caller,
        module="config",
        action=AuditAction.CONFIG_CHANGE,
        resource_type="config",
        resource_id=cfg.key,
        resource_name=cfg.label or cfg.key,
        summary=f"修改配置 {cfg.key}",
        detail={"before": before_raw, "after": cfg.value, "note": payload.note},
        request=request,
    )
    await session.commit()
    await session.refresh(cfg)
    return ok(_config_to_out(cfg).model_dump(mode="json"))
