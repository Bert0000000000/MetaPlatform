"""Permission management endpoints (FR-DASH-006-02)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.audit import AuditAction
from ..domain.permission import Permission, RolePermission
from ..domain.role import Role, UserRole
from ..domain.user import User
from ..services.deps import AdminDep, SessionDep, write_audit
from .response import ok, page

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/admin/permissions", tags=["admin-permissions"])


# ---- Schemas ----
class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: str
    code: str
    name: str
    description: str | None = None
    data_scope: str
    # The portal AdminOperationsPage logic keys off role_type to bucket
    # roles into SYSTEM / BUILTIN / CUSTOM groups. PLATFORM_* codes are
    # SYSTEM, is_builtin roles (the three built-in role templates) are
    # BUILTIN, everything else is CUSTOM.
    role_type: str = "CUSTOM"
    is_system: bool = False
    is_builtin: bool = False
    # Roles are not soft-disabled in the current model, but expose an
    # explicit flag so the frontend can drop or grey out rows when added.
    enabled: bool = True
    created_at: datetime
    updated_at: datetime
    permission_count: int = 0
    user_count: int = 0

    @model_validator(mode="after")
    def _derive_role_type(self) -> RoleOut:
        # PLATFORM_* codes are SYSTEM; is_builtin (without PLATFORM_ prefix)
        # is BUILTIN; everything else is CUSTOM.
        if self.code and self.code.startswith("PLATFORM_"):
            object.__setattr__(self, "role_type", "SYSTEM")
            object.__setattr__(self, "is_system", True)
        elif self.is_builtin:
            object.__setattr__(self, "role_type", "BUILTIN")
        return self


class RoleCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    data_scope: str = Field(default="SELF", pattern="^(ALL|DEPT|DEPT_AND_SUB|SELF|CUSTOM)$")
    permission_ids: list[int] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    # description stores either the free-form role description OR a policy
    # JSON blob prefixed with __METAPLATFORM_POLICY__: (a hand-rolled
    # workaround until the backend schema gains a real `policy` column).
    # 8192 is enough for ~50 menu perms + ~30 API perms + masking list.
    description: str | None = Field(default=None, max_length=8192)
    data_scope: str | None = Field(default=None, pattern="^(ALL|DEPT|DEPT_AND_SUB|SELF|CUSTOM)$")
    permission_ids: list[int] | None = None


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    resource_type: str
    actions: list[str]
    description: str | None = None


class AssignPayload(BaseModel):
    type: str = Field(description="user | role")
    target_id: int
    permission_ids: list[int] = Field(default_factory=list)
    role_ids: list[int] | None = Field(default=None, description="type=user 时：分配的角色")


class RoleWithPermissions(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    data_scope: str
    is_builtin: bool
    permissions: list[PermissionOut]


class UserWithRolesAndPermissions(BaseModel):
    user_id: int
    username: str
    real_name: str | None = None
    roles: list[RoleOut]
    permissions: list[PermissionOut]


# ---- helpers ----
def _permission_to_out(p: Permission) -> PermissionOut:
    return PermissionOut(
        id=p.id or 0,
        code=p.code,
        name=p.name,
        resource_type=p.resource_type,
        actions=[a for a in (p.actions or "").split(",") if a],
        description=p.description,
    )


async def _load_role(session: AsyncSession, role_id: int, tenant_id: str) -> Role | None:
    return (
        await session.execute(
            select(Role).where(and_(Role.id == role_id, Role.tenant_id == tenant_id))
        )
    ).scalar_one_or_none()


async def _role_stats(session: AsyncSession, role_ids: list[int]) -> dict[int, tuple[int, int]]:
    if not role_ids:
        return {}
    perm_counts = dict(
        (await session.execute(
            select(RolePermission.role_id, func.count(RolePermission.id))
            .where(RolePermission.role_id.in_(role_ids))
            .group_by(RolePermission.role_id)
        )).all()
    )
    user_counts = dict(
        (await session.execute(
            select(UserRole.role_id, func.count(UserRole.id))
            .where(UserRole.role_id.in_(role_ids))
            .group_by(UserRole.role_id)
        )).all()
    )
    return {rid: (perm_counts.get(rid, 0), user_counts.get(rid, 0)) for rid in role_ids}


# ---- Roles ----
@router.get("/roles")
async def list_roles(
    caller: AdminDep,
    session: SessionDep,
    keyword: str | None = Query(default=None),
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=20, ge=1, le=200, alias="pageSize"),
) -> dict[str, Any]:
    base = select(Role).where(Role.tenant_id == caller.tenant_id)
    if keyword:
        like = f"%{keyword}%"
        base = base.where(or_(Role.code.like(like), Role.name.like(like)))

    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt = base.order_by(Role.created_at.asc()).offset((page_num - 1) * page_size).limit(page_size)
    roles = (await session.execute(stmt)).scalars().all()
    stats = await _role_stats(session, [r.id for r in roles if r.id is not None])
    items = []
    for r in roles:
        pc, uc = stats.get(r.id, (0, 0))
        items.append(
            RoleOut(
                id=r.id or 0,
                tenant_id=r.tenant_id,
                code=r.code,
                name=r.name,
                description=r.description,
                data_scope=r.data_scope,
                is_builtin=r.is_builtin,
                created_at=r.created_at,
                updated_at=r.updated_at,
                permission_count=pc,
                user_count=uc,
            ).model_dump(mode="json")
        )
    return page(items=items, total=total, page=page_num, page_size=page_size)


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    payload: RoleCreate,
) -> dict[str, Any]:
    if not caller.is_super_admin and payload.code in {"PLATFORM_SUPER_ADMIN", "PLATFORM_ADMIN"}:
        raise HTTPException(
            status_code=403,
            detail={"code": "E403_FORBIDDEN", "message": "仅超级管理员可创建内置角色编码"},
        )
    existing = (
        await session.execute(
            select(Role).where(and_(Role.tenant_id == caller.tenant_id, Role.code == payload.code))
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "E409_CONFLICT", "message": f"角色编码 '{payload.code}' 已存在"},
        )

    role = Role(
        tenant_id=caller.tenant_id,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        data_scope=payload.data_scope,
        is_builtin=payload.code.startswith("PLATFORM_"),
    )
    session.add(role)
    await session.flush()

    for pid in payload.permission_ids:
        session.add(RolePermission(role_id=role.id, permission_id=pid, effect="ALLOW"))

    await write_audit(
        session,
        caller,
        module="role",
        action=AuditAction.CREATE,
        resource_type="role",
        resource_id=str(role.id),
        resource_name=role.name,
        summary=f"创建角色 {role.name}",
        detail={"code": role.code, "permission_ids": payload.permission_ids},
        request=request,
    )
    await session.commit()
    await session.refresh(role)

    return ok(
        RoleOut(
            id=role.id or 0,
            tenant_id=role.tenant_id,
            code=role.code,
            name=role.name,
            description=role.description,
            data_scope=role.data_scope,
            is_builtin=role.is_builtin,
            created_at=role.created_at,
            updated_at=role.updated_at,
            permission_count=len(payload.permission_ids),
            user_count=0,
        ).model_dump(mode="json")
    )


@router.put("/roles/{role_id}")
async def update_role(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    role_id: int,
    payload: RoleUpdate,
) -> dict[str, Any]:
    role = await _load_role(session, role_id, caller.tenant_id)
    if not role:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "角色不存在"})
    if role.is_builtin and not caller.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail={"code": "E403_FORBIDDEN", "message": "仅超级管理员可修改内置角色"},
        )
    before = {"name": role.name, "data_scope": role.data_scope, "description": role.description}
    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    if payload.data_scope is not None:
        role.data_scope = payload.data_scope
    role.updated_at = datetime.now(UTC)

    if payload.permission_ids is not None:
        existing = (
            await session.execute(select(RolePermission).where(RolePermission.role_id == role.id))
        ).scalars().all()
        for rp in existing:
            await session.delete(rp)
        for pid in payload.permission_ids:
            session.add(RolePermission(role_id=role.id, permission_id=pid, effect="ALLOW"))

    await write_audit(
        session,
        caller,
        module="role",
        action=AuditAction.UPDATE,
        resource_type="role",
        resource_id=str(role.id),
        resource_name=role.name,
        summary=f"更新角色 {role.name}",
        detail={
            "before": before,
            "after": {"name": role.name, "data_scope": role.data_scope, "description": role.description},
            "permission_ids": payload.permission_ids,
        },
        request=request,
    )
    await session.commit()
    return ok({"id": role.id, "name": role.name})


@router.delete("/roles/{role_id}")
async def delete_role(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    role_id: int,
) -> dict[str, Any]:
    role = await _load_role(session, role_id, caller.tenant_id)
    if not role:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "角色不存在"})
    if role.is_builtin:
        raise HTTPException(
            status_code=403,
            detail={"code": "E403_FORBIDDEN", "message": "内置角色不可删除"},
        )

    rels = (await session.execute(select(UserRole).where(UserRole.role_id == role.id))).scalars().all()
    for r in rels:
        await session.delete(r)
    perms = (await session.execute(select(RolePermission).where(RolePermission.role_id == role.id))).scalars().all()
    for r in perms:
        await session.delete(r)
    name = role.name
    await session.delete(role)

    await write_audit(
        session,
        caller,
        module="role",
        action=AuditAction.DELETE,
        resource_type="role",
        resource_id=str(role_id),
        resource_name=name,
        summary=f"删除角色 {name}",
        request=request,
    )
    await session.commit()
    return ok({"deleted": role_id})


@router.get("/roles/{role_id}")
async def get_role_detail(
    caller: AdminDep,
    session: SessionDep,
    role_id: int,
) -> dict[str, Any]:
    role = await _load_role(session, role_id, caller.tenant_id)
    if not role:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "角色不存在"})

    perm_ids = (
        await session.execute(select(RolePermission.permission_id).where(RolePermission.role_id == role.id))
    ).scalars().all()
    perms = []
    if perm_ids:
        rows = (
            await session.execute(select(Permission).where(Permission.id.in_(perm_ids)))
        ).scalars().all()
        perms = [_permission_to_out(p).model_dump(mode="json") for p in rows]

    return ok(
        RoleWithPermissions(
            id=role.id or 0,
            code=role.code,
            name=role.name,
            description=role.description,
            data_scope=role.data_scope,
            is_builtin=role.is_builtin,
            permissions=[PermissionOut(**p) for p in perms],
        ).model_dump(mode="json")
    )


# ---- Permission Catalog ----
class PermissionPayload(BaseModel):
    code: str = Field(min_length=2, max_length=128)
    name: str = Field(min_length=1, max_length=128)
    resource_type: str = Field(min_length=1, max_length=64)
    actions: str = Field(default="", max_length=512)
    description: str | None = Field(default=None, max_length=512)


@router.get("/catalog")
async def list_catalog(
    caller: AdminDep,
    session: SessionDep,
    resource_type: str | None = Query(default=None),
) -> dict[str, Any]:
    base = select(Permission).where(Permission.tenant_id == caller.tenant_id)
    if resource_type:
        base = base.where(Permission.resource_type == resource_type)
    perms = (await session.execute(base.order_by(Permission.resource_type, Permission.code))).scalars().all()
    items = [_permission_to_out(p).model_dump(mode="json") for p in perms]
    return ok(items)


@router.post("/catalog", status_code=status.HTTP_201_CREATED)
async def create_catalog(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    payload: PermissionPayload,
) -> dict[str, Any]:
    code = payload.code.strip()
    resource_type = payload.resource_type.strip()
    if not code or not resource_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "E400_BAD_REQUEST", "message": "code 和 resource_type 不能为空"},
        )
    existing = (
        await session.execute(
            select(Permission).where(
                and_(Permission.tenant_id == caller.tenant_id, Permission.code == code)
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "E409_CONFLICT", "message": f"权限编码 {code} 已存在"},
        )
    perm = Permission(
        tenant_id=caller.tenant_id,
        code=code,
        name=payload.name.strip(),
        resource_type=resource_type,
        actions=payload.actions or "",
        description=payload.description,
    )
    session.add(perm)
    await session.flush()
    await write_audit(
        session,
        caller,
        module="permission",
        action=AuditAction.CREATE,
        resource_type="permission",
        resource_id=str(perm.id),
        resource_name=perm.code,
    )
    await session.commit()
    return ok(_permission_to_out(perm).model_dump(mode="json"))


@router.put("/catalog/{perm_id}")
async def update_catalog(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    perm_id: int,
    payload: PermissionPayload,
) -> dict[str, Any]:
    perm = (
        await session.execute(
            select(Permission).where(
                and_(Permission.id == perm_id, Permission.tenant_id == caller.tenant_id)
            )
        )
    ).scalar_one_or_none()
    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "E404_NOT_FOUND", "message": "权限不存在"},
        )
    resource_type = payload.resource_type.strip()
    if not resource_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "E400_BAD_REQUEST", "message": "resource_type 不能为空"},
        )
    perm.name = payload.name.strip()
    perm.resource_type = resource_type
    perm.actions = payload.actions or ""
    perm.description = payload.description
    await session.flush()
    await write_audit(
        session,
        caller,
        module="permission",
        action=AuditAction.UPDATE,
        resource_type="permission",
        resource_id=str(perm.id),
        resource_name=perm.code,
    )
    await session.commit()
    return ok(_permission_to_out(perm).model_dump(mode="json"))


@router.delete("/catalog/{perm_id}")
async def delete_catalog(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    perm_id: int,
) -> dict[str, Any]:
    perm = (
        await session.execute(
            select(Permission).where(
                and_(Permission.id == perm_id, Permission.tenant_id == caller.tenant_id)
            )
        )
    ).scalar_one_or_none()
    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "E404_NOT_FOUND", "message": "权限不存在"},
        )
    # Prevent deletion if any role still references this permission
    refs = (
        await session.execute(
            select(func.count()).select_from(RolePermission).where(RolePermission.permission_id == perm.id)
        )
    ).scalar_one()
    if refs and refs > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "E409_CONFLICT",
                "message": f"权限已被 {refs} 个角色引用，请先解除关联",
            },
        )
    code = perm.code
    await session.delete(perm)
    await session.flush()
    await write_audit(
        session,
        caller,
        module="permission",
        action=AuditAction.DELETE,
        resource_type="permission",
        resource_id=str(perm_id),
        resource_name=code,
    )
    await session.commit()
    return ok({"deleted": perm_id})


# ---- Permission Assignment ----
@router.post("/assign")
async def assign(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    payload: AssignPayload,
) -> dict[str, Any]:
    if payload.type == "user":
        user = (
            await session.execute(
                select(User).where(and_(User.id == payload.target_id, User.tenant_id == caller.tenant_id))
            )
        ).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})

        if payload.role_ids is not None:
            existing = (
                await session.execute(select(UserRole).where(UserRole.user_id == user.id))
            ).scalars().all()
            for ur in existing:
                await session.delete(ur)
            for rid in payload.role_ids:
                session.add(UserRole(user_id=user.id, role_id=rid))
        if payload.permission_ids:
            # 直接给用户的权限：没有现成的 user_permission 表，借助 role_id 自建空角色 or 直接拒绝
            # 为简化：忽略直赋权限，要求通过 role_ids 绑定
            pass

        await write_audit(
            session,
            caller,
            module="role",
            action=AuditAction.ASSIGN,
            resource_type="user",
            resource_id=str(user.id),
            resource_name=user.username,
            summary=f"分配角色给用户 {user.username}",
            detail={"role_ids": payload.role_ids},
            request=request,
        )
    elif payload.type == "role":
        role = await _load_role(session, payload.target_id, caller.tenant_id)
        if not role:
            raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "角色不存在"})
        existing = (
            await session.execute(select(RolePermission).where(RolePermission.role_id == role.id))
        ).scalars().all()
        for rp in existing:
            await session.delete(rp)
        for pid in payload.permission_ids:
            session.add(RolePermission(role_id=role.id, permission_id=pid, effect="ALLOW"))
        await write_audit(
            session,
            caller,
            module="role",
            action=AuditAction.ASSIGN,
            resource_type="role",
            resource_id=str(role.id),
            resource_name=role.name,
            summary=f"分配权限给角色 {role.name}",
            detail={"permission_ids": payload.permission_ids},
            request=request,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail={"code": "E400_VALIDATION", "message": f"不支持的 type: {payload.type}"},
        )

    await session.commit()
    return ok({"type": payload.type, "target_id": payload.target_id})


# ---- Matrix (for permission matrix UI) ----
@router.get("/matrix")
async def permission_matrix(
    caller: AdminDep,
    session: SessionDep,
) -> dict[str, Any]:
    """Returns roles × resources snapshot for the permission matrix UI."""
    roles = (
        await session.execute(
            select(Role).where(Role.tenant_id == caller.tenant_id).order_by(Role.code)
        )
    ).scalars().all()
    perms = (
        await session.execute(
            select(Permission).where(Permission.tenant_id == caller.tenant_id).order_by(Permission.code)
        )
    ).scalars().all()

    rp_rows = (
        await session.execute(select(RolePermission.role_id, RolePermission.permission_id))
    ).all()
    {(r, p) for r, p in rp_rows}

    return ok({
        "roles": [
            {"id": r.id, "code": r.code, "name": r.name, "is_builtin": r.is_builtin}
            for r in roles
        ],
        "resources": sorted({p.resource_type for p in perms}),
        "permissions": [_permission_to_out(p).model_dump(mode="json") for p in perms],
        "matrix": [{"role_id": r, "permission_id": p, "granted": True} for r, p in rp_rows],
    })
