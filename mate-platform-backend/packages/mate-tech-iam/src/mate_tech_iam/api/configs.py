"""System configuration endpoints (FR-DASH-006-05)."""

from __future__ import annotations

import hmac
import json
import os
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


# 敏感配置的掩码值。列表/读取接口对 is_sensitive 项返回该掩码；
# 更新接口收到掩码（或空串）视为"保持原值"，实现 write-only 语义。
SENSITIVE_MASK = "***"


def _mask_sensitive_value(cfg: SystemConfig, *, reveal: bool) -> Any:
    """敏感配置在非 reveal 模式下以掩码返回（含 value 与 raw_value）。

    reveal 仅对后端服务身份开放（服务需要真实 key 做 LLM 调用），
    人工管理员（浏览器会话）永远只能看到掩码。
    """
    if cfg.is_sensitive and not reveal:
        return SENSITIVE_MASK
    return _decode(cfg.value, cfg.value_type)


class ConfigCreateItem(BaseModel):
    key: str = Field(..., max_length=128, description="配置键")
    value: str = Field(default="", description="配置值")
    value_type: str = Field(default="string", description="string/int/bool/json")
    category: str = Field(default="AI_PROVIDER", description="配置分类")
    label: str | None = Field(default=None, max_length=256)
    is_sensitive: bool = Field(default=False)


class ConfigBatchCreate(BaseModel):
    items: list[ConfigCreateItem]


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


def _config_to_out(cfg: SystemConfig, *, reveal: bool = False) -> ConfigOut:
    return ConfigOut(
        id=cfg.id or 0,
        key=cfg.key,
        value=_mask_sensitive_value(cfg, reveal=reveal),
        raw_value=SENSITIVE_MASK if cfg.is_sensitive else cfg.value,
        value_type=cfg.value_type,
        category=cfg.category,
        label=cfg.label,
        description=cfg.description,
        enum_options=[x for x in (cfg.enum_options or "").split(",") if x]
        if cfg.enum_options
        else [],
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
def _reveal_allowed(request: Request) -> bool:
    """reveal 判定：仅后端服务身份可读敏感配置真实值。

    本部署的用户 token 与服务 token 共享同一 client_id（auth.login 与
    ServiceIdentity 的 azp 都是 SERVICE_CLIENT_ID），client_id 无法区分；
    改用服务共享密钥：请求需携带 X-Service-Secret == SERVICE_CLIENT_SECRET。
    浏览器会话拿不到该密钥 → 永远掩码。密钥未配置时 fail-closed。
    """
    expected = os.getenv("SERVICE_CLIENT_SECRET", "")
    if not expected:
        return False
    provided = request.headers.get("x-service-secret", "")
    return hmac.compare_digest(provided, expected)


@router.get("")
async def list_configs(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    category: ConfigCategory | None = Query(default=None),
    keyword: str | None = Query(default=None),
    reveal: bool = Query(default=False, description="服务身份专用：返回敏感配置真实值"),
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=50, ge=1, le=200, alias="pageSize"),
) -> dict[str, Any]:
    if reveal and not _reveal_allowed(request):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "E403_FORBIDDEN",
                "message": "敏感配置真实值仅限后端服务身份读取（reveal=1）",
            },
        )
    base = select(SystemConfig).where(SystemConfig.tenant_id == caller.tenant_id)
    if category:
        base = base.where(SystemConfig.category == category)
    if keyword:
        like = f"%{keyword}%"
        base = base.where(SystemConfig.key.like(like))

    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt = (
        base.order_by(SystemConfig.category, SystemConfig.key)
        .offset((page_num - 1) * page_size)
        .limit(page_size)
    )
    rows = (await session.execute(stmt)).scalars().all()
    items = [
        _config_to_out(c, reveal=reveal).model_dump(mode="json") for c in rows
    ]
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


# 机器间配置读取仅开放的命名空间前缀（AI Provider 托管配置）。
_SERVICE_READ_PREFIX = "ai.provider."


@router.get("/service-read")
async def service_read_configs(
    request: Request,
    session: SessionDep,
    tenant: str = Query(default="tenant-default", description="租户 ID"),
    prefix: str = Query(default=_SERVICE_READ_PREFIX, description=f"必须以 {_SERVICE_READ_PREFIX} 开头"),
) -> dict[str, Any]:
    """机器间配置读取（ARK key 正式托管的取数通道）。

    背景：Keycloak 服务 client（client_credentials）不带 PLATFORM_ADMIN
    realm role，服务 token 过不了 require_admin；而用户 token 回落路径
    在掩码化后拿不到真实 key。本端点以服务共享密钥
    （X-Service-Secret == SERVICE_CLIENT_SECRET，constant-time 比对）
    守门，仅返回 ``ai.provider.*`` 命名空间的真实键值，供 llmgw /
    copilot 等后端服务解析托管 key。浏览器会话拿不到该密钥。
    密钥未配置时 fail-closed（403）。
    """
    if not _reveal_allowed(request):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "E403_FORBIDDEN",
                "message": "service-read 仅限后端服务（X-Service-Secret 校验失败）",
            },
        )
    if not prefix.startswith(_SERVICE_READ_PREFIX):
        prefix = _SERVICE_READ_PREFIX
    rows = (
        await session.execute(
            select(SystemConfig).where(
                SystemConfig.tenant_id == tenant,
                SystemConfig.key.like(f"{prefix}%"),
            )
        )
    ).scalars().all()
    return ok({r.key: r.value for r in rows})


@router.put("/{key:path}", status_code=status.HTTP_200_OK)
async def update_config(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    key: str,
    payload: ConfigUpdate,
) -> dict[str, Any]:
    if not SAFE_KEY_RE.match(key):
        raise HTTPException(
            status_code=400, detail={"code": "E400_VALIDATION", "message": "key 不合法"}
        )
    cfg = await _load_cfg(session, key, caller.tenant_id)
    if not cfg:
        raise HTTPException(
            status_code=404, detail={"code": "E404_NOT_FOUND", "message": "配置项不存在"}
        )

    _validate_value(payload.value, cfg.value_type, cfg.enum_options)
    # write-only 语义：敏感配置收到掩码/空串 = 保持原值（管理员未改动 key 字段）。
    # 副作用：无法通过本接口把敏感值清成空串——需在 DB 侧操作（可接受的取舍）。
    incoming = payload.value if isinstance(payload.value, str) else ""
    if cfg.is_sensitive and incoming.strip() in ("", SENSITIVE_MASK):
        await write_audit(
            session,
            caller,
            module="config",
            action=AuditAction.CONFIG_CHANGE,
            resource_type="config",
            resource_id=cfg.key,
            resource_name=cfg.label or cfg.key,
            summary=f"更新配置 {cfg.key}（敏感值保持不变）",
            detail={"before": SENSITIVE_MASK, "after": SENSITIVE_MASK, "note": payload.note},
            request=request,
        )
        await session.commit()
        await session.refresh(cfg)
        return ok(_config_to_out(cfg).model_dump(mode="json"))
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
        # 敏感值不进审计明细（前后都以掩码记录）
        detail={
            "before": SENSITIVE_MASK if cfg.is_sensitive else before_raw,
            "after": SENSITIVE_MASK if cfg.is_sensitive else cfg.value,
            "note": payload.note,
        },
        request=request,
    )
    await session.commit()
    await session.refresh(cfg)
    return ok(_config_to_out(cfg).model_dump(mode="json"))


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def batch_create_configs(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    body: ConfigBatchCreate,
) -> dict[str, Any]:
    """批量创建配置项（添加自定义 AI Provider 时用）。已存在的 key 跳过。"""
    created: list[dict[str, Any]] = []
    for item in body.items:
        if not SAFE_KEY_RE.match(item.key):
            continue
        existing = await _load_cfg(session, item.key, caller.tenant_id)
        if existing:
            continue
        try:
            cat = ConfigCategory(item.category)
        except ValueError:
            cat = ConfigCategory.AI_PROVIDER
        cfg = SystemConfig(
            tenant_id=caller.tenant_id,
            key=item.key,
            value=item.value,
            value_type=item.value_type,
            category=cat,
            label=item.label,
            is_sensitive=item.is_sensitive,
        )
        session.add(cfg)
        created.append({"key": item.key, "label": item.label})
    await session.commit()
    return ok({"created": created, "count": len(created)})
