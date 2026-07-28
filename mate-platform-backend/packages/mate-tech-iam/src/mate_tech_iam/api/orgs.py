"""Organization management endpoints (FR-DASH-006-03)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.audit import AuditAction
from ..domain.org import EmployeePosition, Org, OrgType, Position
from ..domain.user import User
from ..services.deps import AdminDep, SessionDep, write_audit
from .response import ok, page

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/admin/orgs", tags=["admin-orgs"])


# ---- Schemas ----
class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None = None
    code: str
    name: str
    type: OrgType
    leader_id: int | None = None
    leader_name: str | None = None
    sort_order: int = 0
    description: str | None = None
    member_count: int = 0
    position_count: int = 0
    created_at: datetime
    updated_at: datetime


class OrgCreate(BaseModel):
    parent_id: int | None = None
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    type: OrgType = OrgType.DEPARTMENT
    leader_id: int | None = None
    sort_order: int = 0
    description: str | None = Field(default=None, max_length=512)


class OrgUpdate(BaseModel):
    parent_id: int | None = None
    name: str | None = Field(default=None, max_length=128)
    type: OrgType | None = None
    leader_id: int | None = None
    sort_order: int | None = None
    description: str | None = Field(default=None, max_length=512)


class PositionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: int
    org_name: str | None = None
    code: str
    name: str
    level: str | None = None
    description: str | None = None
    holder_count: int = 0


class PositionCreate(BaseModel):
    org_id: int
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    level: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=512)


class PositionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    level: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=512)


class TransferPayload(BaseModel):
    user_id: int
    target_org_id: int
    target_position_id: int | None = None
    reports_to: int | None = None
    reason: str | None = Field(default=None, max_length=512)


class OrgTreeNode(BaseModel):
    id: int
    parent_id: int | None
    code: str
    name: str
    type: OrgType
    leader_id: int | None
    sort_order: int
    member_count: int
    children: list["OrgTreeNode"] = []


OrgTreeNode.model_rebuild()


# ---- helpers ----
async def _load_org(session: AsyncSession, org_id: int, tenant_id: str) -> Org | None:
    return (
        await session.execute(
            select(Org).where(and_(Org.id == org_id, Org.tenant_id == tenant_id))
        )
    ).scalar_one_or_none()


async def _member_counts(session: AsyncSession, org_ids: list[int]) -> dict[int, int]:
    if not org_ids:
        return {}
    rows = (
        await session.execute(
            select(EmployeePosition.position_id, func.count(EmployeePosition.id))
            .where(EmployeePosition.position_id.in_(
                select(Position.id).where(Position.org_id.in_(org_ids))
            ))
            .group_by(EmployeePosition.position_id)
        )
    ).all()
    pos_to_org = dict(
        (await session.execute(
            select(Position.id, Position.org_id).where(Position.org_id.in_(org_ids))
        )).all()
    )
    result: dict[int, int] = {oid: 0 for oid in org_ids}
    for pos_id, count in rows:
        org_id = pos_to_org.get(pos_id)
        if org_id is not None:
            result[org_id] = result.get(org_id, 0) + count
    return result


async def _position_counts(session: AsyncSession, org_ids: list[int]) -> dict[int, int]:
    if not org_ids:
        return {}
    rows = (
        await session.execute(
            select(Position.org_id, func.count(Position.id))
            .where(Position.org_id.in_(org_ids))
            .group_by(Position.org_id)
        )
    ).all()
    return {oid: cnt for oid, cnt in rows}


# ---- Endpoints ----
@router.get("/tree")
async def get_org_tree(
    caller: AdminDep,
    session: SessionDep,
) -> dict[str, Any]:
    """组织树 (FR-DASH-006-03 主视图)."""
    orgs = (
        await session.execute(
            select(Org).where(Org.tenant_id == caller.tenant_id).order_by(Org.sort_order, Org.id)
        )
    ).scalars().all()
    if not orgs:
        return ok([])

    members = await _member_counts(session, [o.id for o in orgs if o.id is not None])
    leaders = {
        uid: name
        for uid, name in (
            await session.execute(select(User.id, User.real_name).where(
                User.id.in_({o.leader_id for o in orgs if o.leader_id is not None})
            ))
        ).all()
    }

    by_parent: dict[int | None, list[Org]] = {}
    for o in orgs:
        by_parent.setdefault(o.parent_id, []).append(o)

    def build(node: Org) -> OrgTreeNode:
        return OrgTreeNode(
            id=node.id or 0,
            parent_id=node.parent_id,
            code=node.code,
            name=node.name,
            type=node.type,
            leader_id=node.leader_id,
            sort_order=node.sort_order,
            member_count=members.get(node.id or 0, 0),
            children=[build(c) for c in by_parent.get(node.id, [])],
        )

    roots = [build(o) for o in by_parent.get(None, [])]
    return ok([r.model_dump(mode="json") for r in roots])


@router.get("")
async def list_orgs(
    caller: AdminDep,
    session: SessionDep,
    keyword: str | None = Query(default=None),
    parent_id: int | None = Query(default=None),
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=50, ge=1, le=500, alias="pageSize"),
) -> dict[str, Any]:
    base = select(Org).where(Org.tenant_id == caller.tenant_id)
    if keyword:
        like = f"%{keyword}%"
        base = base.where(or_(Org.name.like(like), Org.code.like(like)))
    if parent_id is not None:
        base = base.where(Org.parent_id == parent_id)

    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt = base.order_by(Org.sort_order, Org.id).offset((page_num - 1) * page_size).limit(page_size)
    items = (await session.execute(stmt)).scalars().all()
    org_ids = [o.id for o in items if o.id is not None]
    members = await _member_counts(session, org_ids)
    pos_counts = await _position_counts(session, org_ids)
    leader_ids = {o.leader_id for o in items if o.leader_id is not None}
    leaders = {
        uid: name
        for uid, name in (
            await session.execute(select(User.id, User.real_name).where(User.id.in_(leader_ids)))
        ).all()
    } if leader_ids else {}

    out = []
    for o in items:
        out.append(
            OrgOut(
                id=o.id or 0,
                parent_id=o.parent_id,
                code=o.code,
                name=o.name,
                type=o.type,
                leader_id=o.leader_id,
                leader_name=leaders.get(o.leader_id) if o.leader_id else None,
                sort_order=o.sort_order,
                description=o.description,
                member_count=members.get(o.id, 0),
                position_count=pos_counts.get(o.id, 0),
                created_at=o.created_at,
                updated_at=o.updated_at,
            ).model_dump(mode="json")
        )
    return page(items=out, total=total, page=page_num, page_size=page_size)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_org(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    payload: OrgCreate,
) -> dict[str, Any]:
    if payload.parent_id is not None:
        parent = await _load_org(session, payload.parent_id, caller.tenant_id)
        if not parent:
            raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "父组织不存在"})

    existing = (
        await session.execute(
            select(Org).where(and_(Org.tenant_id == caller.tenant_id, Org.code == payload.code))
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail={"code": "E409_CONFLICT", "message": f"组织编码 '{payload.code}' 已存在"})

    org = Org(
        tenant_id=caller.tenant_id,
        parent_id=payload.parent_id,
        code=payload.code,
        name=payload.name,
        type=payload.type,
        leader_id=payload.leader_id,
        sort_order=payload.sort_order,
        description=payload.description,
    )
    session.add(org)
    await session.flush()
    await write_audit(
        session,
        caller,
        module="org",
        action=AuditAction.CREATE,
        resource_type="org",
        resource_id=str(org.id),
        resource_name=org.name,
        summary=f"创建组织 {org.name}",
        detail=payload.model_dump(),
        request=request,
    )
    await session.commit()
    await session.refresh(org)
    return ok({"id": org.id, "code": org.code, "name": org.name})


@router.put("/{org_id}")
async def update_org(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    org_id: int,
    payload: OrgUpdate,
) -> dict[str, Any]:
    org = await _load_org(session, org_id, caller.tenant_id)
    if not org:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "组织不存在"})
    before = {
        "name": org.name,
        "type": org.type.value,
        "leader_id": org.leader_id,
        "parent_id": org.parent_id,
        "sort_order": org.sort_order,
    }
    if payload.name is not None:
        org.name = payload.name
    if payload.type is not None:
        org.type = payload.type
    if payload.leader_id is not None:
        org.leader_id = payload.leader_id
    if payload.parent_id is not None:
        org.parent_id = payload.parent_id
    if payload.sort_order is not None:
        org.sort_order = payload.sort_order
    if payload.description is not None:
        org.description = payload.description
    org.updated_at = datetime.now(UTC)

    after = {
        "name": org.name,
        "type": org.type.value,
        "leader_id": org.leader_id,
        "parent_id": org.parent_id,
        "sort_order": org.sort_order,
    }
    await write_audit(
        session,
        caller,
        module="org",
        action=AuditAction.UPDATE,
        resource_type="org",
        resource_id=str(org.id),
        resource_name=org.name,
        summary=f"更新组织 {org.name}",
        detail={"before": before, "after": after},
        request=request,
    )
    await session.commit()
    return ok({"id": org.id, "name": org.name})


@router.delete("/{org_id}")
async def delete_org(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    org_id: int,
) -> dict[str, Any]:
    org = await _load_org(session, org_id, caller.tenant_id)
    if not org:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "组织不存在"})

    children = (
        await session.execute(select(Org).where(Org.parent_id == org.id))
    ).scalars().all()
    if children:
        raise HTTPException(
            status_code=409,
            detail={"code": "E409_CONFLICT", "message": f"组织 '{org.name}' 下仍有 {len(children)} 个子组织"},
        )

    name = org.name
    await session.delete(org)
    await write_audit(
        session,
        caller,
        module="org",
        action=AuditAction.DELETE,
        resource_type="org",
        resource_id=str(org_id),
        resource_name=name,
        summary=f"删除组织 {name}",
        request=request,
    )
    await session.commit()
    return ok({"deleted": org_id})


# ---- Positions ----
@router.get("/positions")
async def list_positions(
    caller: AdminDep,
    session: SessionDep,
    org_id: int | None = Query(default=None),
    keyword: str | None = Query(default=None),
    page_num: int = Query(default=1, ge=1, alias="page"),
    page_size: int = Query(default=50, ge=1, le=200, alias="pageSize"),
) -> dict[str, Any]:
    base = select(Position).where(Position.tenant_id == caller.tenant_id)
    if org_id:
        base = base.where(Position.org_id == org_id)
    if keyword:
        like = f"%{keyword}%"
        base = base.where(or_(Position.name.like(like), Position.code.like(like)))

    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    stmt = base.order_by(Position.org_id, Position.code).offset((page_num - 1) * page_size).limit(page_size)
    items = (await session.execute(stmt)).scalars().all()
    org_map = dict(
        (await session.execute(
            select(Org.id, Org.name).where(Org.id.in_({p.org_id for p in items}))
        )).all()
    ) if items else {}

    holders = {}
    if items:
        rows = (
            await session.execute(
                select(EmployeePosition.position_id, func.count(EmployeePosition.id))
                .where(EmployeePosition.position_id.in_([p.id for p in items if p.id is not None]))
                .group_by(EmployeePosition.position_id)
            )
        ).all()
        holders = {pid: cnt for pid, cnt in rows}

    out = []
    for p in items:
        out.append(
            PositionOut(
                id=p.id or 0,
                org_id=p.org_id,
                org_name=org_map.get(p.org_id),
                code=p.code,
                name=p.name,
                level=p.level,
                description=p.description,
                holder_count=holders.get(p.id, 0),
            ).model_dump(mode="json")
        )
    return page(items=out, total=total, page=page_num, page_size=page_size)


@router.post("/positions", status_code=status.HTTP_201_CREATED)
async def create_position(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    payload: PositionCreate,
) -> dict[str, Any]:
    org = await _load_org(session, payload.org_id, caller.tenant_id)
    if not org:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "组织不存在"})

    position = Position(
        tenant_id=caller.tenant_id,
        org_id=payload.org_id,
        code=payload.code,
        name=payload.name,
        level=payload.level,
        description=payload.description,
    )
    session.add(position)
    await session.flush()
    await write_audit(
        session,
        caller,
        module="org",
        action=AuditAction.CREATE,
        resource_type="position",
        resource_id=str(position.id),
        resource_name=position.name,
        summary=f"创建岗位 {position.name}",
        detail=payload.model_dump(),
        request=request,
    )
    await session.commit()
    return ok({"id": position.id, "name": position.name})


@router.put("/positions/{position_id}")
async def update_position(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    position_id: int,
    payload: PositionUpdate,
) -> dict[str, Any]:
    pos = (
        await session.execute(
            select(Position).where(and_(Position.id == position_id, Position.tenant_id == caller.tenant_id))
        )
    ).scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "岗位不存在"})
    if payload.name is not None:
        pos.name = payload.name
    if payload.level is not None:
        pos.level = payload.level
    if payload.description is not None:
        pos.description = payload.description
    pos.updated_at = datetime.now(UTC)
    await write_audit(
        session,
        caller,
        module="org",
        action=AuditAction.UPDATE,
        resource_type="position",
        resource_id=str(pos.id),
        resource_name=pos.name,
        summary=f"更新岗位 {pos.name}",
        detail=payload.model_dump(exclude_none=True),
        request=request,
    )
    await session.commit()
    return ok({"id": pos.id, "name": pos.name})


@router.delete("/positions/{position_id}")
async def delete_position(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    position_id: int,
) -> dict[str, Any]:
    pos = (
        await session.execute(
            select(Position).where(and_(Position.id == position_id, Position.tenant_id == caller.tenant_id))
        )
    ).scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "岗位不存在"})
    name = pos.name
    rels = (
        await session.execute(select(EmployeePosition).where(EmployeePosition.position_id == pos.id))
    ).scalars().all()
    if rels:
        raise HTTPException(
            status_code=409,
            detail={"code": "E409_CONFLICT", "message": f"岗位 '{name}' 仍有 {len(rels)} 位员工"},
        )
    await session.delete(pos)
    await write_audit(
        session,
        caller,
        module="org",
        action=AuditAction.DELETE,
        resource_type="position",
        resource_id=str(position_id),
        resource_name=name,
        summary=f"删除岗位 {name}",
        request=request,
    )
    await session.commit()
    return ok({"deleted": position_id})


# ---- Transfer ----
@router.post("/transfer")
async def transfer(
    caller: AdminDep,
    session: SessionDep,
    request: Request,
    payload: TransferPayload,
) -> dict[str, Any]:
    """人员调岗 (FR-DASH-006-03)."""
    user = (
        await session.execute(
            select(User).where(and_(User.id == payload.user_id, User.tenant_id == caller.tenant_id))
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "用户不存在"})
    org = await _load_org(session, payload.target_org_id, caller.tenant_id)
    if not org:
        raise HTTPException(status_code=404, detail={"code": "E404_NOT_FOUND", "message": "目标组织不存在"})

    # 关闭当前主岗
    existing = (
        await session.execute(
            select(EmployeePosition).where(
                and_(EmployeePosition.user_id == user.id, EmployeePosition.is_primary == True)  # noqa: E712
            )
        )
    ).scalars().all()
    now = datetime.now(UTC)
    for ep in existing:
        ep.is_primary = False
        ep.effective_to = now

    # 创建新主岗
    position_id = payload.target_position_id
    if position_id is None:
        # 自动取目标组织下的第一个岗位
        first_pos = (
            await session.execute(
                select(Position).where(Position.org_id == org.id).order_by(Position.id)
            )
        ).scalars().first()
        if not first_pos:
            raise HTTPException(
                status_code=409,
                detail={"code": "E409_CONFLICT", "message": f"目标组织 '{org.name}' 暂无岗位，请先创建"},
            )
        position_id = first_pos.id

    new_ep = EmployeePosition(
        tenant_id=caller.tenant_id,
        user_id=user.id,
        position_id=position_id,
        reports_to=payload.reports_to,
        is_primary=True,
        effective_from=now,
    )
    session.add(new_ep)

    # 更新 user.department 便于列表展示
    user.department = org.name
    user.updated_at = now

    await write_audit(
        session,
        caller,
        module="org",
        action=AuditAction.UPDATE,
        resource_type="employee_position",
        resource_id=str(user.id),
        resource_name=user.username,
        summary=f"调岗 {user.username} -> {org.name}",
        detail=payload.model_dump(),
        request=request,
    )
    await session.commit()
    return ok({"user_id": user.id, "target_org_id": org.id, "position_id": position_id})
