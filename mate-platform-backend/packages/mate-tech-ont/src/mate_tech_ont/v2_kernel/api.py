"""mate-tech-ont v2 kernel HTTP 适配（RUNTIME-HTTP-01）。

把 v3.1 KERNEL-01 的 12 基元 Protocol 暴露为 5 核心 REST 端点：
- ObjectType CRUD（POST/GET /v2/object-types）
- Individual CRUD（POST/GET /v2/individuals）
- ObjectSet evaluate（POST /v2/object-sets:evaluate）
- ActionType apply（POST /v2/action-types:apply）

Repository 单例由 main.on_startup 选择（InMemory dev / PG prod）后挂到
app.state.kernel_repo。每个 endpoint 通过 `app.state.kernel_repo` 获取，
走 require_tenant(ctx) 守门（mate-platform 13 硬规则 #3）。
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

from mate_platform.tenancy.guards import require_tenant

router = APIRouter(prefix="/api/v1/ont/v2", tags=["v2-kernel"])


# ─────────────────── DTO ───────────────────


class PropertyDTO(BaseModel):
    rid: str
    type_id: str
    nullable: bool = False
    primary_key: bool = False
    title: str = ""
    format: str = "string"


class ObjectTypeDTO(BaseModel):
    rid: str
    primary_key: tuple[str, ...]
    properties: list[PropertyDTO]
    display_name: str = ""
    interfaces: list[str] = Field(default_factory=list)


class ObjectTypeResponse(BaseModel):
    rid: str
    primary_key: tuple[str, ...]
    properties: list[PropertyDTO]
    display_name: str = ""
    interfaces: list[str] = Field(default_factory=list)


class IndividualCreateDTO(BaseModel):
    rid: str
    class_rid: str
    props: dict[str, dict[str, Any]]  # prop_rid -> {"value": ..., "type": "..."}
    primary_key: str
    marking: list[str] = Field(default_factory=list)


class IndividualResponse(BaseModel):
    rid: str
    class_rid: str
    primary_key: str
    props: dict[str, Any]
    tenant_id: str
    created_at: str
    updated_at: str


class ObjectSetDTO(BaseModel):
    class_rid: str
    filter_expr: str = ""
    sort: list[str] = Field(default_factory=list)
    paging_offset: int = 0
    paging_limit: int = 100


class ActionApplyDTO(BaseModel):
    action_rid: str
    target_iid: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)


class ActionApplyResponse(BaseModel):
    applied_at: str
    audit_id: str
    side_effects: list[str]


# ─────────────────── helpers ───────────────────


def _repo(request: Request) -> OntologyRepository:
    repo: OntologyRepository | None = getattr(request.app.state, "kernel_repo", None)
    if repo is None:
        raise HTTPException(status_code=503, detail="kernel_repo not initialized")
    return repo


async def _call(repo: OntologyRepository, method_name: str, /, *args, **kwargs):
    """把 sync repo 调用推到 threadpool；FastAPI 仍可 await。

    InMemory 也是 sync，跑 threadpool 也无害。
    """
    method = getattr(repo, method_name)
    return await asyncio.to_thread(method, *args, **kwargs)


def _ctx(request: Request) -> Any:
    """从 AuthMiddleware 注入的 ctx 中取 tenant（13 硬规则 #3 守门）。"""
    ctx = getattr(request.state, "ctx", None)
    if ctx is None:
        raise HTTPException(status_code=401, detail="no auth context")
    require_tenant(ctx)
    return ctx


def _prop_to_dto(p: Property) -> PropertyDTO:
    return PropertyDTO(
        rid=p.rid.rid, type_id=p.type_id, nullable=p.nullable,
        primary_key=p.primary_key, title=p.title, format=p.format.value,
    )


def _dto_to_prop(d: PropertyDTO) -> Property:
    return Property(
        rid=ClassRef(d.rid),
        type_id=d.type_id,
        nullable=d.nullable,
        primary_key=d.primary_key,
        title=d.title,
        format=PropertyFormat(d.format),
    )


def _ot_to_dto(ot: ObjectType) -> ObjectTypeResponse:
    pks: tuple[str, ...] = tuple(
        p.rid if isinstance(p, ClassRef) else str(p) for p in ot.primary_key
    )
    return ObjectTypeResponse(
        rid=ot.rid.rid,
        primary_key=pks,
        properties=[_prop_to_dto(p) for p in ot.properties],
        display_name=ot.display_name,
        interfaces=[i.rid for i in ot.interfaces],
    )


def _dto_to_ot(d: ObjectTypeDTO) -> ObjectType:
    return ObjectType(
        rid=ClassRef(d.rid),
        primary_key=tuple(ClassRef(pk) for pk in d.primary_key),
        properties=tuple(_dto_to_prop(p) for p in d.properties),
        display_name=d.display_name,
        interfaces=tuple(ClassRef(i) for i in d.interfaces),
    )


# ─────────────────── 1) ObjectType CRUD ───────────────────


@router.post(
    "/object-types",
    response_model=ObjectTypeResponse,
    operation_id="ontPostV2ObjectType",
)
async def upsert_object_type(
    payload: ObjectTypeDTO, request: Request,
) -> ObjectTypeResponse:
    """Upsert an ObjectType — registers Property + Class in kernel repo."""
    ctx = _ctx(request)
    ot = _dto_to_ot(payload)
    saved = await _call(_repo(request), "upsert_object_type", ot)
    return _ot_to_dto(saved)


@router.get(
    "/object-types",
    response_model=list[ObjectTypeResponse],
    operation_id="ontGetV2ObjectTypes",
)
async def list_object_types(
    request: Request, limit: int = 100, offset: int = 0,
) -> list[ObjectTypeResponse]:
    """List ObjectTypes with pagination."""
    _ctx(request)
    items = await _call(_repo(request), "list_object_types", limit=limit, offset=offset)
    return [_ot_to_dto(i) for i in items]


@router.get(
    "/object-types/{rid:path}",
    response_model=ObjectTypeResponse,
    operation_id="ontGetV2ObjectTypeByRid",
)
async def get_object_type(rid: str, request: Request) -> ObjectTypeResponse:
    _ctx(request)
    try:
        ot = await _call(_repo(request), "get_object_type", ClassRef(rid))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _ot_to_dto(ot)


# ─────────────────── 2) Individual CRUD ───────────────────


@router.post(
    "/individuals",
    response_model=IndividualResponse,
    operation_id="ontPostV2Individual",
)
async def create_individual(
    payload: IndividualCreateDTO, request: Request,
) -> IndividualResponse:
    """Create an Individual instance; tenant_id 由 ctx 强制注入（不信任 payload）。"""
    ctx = _ctx(request)
    tenant_id = ctx.tenant_id  # type: ignore[attr-defined]
    # 强制 rid 前缀与 ctx.tenant 一致（13 硬规则 #3 tenant guard）
    expected_prefix = f"ont.{tenant_id}.ind."
    if not payload.rid.startswith(expected_prefix):
        raise HTTPException(
            status_code=403,
            detail=f"rid prefix must be {expected_prefix} for tenant {tenant_id}",
        )
    if not payload.class_rid.startswith(f"ont.{tenant_id}."):
        raise HTTPException(
            status_code=403,
            detail=f"class_rid must be under tenant {tenant_id}",
        )
    now = datetime.now(timezone.utc)
    props_tuple = tuple(
        (ClassRef(p_rid), payload.props[p_rid].get("value"))
        for p_rid in payload.props
    )
    ind = Individual(
        rid=payload.rid,
        class_rid=ClassRef(payload.class_rid),
        props=props_tuple,
        primary_key=payload.primary_key,
        created_at=now,
        updated_at=now,
        tenant_id=tenant_id,
        marking=tuple(payload.marking),
    )
    saved = await _call(_repo(request), "create_individual", ind)
    return IndividualResponse(
        rid=saved.rid,
        class_rid=saved.class_rid.rid,
        primary_key=saved.primary_key,
        props={k.rid: v for k, v in saved.props},
        tenant_id=saved.tenant_id,
        created_at=saved.created_at.isoformat(),
        updated_at=saved.updated_at.isoformat(),
    )


@router.get(
    "/individuals",
    response_model=list[IndividualResponse],
    operation_id="ontGetV2Individuals",
)
async def list_individuals(
    request: Request, class_rid: str | None = None,
) -> list[IndividualResponse]:
    """List individuals; class_rid 过滤。"""
    ctx = _ctx(request)
    cls_ref = ClassRef(class_rid) if class_rid else None
    if cls_ref and not cls_ref.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant access denied")
    items = await _call(_repo(request), "list_individuals", cls_ref)
    return [
        IndividualResponse(
            rid=i.rid,
            class_rid=i.class_rid.rid,
            primary_key=i.primary_key,
            props={k.rid: v for k, v in i.props},
            tenant_id=i.tenant_id,
            created_at=i.created_at.isoformat(),
            updated_at=i.updated_at.isoformat(),
        )
        for i in items
    ]


# ─────────────────── 3) ObjectSet evaluate ───────────────────


@router.post(
    "/object-sets:evaluate",
    response_model=list[IndividualResponse],
    operation_id="ontPostV2ObjectSetEvaluate",
)
async def evaluate_object_set(
    payload: ObjectSetDTO, request: Request,
) -> list[IndividualResponse]:
    """Evaluate an ObjectSet query plan against the kernel repo."""
    ctx = _ctx(request)
    cls_ref = ClassRef(payload.class_rid)
    if not cls_ref.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant query denied")
    os_ = ObjectSet(
        class_rid=cls_ref,
        filter_expr=payload.filter_expr,
        sort=tuple(payload.sort),
        paging_offset=payload.paging_offset,
        paging_limit=payload.paging_limit,
    )
    results = await _call(_repo(request), "evaluate_object_set", os_)
    return [
        IndividualResponse(
            rid=i.rid,
            class_rid=i.class_rid.rid,
            primary_key=i.primary_key,
            props={k.rid: v for k, v in i.props},
            tenant_id=i.tenant_id,
            created_at=i.created_at.isoformat(),
            updated_at=i.updated_at.isoformat(),
        )
        for i in results
    ]


# ─────────────────── 4) ActionType apply ───────────────────


@router.post(
    "/action-types:apply",
    response_model=ActionApplyResponse,
    operation_id="ontPostV2ActionApply",
)
async def apply_action(
    payload: ActionApplyDTO, request: Request,
) -> ActionApplyResponse:
    """Apply an ActionType — single合法写路径（KERNEL-01 第 6 基元）。"""
    import uuid

    ctx = _ctx(request)
    action_rid = ClassRef(payload.action_rid)
    if not action_rid.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant action denied")
    provenance = {**payload.provenance, "actor": ctx.user_id}  # type: ignore[attr-defined]
    try:
        applied_at, side_effects = await _call(
            _repo(request), "apply_action",
            action_rid=action_rid,
            target_iid=payload.target_iid,
            parameters=payload.parameters,
            provenance=provenance,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ActionApplyResponse(
        applied_at=applied_at.isoformat(),
        audit_id=str(uuid.uuid4()),
        side_effects=list(side_effects),
    )


__all__ = ["router"]