"""mate-tech-ont v2 kernel HTTP 适配（RUNTIME-HTTP-01）。

把 v3.1 KERNEL-01 的 12 基元 Protocol 暴露为 REST 端点，与契约
`contracts/openapi/services/ont.yaml` 的 v2 面（operationId 逐一对齐）：
- ObjectType CRUD（POST/GET /v2/object-types、GET /v2/object-types/{rid}）
- LinkType CRUD（POST/GET /v2/link-types、GET /v2/link-types/{rid}）
- ActionType CRUD + apply（POST/GET /v2/action-types、
  POST /v2/action-types/{rid}/apply —— 唯一合法写入口；`:apply` 保留为
  deprecated 别名，见 RUNTIME-MVP-01 兼容）
- Interface CRUD（POST/GET /v2/interfaces）
- Individual CRUD（POST/GET /v2/individuals、GET /v2/individuals/{rid}）
- Axiom / Function CRUD（POST/GET /v2/axioms、/v2/functions）
- ObjectSet 查询（POST /v2/object-sets/query 契约路径；`:evaluate` 保留）

Repository 单例由 main.on_startup 选择（InMemory dev / PG prod）后挂到
app.state.kernel_repo。每个 endpoint 通过 `app.state.kernel_repo` 获取，
走 require_tenant(ctx) 守门（mate-platform 13 硬规则 #3）。

GOVERN-06 tenant 三层防线：
1. **API 字符串前缀**（本文件）: rid.startswith(f"ont.{tenant_id}.") 兜底
2. **psycopg2 桥**（pg_repo._install_rls）: SET LOCAL app.tenant_id='<t>'
3. **PG RLS FORCE POLICY**（Alembic 0013）: tenant_isolation policy + FORCE

每层独立 fail-closed：API 拒绝 → 不会到 DB；RLS 拒绝 → 即使绕过 API
也无数据。handlers 通过 _call_scoped() 走第 2 层。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from mate_kernel.objectset.ir import (  # noqa: I001
    Aggregation,
    Condition,
    MetricSpec,
    ObjectSetQuery,
    QueryOp,
    SortKey,
    TraversalStep,
)
from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, AxiomKind, Function, FunctionLanguage
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.interface import Interface
from mate_kernel.ontology.types.link_type import Cardinality, Directionality, LinkType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_kernel.tooling import schema_gen
from mate_kernel.tooling.schema_gen import agent_tool_schemas
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
    marking: list[str] = Field(default_factory=list)


class ObjectTypeResponse(BaseModel):
    rid: str
    primary_key: tuple[str, ...]
    properties: list[PropertyDTO]
    display_name: str = ""
    interfaces: list[str] = Field(default_factory=list)
    marking: list[str] = Field(default_factory=list)


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


class ActionApplyBodyDTO(BaseModel):
    """Contract shape: rid in the path, body carries parameters/target_iid/provenance.

    Only `parameters` is required (contract `required: [parameters]`).
    """
    parameters: dict[str, Any] = Field(default_factory=dict)
    target_iid: str = ""
    provenance: dict[str, Any] = Field(default_factory=dict)


class ActionApplyDTO(ActionApplyBodyDTO):
    """Legacy body for the deprecated `:apply` alias — action rid inside the body."""
    action_rid: str


class ActionApplyResponse(BaseModel):
    action_rid: str
    applied_at: str
    audit_id: str
    side_effects_emitted: list[str]


class ActionTypeDTO(BaseModel):
    rid: str
    parameters: list[PropertyDTO] = Field(default_factory=list)
    submission_criteria: list[str] = Field(default_factory=list)
    side_effects: list[str] = Field(default_factory=list)
    function_ref: str
    on: list[str] = Field(default_factory=list)
    title: str = ""
    description: str = ""


class LinkTypeDTO(BaseModel):
    rid: str
    src: str
    dst: str
    cardinality: str
    directionality: str
    link_properties: list[PropertyDTO] = Field(default_factory=list)


class InterfaceDTO(BaseModel):
    rid: str
    properties: list[PropertyDTO] = Field(default_factory=list)
    required_links: list[str] = Field(default_factory=list)
    polymorphic_action_constraints: list[str] = Field(default_factory=list)


class AxiomDTO(BaseModel):
    rid: str
    kind: str
    operands: list[str] = Field(default_factory=list)
    rule_ref: str = ""
    metadata: list[list[str]] = Field(default_factory=list)


class FunctionDTO(BaseModel):
    rid: str
    language: str
    version: int
    source_ref: str
    signatures: list[list[str]] = Field(default_factory=list)


class LinkInstanceDTO(BaseModel):
    rid: str
    link_type_rid: str
    src: str
    dst: str
    props: dict[str, dict[str, Any]] = Field(default_factory=dict)
    marking: list[str] = Field(default_factory=list)


class LinkInstanceResponse(BaseModel):
    rid: str
    link_type_rid: str
    src: str
    dst: str
    props: dict[str, Any]
    tenant_id: str
    created_at: str
    marking: list[str]


class ObjectSetResult(BaseModel):
    results: list[IndividualResponse]
    count: int


class VersionDTO(BaseModel):
    rid: str
    class_ref: str
    parent_rid: str | None = None
    created_at: str
    author: str
    change_set: list[str] = Field(default_factory=list)


class VersionCreateDTO(BaseModel):
    class_ref: str
    parent_rid: str | None = None
    author: str
    change_set: list[str] = Field(default_factory=list)


# ─────────────────── helpers ───────────────────


def _repo(request: Request) -> OntologyRepository:
    repo: OntologyRepository | None = getattr(request.app.state, "kernel_repo", None)
    if repo is None:
        raise HTTPException(status_code=503, detail="kernel_repo not initialized")
    return repo


def _scoped_repo(request: Request) -> Any:
    """GOVERN-06: 返回 tenant_scope(ctx.tenant_id) 上下文管理器。

    仅 PgOntologyRepository 实现 tenant_scope；InMemory / Memory 兼容
    （调用 scope 不抛但不影响行为）。用法::

        with _scoped_repo(request) as repo:
            await _call(repo, "upsert_object_type", ...)
    """
    repo = _repo(request)
    ctx = _ctx(request)
    scope = getattr(repo, "tenant_scope", None)
    if scope is None:
        # InMemory / mock —— 无 tenant_scope，直接返回 repo。上下文管理器协议
        # 由 nullcontext 提供。
        from contextlib import nullcontext

        return nullcontext(repo)
    return scope(ctx.tenant_id)


async def _call(repo: OntologyRepository, method_name: str, /, *args, **kwargs):
    """把 sync repo 调用推到 threadpool；FastAPI 仍可 await。

    InMemory 也是 sync，跑 threadpool 也无害。
    """
    method = getattr(repo, method_name)
    return await asyncio.to_thread(method, *args, **kwargs)


async def _call_scoped(
    request: Request, method_name: str, /, *args, **kwargs
):
    """GOVERN-06: 在 tenant_scope 内调 repo method，自动 install_rls。

    等价于::

        with _scoped_repo(request) as repo:
            return await _call(repo, method_name, *args, **kwargs)
    """
    with _scoped_repo(request) as repo:
        return await _call(repo, method_name, *args, **kwargs)


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
        marking=list(ot.marking),
    )


def _dto_to_action_type(d: ActionTypeDTO) -> ActionType:
    return ActionType(
        rid=ClassRef(d.rid),
        parameters=tuple(_dto_to_prop(p) for p in d.parameters),
        submission_criteria=tuple(d.submission_criteria),
        side_effects=tuple(d.side_effects),
        function_ref=ClassRef(d.function_ref),
        on=tuple(ClassRef(o) for o in d.on),
        title=d.title,
        description=d.description,
    )


def _action_type_to_dto(at: ActionType) -> ActionTypeDTO:
    return ActionTypeDTO(
        rid=at.rid.rid,
        parameters=[_prop_to_dto(p) for p in at.parameters],
        submission_criteria=list(at.submission_criteria),
        side_effects=list(at.side_effects),
        function_ref=at.function_ref.rid,
        on=[c.rid for c in at.on],
        title=at.title,
        description=at.description,
    )


def _dto_to_link_type(d: LinkTypeDTO) -> LinkType:
    return LinkType(
        rid=ClassRef(d.rid),
        src=ClassRef(d.src),
        dst=ClassRef(d.dst),
        cardinality=Cardinality(d.cardinality),
        directionality=Directionality(d.directionality),
        link_properties=tuple(_dto_to_prop(p) for p in d.link_properties),
    )


def _link_type_to_dto(lt: LinkType) -> LinkTypeDTO:
    return LinkTypeDTO(
        rid=lt.rid.rid,
        src=lt.src.rid,
        dst=lt.dst.rid,
        cardinality=lt.cardinality.value,
        directionality=lt.directionality.value,
        link_properties=[_prop_to_dto(p) for p in lt.link_properties],
    )


def _dto_to_interface(d: InterfaceDTO) -> Interface:
    return Interface(
        rid=ClassRef(d.rid),
        properties=tuple(_dto_to_prop(p) for p in d.properties),
        required_links=tuple(ClassRef(r) for r in d.required_links),
        polymorphic_action_constraints=tuple(d.polymorphic_action_constraints),
    )


def _interface_to_dto(i: Interface) -> InterfaceDTO:
    return InterfaceDTO(
        rid=i.rid.rid,
        properties=[_prop_to_dto(p) for p in i.properties],
        required_links=[r.rid for r in i.required_links],
        polymorphic_action_constraints=list(i.polymorphic_action_constraints),
    )


def _dto_to_axiom(d: AxiomDTO) -> Axiom:
    return Axiom(
        rid=ClassRef(d.rid),
        kind=AxiomKind(d.kind),
        operands=tuple(ClassRef(o) for o in d.operands),
        rule_ref=d.rule_ref,
        metadata=tuple((k, v) for k, v in d.metadata),
    )


def _axiom_to_dto(ax: Axiom) -> AxiomDTO:
    return AxiomDTO(
        rid=ax.rid.rid,
        kind=ax.kind.value,
        operands=[o.rid for o in ax.operands],
        rule_ref=ax.rule_ref,
        metadata=[[k, v] for k, v in ax.metadata],
    )


def _dto_to_function(d: FunctionDTO) -> Function:
    return Function(
        rid=ClassRef(d.rid),
        language=FunctionLanguage(d.language),
        version=d.version,
        source_ref=d.source_ref,
        signatures=tuple((k, v) for k, v in d.signatures),
    )


def _function_to_dto(f: Function) -> FunctionDTO:
    return FunctionDTO(
        rid=f.rid.rid,
        language=f.language.value,
        version=f.version,
        source_ref=f.source_ref,
        signatures=[[k, v] for k, v in f.signatures],
    )


def _individual_to_response(i: Individual) -> IndividualResponse:
    return IndividualResponse(
        rid=i.rid,
        class_rid=i.class_rid.rid,
        primary_key=i.primary_key,
        props={k.rid: v for k, v in i.props},
        tenant_id=i.tenant_id,
        created_at=i.created_at.isoformat(),
        updated_at=i.updated_at.isoformat(),
    )


def _link_instance_to_response(li: LinkInstance) -> LinkInstanceResponse:
    return LinkInstanceResponse(
        rid=li.rid,
        link_type_rid=li.link_type_rid.rid,
        src=li.src,
        dst=li.dst,
        props={k.rid: v for k, v in li.props},
        tenant_id=li.tenant_id,
        created_at=li.created_at.isoformat(),
        marking=list(li.marking),
    )


def _version_to_dto(v) -> VersionDTO:
    return VersionDTO(
        rid=v.rid,
        class_ref=v.class_ref.rid,
        parent_rid=v.parent_rid,
        created_at=v.created_at.isoformat(),
        author=v.author,
        change_set=list(v.change_set),
    )


def _dto_to_ot(d: ObjectTypeDTO) -> ObjectType:
    return ObjectType(
        rid=ClassRef(d.rid),
        primary_key=tuple(ClassRef(pk) for pk in d.primary_key),
        properties=tuple(_dto_to_prop(p) for p in d.properties),
        display_name=d.display_name,
        interfaces=tuple(ClassRef(i) for i in d.interfaces),
        marking=tuple(d.marking),
    )


# ─────────────────── 1) ObjectType CRUD ───────────────────


@router.post(
    "/object-types",
    response_model=ObjectTypeResponse,
    operation_id="ontCreateV2ObjectType",
)
async def upsert_object_type(
    payload: ObjectTypeDTO, request: Request,
) -> ObjectTypeResponse:
    """Upsert an ObjectType — registers Property + Class in kernel repo."""
    ot = _dto_to_ot(payload)
    saved = await _call_scoped(request, "upsert_object_type", ot)
    return _ot_to_dto(saved)


@router.get(
    "/object-types",
    response_model=list[ObjectTypeResponse],
    operation_id="ontListV2ObjectTypes",
)
async def list_object_types(
    request: Request, limit: int = 100, offset: int = 0,
) -> list[ObjectTypeResponse]:
    """List ObjectTypes with pagination."""
    _ctx(request)
    items = await _call_scoped(request, "list_object_types", limit=limit, offset=offset)
    return [_ot_to_dto(i) for i in items]


@router.get(
    "/object-types/{rid:path}",
    response_model=ObjectTypeResponse,
    operation_id="ontGetV2ObjectType",
)
async def get_object_type(rid: str, request: Request) -> ObjectTypeResponse:
    _ctx(request)
    try:
        ot = await _call_scoped(request, "get_object_type", ClassRef(rid))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _ot_to_dto(ot)


@router.post(
    "/object-types/{rid:path}/properties",
    response_model=ObjectTypeResponse,
    operation_id="ontAppendV2ObjectTypeProperty",
)
async def append_object_type_property(
    rid: str, payload: PropertyDTO, request: Request,
) -> ObjectTypeResponse:
    """增量追加单个 Property 到已存在的 ObjectType。

    实现策略：不引入新 repo method，复用 get + 整体 upsert。
    1. get_object_type → 取出当前 OT（含既有 properties）
    2. 检查 payload.rid 不与既有 properties 重名（防重复 409）
    3. 构造新 OT（properties = 既有 ∪ {new_prop}）
    4. upsert_object_type 写回
    5. 返回更新后的 OT
    """
    _ctx(request)
    try:
        existing = await _call_scoped(request, "get_object_type", ClassRef(rid))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    # 检查 property 是否已存在（rid 重复 → 409）
    existing_prop_rids = {p.rid.rid for p in existing.properties}
    if payload.rid in existing_prop_rids:
        raise HTTPException(
            status_code=409,
            detail=f"Property rid already exists on ObjectType {rid}: {payload.rid}",
        )

    new_prop = _dto_to_prop(payload)
    merged = ObjectType(
        rid=existing.rid,
        primary_key=existing.primary_key,
        properties=existing.properties + (new_prop,),
        display_name=existing.display_name,
        interfaces=existing.interfaces,
    )
    saved = await _call_scoped(request, "upsert_object_type", merged)
    return _ot_to_dto(saved)


# ─────────────────── 2) Individual CRUD ───────────────────


@router.post(
    "/individuals",
    response_model=IndividualResponse,
    operation_id="ontCreateV2Individual",
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
    now = datetime.now(UTC)
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
    saved = await _call_scoped(request, "create_individual", ind)
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
    operation_id="ontListV2Individuals",
)
async def list_individuals(
    request: Request, class_rid: str | None = None,
) -> list[IndividualResponse]:
    """List individuals; class_rid 过滤。"""
    ctx = _ctx(request)
    cls_ref = ClassRef(class_rid) if class_rid else None
    if cls_ref and not cls_ref.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant access denied")
    items = await _call_scoped(request, "list_individuals", cls_ref)
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
    results = await _call_scoped(request, "evaluate_object_set", os_)
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


async def _apply_action(request: Request, action_rid: str, payload: ActionApplyBodyDTO) -> ActionApplyResponse:
    import uuid

    ctx = _ctx(request)
    rid_ref = ClassRef(action_rid)
    if not rid_ref.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant action denied")
    provenance = {**payload.provenance, "actor": ctx.user_id}  # type: ignore[attr-defined]
    try:
        applied_at, side_effects = await _call_scoped(request, "apply_action",
            action_rid=rid_ref,
            target_iid=payload.target_iid,
            parameters=payload.parameters,
            provenance=provenance,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ActionApplyResponse(
        action_rid=rid_ref.rid,
        applied_at=applied_at.isoformat(),
        audit_id=str(uuid.uuid4()),
        side_effects_emitted=list(side_effects),
    )


@router.post(
    "/action-types/{rid:path}/apply",
    response_model=ActionApplyResponse,
    operation_id="ontApplyV2ActionType",
)
async def apply_action_by_rid(
    rid: str, payload: ActionApplyBodyDTO, request: Request,
) -> ActionApplyResponse:
    """Apply an ActionType — the only legal write entry (KERNEL-01 基元 6).

    Contract path style: rid in the path, body carries parameters /
    target_iid / provenance. AI/Function/SDK all converge here.
    """
    return await _apply_action(request, rid, payload)


@router.post(
    "/action-types:apply",
    response_model=ActionApplyResponse,
    operation_id="ontApplyV2ActionTypeLegacy",
)
async def apply_action_legacy(
    payload: ActionApplyDTO, request: Request,
) -> ActionApplyResponse:
    """Deprecated alias kept for RUNTIME-MVP-01 compatibility.

    Existing SDK clients call this colon-style path with the action rid
    inside the body. New callers should use `/action-types/{rid}/apply`.
    """
    return await _apply_action(request, payload.action_rid, payload)


# ─────────────────── 5) ActionType CRUD ───────────────────


@router.post(
    "/action-types",
    response_model=ActionTypeDTO,
    operation_id="ontCreateV2ActionType",
)
async def upsert_action_type(
    payload: ActionTypeDTO, request: Request,
) -> ActionTypeDTO:
    """Register an ActionType (write operations route through it)."""
    ctx = _ctx(request)
    at = _dto_to_action_type(payload)
    if not at.rid.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant action denied")
    saved = await _call_scoped(request, "upsert_action_type", at)
    return _action_type_to_dto(saved)


@router.get(
    "/action-types",
    response_model=list[ActionTypeDTO],
    operation_id="ontListV2ActionTypes",
)
async def list_action_types(
    request: Request,
) -> list[ActionTypeDTO]:
    """List registered ActionTypes for the tenant."""
    _ctx(request)
    items = await _call_scoped(request, "list_action_types")
    return [_action_type_to_dto(i) for i in items]


@router.get(
    "/action-types/{rid:path}",
    response_model=ActionTypeDTO,
    operation_id="ontGetV2ActionType",
)
async def get_action_type(rid: str, request: Request) -> ActionTypeDTO:
    _ctx(request)
    try:
        at = await _call_scoped(request, "get_action_type", ClassRef(rid))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _action_type_to_dto(at)


# ─────────────────── 6) LinkType CRUD ───────────────────


@router.post(
    "/link-types",
    response_model=LinkTypeDTO,
    operation_id="ontCreateV2LinkType",
)
async def upsert_link_type(
    payload: LinkTypeDTO, request: Request,
) -> LinkTypeDTO:
    ctx = _ctx(request)
    lt = _dto_to_link_type(payload)
    if not lt.rid.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant link denied")
    saved = await _call_scoped(request, "upsert_link_type", lt)
    return _link_type_to_dto(saved)


@router.get(
    "/link-types",
    response_model=list[LinkTypeDTO],
    operation_id="ontListV2LinkTypes",
)
async def list_link_types(
    request: Request,
) -> list[LinkTypeDTO]:
    _ctx(request)
    items = await _call_scoped(request, "list_link_types")
    return [_link_type_to_dto(i) for i in items]


@router.get(
    "/link-types/{rid:path}",
    response_model=LinkTypeDTO,
    operation_id="ontGetV2LinkType",
)
async def get_link_type(rid: str, request: Request) -> LinkTypeDTO:
    _ctx(request)
    try:
        lt = await _call_scoped(request, "get_link_type", ClassRef(rid))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _link_type_to_dto(lt)


# ─────────────────── 7) Interface CRUD ───────────────────


@router.post(
    "/interfaces",
    response_model=InterfaceDTO,
    operation_id="ontCreateV2Interface",
)
async def upsert_interface(
    payload: InterfaceDTO, request: Request,
) -> InterfaceDTO:
    ctx = _ctx(request)
    i = _dto_to_interface(payload)
    if not i.rid.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant interface denied")
    saved = await _call_scoped(request, "upsert_interface", i)
    return _interface_to_dto(saved)


@router.get(
    "/interfaces",
    response_model=list[InterfaceDTO],
    operation_id="ontListV2Interfaces",
)
async def list_interfaces(
    request: Request,
) -> list[InterfaceDTO]:
    _ctx(request)
    items = await _call_scoped(request, "list_interfaces")
    return [_interface_to_dto(i) for i in items]


# ─────────────────── 8) Individual by rid ───────────────────


@router.get(
    "/individuals/{rid:path}",
    response_model=IndividualResponse,
    operation_id="ontGetV2Individual",
)
async def get_individual(rid: str, request: Request) -> IndividualResponse:
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant access denied")
    try:
        ind = await _call_scoped(request, "get_individual", rid)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _individual_to_response(ind)


# ─────────────────── 9) Axiom CRUD ───────────────────


@router.post(
    "/axioms",
    response_model=AxiomDTO,
    operation_id="ontCreateV2Axiom",
)
async def upsert_axiom(
    payload: AxiomDTO, request: Request,
) -> AxiomDTO:
    ctx = _ctx(request)
    ax = _dto_to_axiom(payload)
    if not ax.rid.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant axiom denied")
    saved = await _call_scoped(request, "upsert_axiom", ax)
    return _axiom_to_dto(saved)


@router.get(
    "/axioms",
    response_model=list[AxiomDTO],
    operation_id="ontListV2Axioms",
)
async def list_axioms(
    request: Request,
) -> list[AxiomDTO]:
    _ctx(request)
    items = await _call_scoped(request, "list_axioms")
    return [_axiom_to_dto(i) for i in items]


# ─────────────────── 10) Function CRUD ───────────────────


@router.post(
    "/functions",
    response_model=FunctionDTO,
    operation_id="ontCreateV2Function",
)
async def upsert_function(
    payload: FunctionDTO, request: Request,
) -> FunctionDTO:
    ctx = _ctx(request)
    f = _dto_to_function(payload)
    if not f.rid.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant function denied")
    saved = await _call_scoped(request, "upsert_function", f)
    return _function_to_dto(saved)


@router.get(
    "/functions",
    response_model=list[FunctionDTO],
    operation_id="ontListV2Functions",
)
async def list_functions(
    request: Request,
) -> list[FunctionDTO]:
    _ctx(request)
    items = await _call_scoped(request, "list_functions")
    return [_function_to_dto(i) for i in items]


# ─────────────────── 11) ObjectSet query（契约路径） ───────────────────


@router.post(
    "/object-sets/query",
    response_model=ObjectSetResult,
    operation_id="ontEvaluateV2ObjectSet",
)
async def query_object_set(
    payload: ObjectSetDTO, request: Request,
) -> ObjectSetResult:
    """Evaluate an ObjectSet query plan — contract path returning {results, count}."""
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
    results = await _call_scoped(request, "evaluate_object_set", os_)
    items = [_individual_to_response(i) for i in results]
    return ObjectSetResult(results=items, count=len(items))


# ─────────────────── 11b) MP-SAL-01: IR 查询 / inspect / agent 工具 ───────────────────


class QueryConditionDTO(BaseModel):
    field: str
    op: str
    value: Any = None


class QueryMetricDTO(BaseModel):
    fn: str
    field: str | None = None
    alias: str | None = None


class QueryAggregationDTO(BaseModel):
    group_by: list[str] = Field(default_factory=list)
    metrics: list[QueryMetricDTO]


class QueryTraversalDTO(BaseModel):
    link_type: str
    direction: str


class QuerySortKeyDTO(BaseModel):
    field: str
    desc: bool = False


class ObjectQueryDTO(BaseModel):
    source: str
    filters: list[QueryConditionDTO] = Field(default_factory=list)
    aggregation: QueryAggregationDTO | None = None
    traversal: list[QueryTraversalDTO] = Field(default_factory=list)
    sort: list[QuerySortKeyDTO] = Field(default_factory=list)
    paging_offset: int = 0
    paging_limit: int = 100


class ObjectQueryResultDTO(BaseModel):
    kind: str
    rows: list[dict[str, Any]] = Field(default_factory=list)
    result_schema: dict[str, Any] | None = None


class InspectLinkDTO(BaseModel):
    link_type: str
    direction: str
    peer_class: str


class ClassInspectDTO(BaseModel):
    rid: str
    display_name: str = ""
    marking: list[str] = Field(default_factory=list)
    properties: list[PropertyDTO] = Field(default_factory=list)
    links: list[InspectLinkDTO] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)


class AgentToolDTO(BaseModel):
    name: str
    description: str = ""
    class_rid: str | None = None
    input_schema: dict[str, Any] = Field(default_factory=dict)
    result_schema: dict[str, Any] | None = None


def _dto_to_ir_query(d: ObjectQueryDTO) -> ObjectSetQuery:
    agg = None
    if d.aggregation is not None:
        agg = Aggregation(
            group_by=tuple(d.aggregation.group_by),
            metrics=tuple(
                MetricSpec(fn=m.fn, field=m.field, alias=m.alias)
                for m in d.aggregation.metrics
            ),
        )
    try:
        return ObjectSetQuery(
            source=d.source,
            filters=tuple(
                Condition(field=c.field, op=QueryOp(c.op), value=c.value)
                for c in d.filters
            ),
            aggregation=agg,
            traversal=tuple(
                TraversalStep(link_type=t.link_type, direction=t.direction)
                for t in d.traversal
            ),
            sort=tuple(SortKey(field=s.field, desc=s.desc) for s in d.sort),
            paging_offset=d.paging_offset,
            paging_limit=d.paging_limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post(
    "/object-query",
    response_model=ObjectQueryResultDTO,
    operation_id="ontExecuteV2ObjectQuery",
)
async def execute_object_query(
    payload: ObjectQueryDTO, request: Request,
) -> ObjectQueryResultDTO:
    """Structured IR query (ADR-0043): filters / aggregation / traversal / multi-key sort."""
    ctx = _ctx(request)
    if not payload.source.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant query denied")
    q = _dto_to_ir_query(payload)
    result = await _call_scoped(request, "execute_object_query", q)
    return ObjectQueryResultDTO(
        kind=result.kind,
        rows=[dict(r) for r in result.rows],
        result_schema=result.result_schema,
    )


@router.get(
    "/classes/{class_rid}/inspect",
    response_model=ClassInspectDTO,
    operation_id="ontInspectV2Class",
)
async def inspect_class(class_rid: str, request: Request) -> ClassInspectDTO:
    """Type introspection for agents (ADR-0043 §2.2)."""
    _ctx(request)
    try:
        ot = await _call_scoped(request, "get_object_type", ClassRef(class_rid))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    link_types = await _call_scoped(request, "list_link_types")
    links: list[InspectLinkDTO] = []
    for lt in link_types:
        if lt.src.rid == class_rid:
            links.append(InspectLinkDTO(
                link_type=lt.rid.rid, direction="out", peer_class=lt.dst.rid,
            ))
        if lt.dst.rid == class_rid:
            links.append(InspectLinkDTO(
                link_type=lt.rid.rid, direction="in", peer_class=lt.src.rid,
            ))
    action_types = await _call_scoped(request, "list_action_types")
    actions = [
        at.rid.rid for at in action_types
        if class_rid in [str(r) for r in getattr(at, "on", ())]
    ]
    return ClassInspectDTO(
        rid=ot.rid.rid,
        display_name=ot.display_name,
        marking=list(ot.marking),
        properties=[_prop_to_dto(p) for p in ot.properties],
        links=links,
        actions=actions,
    )


@router.get(
    "/agent-tools",
    response_model=list[AgentToolDTO],
    operation_id="ontListV2AgentTools",
)
async def list_agent_tools(
    request: Request, markings: str = "",
) -> list[AgentToolDTO]:
    """Virtual registry: tools computed on demand from ont_object_types (zero push sync)."""
    ctx = _ctx(request)
    caller_markings = tuple(m.strip() for m in markings.split(",") if m.strip())

    object_types = await _call_scoped(request, "list_object_types", 10000, 0)
    links = await _call_scoped(request, "list_link_instances")
    schemas = agent_tool_schemas(object_types, links, caller_markings)
    tools: list[AgentToolDTO] = []
    for s in schemas:
        name = s["function"]["name"]
        if not name.startswith("query_"):
            continue
        tools.append(AgentToolDTO(
            name=name,
            description=s["function"].get("description", ""),
            class_rid=_class_rid_of_tool(object_types, name),
            input_schema=s["function"]["parameters"],
        ))
    return tools


def _class_rid_of_tool(
    object_types: list[ObjectType], tool_name: str,
) -> str | None:
    slug = tool_name.removeprefix("query_")
    for ot in object_types:
        if schema_gen.slug_of_rid(ot.rid.rid).replace("-", "_") == slug:
            return ot.rid.rid
    return None


class ObjectSearchDTO(BaseModel):
    text: str
    class_rid: str | None = None
    top_k: int = 5


class ObjectSearchResultDTO(BaseModel):
    cards: list[dict[str, Any]] = Field(default_factory=list)


@router.post(
    "/object-search",
    response_model=ObjectSearchResultDTO,
    operation_id="ontSearchV2Objects",
)
async def search_objects(
    payload: ObjectSearchDTO, request: Request,
) -> ObjectSearchResultDTO:
    """MP-SAL-02: 对象语义检索（OAG）→ 对象卡片（带 rid 可追溯）。"""
    ctx = _ctx(request)
    if payload.class_rid and not payload.class_rid.startswith(
        f"ont.{ctx.tenant_id}.",  # type: ignore[attr-defined]
    ):
        raise HTTPException(status_code=403, detail="cross-tenant search denied")
    cards = await _call_scoped(
        request, "search_objects", payload.text, payload.class_rid, payload.top_k,
    )
    return ObjectSearchResultDTO(cards=cards)


@router.post(
    "/object-search/reindex",
    operation_id="ontReindexV2ObjectSearch",
)
async def reindex_object_search(request: Request) -> dict[str, int]:
    """MP-SAL-02: 存量 Individual 补齐 embedding。"""
    _ctx(request)
    count = await _call_scoped(request, "reindex_object_embeddings")
    return {"indexed": count}


# ─────────────────── 12) LinkInstance CRUD ───────────────────


@router.post(
    "/link-instances",
    response_model=LinkInstanceResponse,
    operation_id="ontCreateV2LinkInstance",
)
async def create_link_instance(
    payload: LinkInstanceDTO, request: Request,
) -> LinkInstanceResponse:
    ctx = _ctx(request)
    tenant_id = ctx.tenant_id  # type: ignore[attr-defined]
    expected_prefix = f"ont.{tenant_id}.lnk."
    if not payload.rid.startswith(expected_prefix):
        raise HTTPException(
            status_code=403,
            detail=f"rid prefix must be {expected_prefix} for tenant {tenant_id}",
        )
    if not payload.link_type_rid.startswith(f"ont.{tenant_id}."):
        raise HTTPException(
            status_code=403,
            detail=f"link_type_rid must be under tenant {tenant_id}",
        )
    now = datetime.now(UTC)
    props_tuple = tuple(
        (ClassRef(p_rid), payload.props[p_rid].get("value"))
        for p_rid in payload.props
    )
    li = LinkInstance(
        rid=payload.rid,
        link_type_rid=ClassRef(payload.link_type_rid),
        src=payload.src,
        dst=payload.dst,
        props=props_tuple,
        created_at=now,
        tenant_id=tenant_id,
        marking=tuple(payload.marking),
    )
    saved = await _call_scoped(request, "create_link_instance", li)
    return _link_instance_to_response(saved)


@router.get(
    "/link-instances",
    response_model=list[LinkInstanceResponse],
    operation_id="ontListV2LinkInstances",
)
async def list_link_instances(
    request: Request,
) -> list[LinkInstanceResponse]:
    _ctx(request)
    items = await _call_scoped(request, "list_link_instances")
    return [_link_instance_to_response(i) for i in items]


# ─────────────────── 13) Version snapshot ───────────────────


@router.get(
    "/versions/{class_rid:path}",
    response_model=list[VersionDTO],
    operation_id="ontListV2Versions",
)
async def list_versions(class_rid: str, request: Request) -> list[VersionDTO]:
    ctx = _ctx(request)
    if not class_rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant access denied")
    items = await _call_scoped(request, "list_versions", ClassRef(class_rid))
    return [_version_to_dto(v) for v in items]


@router.post(
    "/versions/{class_rid:path}",
    response_model=VersionDTO,
    operation_id="ontCreateV2Version",
)
async def snapshot_version(
    class_rid: str, payload: VersionCreateDTO, request: Request,
) -> VersionDTO:
    ctx = _ctx(request)
    if not class_rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant access denied")
    v = await _call_scoped(request, "snapshot_version",
        ClassRef(payload.class_ref),
        payload.author,
        payload.parent_rid,
        tuple(payload.change_set),
    )
    return _version_to_dto(v)


__all__ = ["router"]
