"""User management endpoints (FR-DASH-006-01)."""
from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.audit import AuditAction
from ..domain.login_log import LoginLog
from ..domain.role import Role, UserRole
from ..domain.user import User, UserStatus
from ..services.deps import (
    AdminDep,
    SessionDep,
    write_audit,
)
from ..services.security import generate_random_password, hash_password, verify_password
from .response import ok, page

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/admin/users", tags=["admin-users"])


# ---- Schemas ----
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: str
    username: str
    real_name: str | None = None
    email: str | None = None
    phone: str | None = None
    avatar: str | None = None
    department: str | None = None
    position: str | None = None
    status: UserStatus
    is_super_admin: bool = False
    last_login_at: datetime | None = None
    last_login_ip: str | None = None
    created_at: datetime
    updated_at: datetime
    role_ids: list[int] = Field(default_factory=list)
    role_codes: list[str] = Field(default_factory=list)


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    real_name: str | None = Field(default=None, max_length=128)
    email: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    department: str | None = Field(default=None, max_length=128)
    position: str | None = Field(default=None, max_length=128)
    password: str | None = Field(default=None, min_length=8, max_length=128, description="缺省自动生成")
    status: UserStatus = UserStatus.ACTIVE
    is_super_admin: bool = False
    role_ids: list[int] = Field(default_factory=list)


class UserUpdate(BaseModel):
    real_name: str | None = Field(default=None, max_length=128)
    email: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    department: str | None = Field(default=None, max_length=128)
    position: str | None = Field(default=None, max_length=128)
    avatar: str | None = Field(default=None, max_length=512)
    status: UserStatus | None = None
    is_super_admin: bool | None = None
    role_ids: list[int] | None = None


class StatusUpdate(BaseModel):
    status: UserStatus


class ResetPasswordResult(BaseModel):
    temporary_password: str


class PasswordVerifyRequest(BaseModel):
    password: str


# ---- helpers ----
def _user_to_out(user: User, role_ids: list[int], role_codes: list[str]) -> UserOut:
    return UserOut(
        id=user.id or 0,
        tenant_id=user.tenant_id,
        username=user.username,
        real_name=user.real_name,
        email=user.email,
        phone=user.phone,
        avatar=user.avatar,
        department=user.department,
        position=user.position,
        status=user.status,
        is_super_admin=user.is_super_admin,
        last_login_at=user.last_login_at,
        last_login_ip=user.last_login_ip,
        created_at=user.created_at,
        updated_at=user.updated_at,
        role_ids=role_ids,
        role_codes=role_codes,
    )


async def _resolve_roles(
    session: AsyncSession, user_ids: list[int]
) -> dict[int, tuple[list[int], list[str]]]:
    if not user_ids:
        return {}
    stmt = (
        select(UserRole.user_id, Role.id, Role.code)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id.in_(user_ids))
    )
    rows = (await session.execute(stmt)).all()
    result: dict[int, list[int]] = {uid: [] for uid in user_ids}
    codes: dict[int, list[str]] = {uid: [] for uid in user_ids}
    for uid, role_id, role_code in rows:
        result[uid].append(role_id)
        codes[uid].append(role_code)
    return {uid: (result[uid], codes[uid]) for uid in user_ids}


async def _load_user(session: AsyncSession, user_id: int, tenant_id: str) -> User | None:
    stmt = select(User).where(and_(User.id == user_id, User.tenant_id == tenant_id))
    return (await session.execute(stmt)).scalar_one_or_none()


# ---- Endpoints ----
@router.get("")
async def list_users(
    caller: AdminDep,
    session: SessionDep,
    keyword: str | None = Query(default=None, description="按 username/real_name/email 模糊匹配"),
    status: UserStatus | None = Query(default=None),
    department: str | None = Query(default=None),
    role_id: int | None = Query(default=None),
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=20, ge=1, le=200, alias="pageSize"),
) -> dict[str, Any]:
    base = select(User).where(User.tenant_id == caller.tenant_id)
    if keyword:
        like = f"%{keyword}%"
        base = base.where(
            or_(
                User.username.like(like),
                User.real_name.like(like),
                User.email.like(like),
            )
        )
    if status is not None:
        base = base.where(User.status == status)
    if department:
        base = base.where(User.department == department)
    if role_id:
        base = base.where(
            User.id.in_(select(UserRole.user_id).where(UserRole.role_id == role_id))
        )

    total_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(total_stmt)).scalar_one()

    stmt = base.order_by(User.created_at.desc()).offset((page_num - 1) * page_size).limit(page_size)
    users = (await session.execute(stmt)).scalars().all()
    role_map = await _resolve_roles(session, [u.id for u in users if u.id is not None])

    items = [
        _user_to_out(u, *role_map.get(u.id, ([], []))).model_dump(mode="json")
        for u in users
    ]
    return page(items=items, total=total, page=page_num, page_size=page_size)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    payload: UserCreate,
) -> dict[str, Any]:
    existing = (
        await session.execute(
            select(User).where(
                and_(User.tenant_id == caller.tenant_id, User.username == payload.username)
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "E409_CONFLICT", "message": f"用户 '{payload.username}' 已存在"},
        )

    plain_pw = payload.password or generate_random_password()
    user = User(
        tenant_id=caller.tenant_id,
        username=payload.username,
        real_name=payload.real_name,
        email=payload.email,
        phone=payload.phone,
        department=payload.department,
        position=payload.position,
        status=payload.status,
        is_super_admin=payload.is_super_admin,
        password_hash=hash_password(plain_pw),
    )
    session.add(user)
    await session.flush()

    if payload.role_ids:
        for rid in payload.role_ids:
            session.add(UserRole(user_id=user.id, role_id=rid))

    await write_audit(
        session,
        caller,
        module="user",
        action=AuditAction.CREATE,
        resource_type="user",
        resource_id=str(user.id),
        resource_name=user.username,
        summary=f"创建用户 {user.username}",
        detail={"email": user.email, "department": user.department, "roles": payload.role_ids},
        request=request,
    )
    await session.commit()
    await session.refresh(user)

    role_map = await _resolve_roles(session, [user.id])
    out = _user_to_out(user, *role_map.get(user.id, ([], []))).model_dump(mode="json")
    out["initial_password"] = plain_pw
    return ok(out)


@router.post("/import")
async def import_users(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    file: UploadFile = File(..., description="CSV 文件 (username,real_name,email,phone,department,position,password,status)"),
) -> dict[str, Any]:
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    created, skipped, errors = 0, 0, []

    for idx, row in enumerate(reader, start=1):
        username = (row.get("username") or "").strip()
        if not username:
            errors.append({"row": idx, "error": "username 必填"})
            skipped += 1
            continue
        existing = (
            await session.execute(
                select(User).where(
                    and_(User.tenant_id == caller.tenant_id, User.username == username)
                )
            )
        ).scalar_one_or_none()
        if existing:
            skipped += 1
            errors.append({"row": idx, "error": f"用户名 '{username}' 已存在"})
            continue
        plain_pw = (row.get("password") or "").strip() or generate_random_password()
        try:
            user = User(
                tenant_id=caller.tenant_id,
                username=username,
                real_name=(row.get("real_name") or "").strip() or None,
                email=(row.get("email") or "").strip() or None,
                phone=(row.get("phone") or "").strip() or None,
                department=(row.get("department") or "").strip() or None,
                position=(row.get("position") or "").strip() or None,
                password_hash=hash_password(plain_pw),
                status=UserStatus.ACTIVE,
            )
            session.add(user)
            created += 1
        except Exception as exc:
            skipped += 1
            errors.append({"row": idx, "error": str(exc)})

    await write_audit(
        session,
        caller,
        module="user",
        action=AuditAction.IMPORT,
        resource_type="user",
        resource_id=None,
        resource_name=None,
        summary=f"批量导入用户 {created} 条",
        detail={"created": created, "skipped": skipped, "errors": errors[:20]},
        request=request,
    )
    await session.commit()
    return ok({"created": created, "skipped": skipped, "errors": errors})

@router.get("/export")
async def export_users(
    caller: AdminDep,
    session: SessionDep,
) -> StreamingResponse:
    rows = (
        await session.execute(
            select(User).where(User.tenant_id == caller.tenant_id).order_by(User.created_at.desc())
        )
    ).scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["username", "real_name", "email", "phone", "department", "position", "status", "created_at"])
    for u in rows:
        writer.writerow([
            u.username,
            u.real_name or "",
            u.email or "",
            u.phone or "",
            u.department or "",
            u.position or "",
            u.status.value if u.status else "",
            u.created_at.isoformat(),
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="users.csv"'},
    )

@router.get("/{user_id}")
async def get_user(
    caller: AdminDep,
    session: SessionDep,
    user_id: int,
) -> dict[str, Any]:
    user = await _load_user(session, user_id, caller.tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})
    role_map = await _resolve_roles(session, [user.id])
    return ok(_user_to_out(user, *role_map.get(user.id, ([], []))).model_dump(mode="json"))


@router.put("/{user_id}")
async def update_user(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    user_id: int,
    payload: UserUpdate,
) -> dict[str, Any]:
    user = await _load_user(session, user_id, caller.tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})

    before = {
        "real_name": user.real_name,
        "email": user.email,
        "phone": user.phone,
        "department": user.department,
        "position": user.position,
        "status": user.status.value if user.status else None,
        "is_super_admin": user.is_super_admin,
    }
    for field_name in ("real_name", "email", "phone", "department", "position", "avatar"):
        new_val = getattr(payload, field_name)
        if new_val is not None and getattr(user, field_name) != new_val:
            setattr(user, field_name, new_val)
    if payload.status is not None and user.status != payload.status:
        user.status = payload.status
    if payload.is_super_admin is not None and user.is_super_admin != payload.is_super_admin:
        if not caller.is_super_admin:
            raise HTTPException(
                status_code=403,
                detail={"code": "E403_FORBIDDEN", "message": "仅超级管理员可调整 is_super_admin"},
            )
        user.is_super_admin = payload.is_super_admin
    if payload.role_ids is not None:
        # 替换角色
        existing = (
            await session.execute(select(UserRole).where(UserRole.user_id == user.id))
        ).scalars().all()
        for ur in existing:
            await session.delete(ur)
        for rid in payload.role_ids:
            session.add(UserRole(user_id=user.id, role_id=rid))

    user.updated_at = datetime.now(UTC)
    after = {
        "real_name": user.real_name,
        "email": user.email,
        "phone": user.phone,
        "department": user.department,
        "position": user.position,
        "status": user.status.value if user.status else None,
        "is_super_admin": user.is_super_admin,
    }
    await write_audit(
        session,
        caller,
        module="user",
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=str(user.id),
        resource_name=user.username,
        summary=f"更新用户 {user.username}",
        detail={"before": before, "after": after, "role_ids": payload.role_ids},
        request=request,
    )
    await session.commit()
    await session.refresh(user)
    role_map = await _resolve_roles(session, [user.id])
    return ok(_user_to_out(user, *role_map.get(user.id, ([], []))).model_dump(mode="json"))


@router.delete("/{user_id}")
async def delete_user(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    user_id: int,
) -> dict[str, Any]:
    user = await _load_user(session, user_id, caller.tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})
    if user.is_super_admin and not caller.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail={"code": "E403_FORBIDDEN", "message": "仅超级管理员可删除超级管理员"},
        )
    username = user.username
    # 删除关联角色绑定
    rels = (
        await session.execute(select(UserRole).where(UserRole.user_id == user.id))
    ).scalars().all()
    for rel in rels:
        await session.delete(rel)
    await session.delete(user)
    await write_audit(
        session,
        caller,
        module="user",
        action=AuditAction.DELETE,
        resource_type="user",
        resource_id=str(user_id),
        resource_name=username,
        summary=f"删除用户 {username}",
        request=request,
    )
    await session.commit()
    return ok({"deleted": user_id})


@router.post("/{user_id}/reset-password")
async def reset_password(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    user_id: int,
) -> dict[str, Any]:
    user = await _load_user(session, user_id, caller.tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})
    new_pw = generate_random_password()
    user.password_hash = hash_password(new_pw)
    user.updated_at = datetime.now(UTC)
    await write_audit(
        session,
        caller,
        module="user",
        action=AuditAction.RESET_PASSWORD,
        resource_type="user",
        resource_id=str(user.id),
        resource_name=user.username,
        summary=f"重置用户 {user.username} 密码",
        request=request,
    )
    await session.commit()
    return ok({"user_id": user.id, "username": user.username, "temporary_password": new_pw})


@router.post("/{user_id}/status")
async def set_status(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    user_id: int,
    payload: StatusUpdate,
) -> dict[str, Any]:
    user = await _load_user(session, user_id, caller.tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})
    if user.is_super_admin and payload.status != UserStatus.ACTIVE and not caller.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail={"code": "E403_FORBIDDEN", "message": "仅超级管理员可停用超级管理员"},
        )
    user.status = payload.status
    user.updated_at = datetime.now(UTC)
    await write_audit(
        session,
        caller,
        module="user",
        action=AuditAction.ENABLE if payload.status == UserStatus.ACTIVE else AuditAction.DISABLE,
        resource_type="user",
        resource_id=str(user.id),
        resource_name=user.username,
        summary=f"{'启用' if payload.status == UserStatus.ACTIVE else '停用'}用户 {user.username}",
        request=request,
    )
    await session.commit()
    return ok({"user_id": user.id, "status": user.status})


@router.post("/{user_id}/verify-password")
async def verify_user_password(
    caller: AdminDep,
    session: SessionDep,
    user_id: int,
    payload: PasswordVerifyRequest,
) -> dict[str, Any]:
    user = await _load_user(session, user_id, caller.tenant_id)
    if not user or not user.password_hash:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在或未设置密码"})
    return ok({"matched": verify_password(payload.password, user.password_hash)})

@router.get("/{user_id}/login-logs")
async def list_user_login_logs(
    caller: AdminDep,
    session: SessionDep,
    user_id: int,
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=20, ge=1, le=200, alias="pageSize"),
) -> dict[str, Any]:
    """最近登录日志 (FR-DASH-006-01)."""
    user = await _load_user(session, user_id, caller.tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})

    base = select(LoginLog).where(
        and_(LoginLog.tenant_id == caller.tenant_id, LoginLog.username == user.username)
    )
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt = base.order_by(LoginLog.occurred_at.desc()).offset((page_num - 1) * page_size).limit(page_size)
    items = [
        {
            "id": log.id,
            "username": log.username,
            "result": log.result.value if log.result else None,
            "ip": log.ip,
            "userAgent": log.user_agent,
            "device": log.device,
            "location": log.location,
            "failureReason": log.failure_reason,
            "occurredAt": log.occurred_at.isoformat(),
        }
        for log in (await session.execute(stmt)).scalars().all()
    ]
    return page(items=items, total=total, page=page_num, page_size=page_size)
