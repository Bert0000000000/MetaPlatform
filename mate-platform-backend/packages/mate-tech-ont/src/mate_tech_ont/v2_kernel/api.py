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

from mate_kernel.action.engine import ProposalNotConfirmed
from mate_kernel.objectset.ir import (
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
from .pg_repo import SlugConflictError  # MP-DEDUP-01: 409 翻译
from .similarity import search_similar_object_types  # MP-DEDUP-01: precheck 相似扫描

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
    """Upsert an ObjectType — registers Property + Class in kernel repo.

    MP-DEDUP-01：DB UNIQUE (tenant_id, slug) 触发 → 409 + 建议合并到已有 rid。
    """
    ot = _dto_to_ot(payload)
    try:
        saved = await _call_scoped(request, "upsert_object_type", ot)
    except SlugConflictError as e:
        # 409 + 让前端引导用户 precheck / merge
        raise HTTPException(
            status_code=409,
            detail={
                "error": "slug_conflict",
                "message": str(e),
                "existing_rid": e.existing_rid,
                "existing_display_name": e.existing_display_name,
                "slug": e.slug,
                "hint": "Call POST /v2/object-types/precheck to find similar types, "
                        "or POST /v2/object-types/merge to merge into the existing one.",
            },
        ) from e
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
    ctx = _ctx(request)
    items = await _call_scoped(
        request, "list_object_types", limit=limit, offset=offset,
        tenant_id=str(ctx.tenant_id),  # type: ignore[attr-defined]
    )
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
    except ProposalNotConfirmed as e:
        # MP-SAL-04：未确认/已拒绝/不匹配的 proposal 永不落库（北极星 negative）
        raise HTTPException(status_code=409, detail=str(e)) from e
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
    MP-SAL-04：provenance.proposal_id 现在被引擎真正校验（未确认永不落库）。
    """
    return await _apply_action(request, rid, payload)


# ─────────────────── MP-SAL-04: Proposal 状态机端点（ADR-0044 §2.4）───────────────────


class ProposalCreateDTO(BaseModel):
    parameters: dict[str, Any] = Field(default_factory=dict)
    target_iid: str = ""
    impact_summary: str = ""
    expected_diff: dict[str, Any] = Field(default_factory=dict)


class ProposalConfirmDTO(BaseModel):
    confirmed_by: str = ""


class ProposalResponse(BaseModel):
    proposal_id: str
    action_rid: str
    target_iid: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    impact_summary: str = ""
    expected_diff: dict[str, Any] = Field(default_factory=dict)
    status: str
    kind: str = "action"
    confirmed_by: str | None = None
    created_at: str = ""
    confirmed_at: str | None = None


def _proposal_to_dto(p: Any) -> ProposalResponse:
    return ProposalResponse(
        proposal_id=p.proposal_id,
        action_rid=p.action_rid,
        target_iid=p.target_iid,
        parameters=dict(p.parameters),
        impact_summary=p.impact_summary,
        expected_diff=dict(p.expected_diff),
        status=p.status.value,
        kind=getattr(p, "kind", "action"),
        confirmed_by=p.confirmed_by,
        created_at=p.created_at.isoformat() if p.created_at else "",
        confirmed_at=p.confirmed_at.isoformat() if p.confirmed_at else None,
    )


class InstanceProposeDTO(BaseModel):
    """MP-SAL-04b：文本抽取字段 → 新建实例提议。"""

    props: dict[str, Any] = Field(default_factory=dict)
    impact_summary: str = ""
    expected_diff: dict[str, Any] = Field(default_factory=dict)


class TypeProposeDTO(BaseModel):
    """MP-SAL-04b：文本 → 新类型定义提议。"""

    type_def: ObjectTypeDTO
    impact_summary: str = ""


class ProposalExecuteResultDTO(BaseModel):
    kind: str
    individual_rid: str | None = None
    type_rid: str | None = None
    # MP-DEDUP-01：merge_suggestion 落库后返回 merge 摘要
    source_rid: str | None = None
    target_rid: str | None = None
    affected_individuals: int | None = None
    affected_links: int | None = None


@router.post(
    "/classes/{class_rid}/propose-instance",
    response_model=ProposalResponse,
    operation_id="ontProposeV2Instance",
)
async def propose_instance(
    class_rid: str, payload: InstanceProposeDTO, request: Request,
) -> ProposalResponse:
    """MP-SAL-04b：AI 从文本抽取的字段 → 新建实例提议（kind=create_instance，不落库）。"""
    ctx = _ctx(request)
    if not class_rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant propose denied")
    try:
        prop = await _call_scoped(
            request, "propose_create_instance", class_rid,
            payload.props, payload.impact_summary, payload.expected_diff or None,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _proposal_to_dto(prop)


@router.post(
    "/object-types/propose",
    response_model=ProposalResponse,
    operation_id="ontProposeV2ObjectType",
)
async def propose_object_type(
    payload: TypeProposeDTO, request: Request,
) -> ProposalResponse:
    """MP-SAL-04b：AI 辅助建模提议（kind=model_type；确认后经 execute 落库）。"""
    ctx = _ctx(request)
    type_def = payload.type_def.model_dump()
    if not type_def["rid"].startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant propose denied")
    prop = await _call_scoped(
        request, "propose_model_type", type_def, payload.impact_summary,
    )
    return _proposal_to_dto(prop)


@router.post(
    "/proposals/{proposal_id}/execute",
    response_model=ProposalExecuteResultDTO,
    operation_id="ontExecuteV2Proposal",
)
async def execute_proposal(
    proposal_id: str, request: Request,
) -> ProposalExecuteResultDTO:
    """MP-SAL-04b / MP-DEDUP-01：confirmed proposal 落库执行。

    - create_instance → 新建实例
    - model_type → upsert 类型
    - merge_suggestion → 自动触发 merge_object_types，archived source
    - action → 409 指引走 /apply
    """
    _ctx(request)
    try:
        out = await _call_scoped(request, "execute_proposal", proposal_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ProposalNotConfirmed as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    if isinstance(out, dict) and out.get("source_rid") and out.get("target_rid"):
        # MP-DEDUP-01：merge_suggestion 落库
        return ProposalExecuteResultDTO(
            kind="merge_suggestion",
            source_rid=out["source_rid"],
            target_rid=out["target_rid"],
            affected_individuals=out.get("affected_individuals", 0),
            affected_links=out.get("affected_links", 0),
        )
    if hasattr(out, "class_rid"):  # Individual
        return ProposalExecuteResultDTO(kind="create_instance", individual_rid=out.rid)
    return ProposalExecuteResultDTO(kind="model_type", type_rid=out.rid.rid)


@router.post(
    "/action-types/{rid:path}/propose",
    response_model=ProposalResponse,
    operation_id="ontProposeV2ActionType",
)
async def propose_action(
    rid: str, payload: ProposalCreateDTO, request: Request,
) -> ProposalResponse:
    """AI/用户提议（ADR-0044）：产出 pending proposal（含预期 diff），不落库。"""
    ctx = _ctx(request)
    rid_ref = ClassRef(rid)
    if not rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant propose denied")
    try:
        prop = await _call_scoped(
            request, "propose_action", rid_ref,
            payload.parameters, payload.target_iid or None,
            payload.impact_summary, payload.expected_diff or None,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _proposal_to_dto(prop)


# ─────────────────── 1b) MP-DEDUP-01: precheck / merge / propose-merge ───────────────────


class ObjectTypePrecheckDTO(BaseModel):
    """precheck 入参：候选 (display_name, slug, domain)。

    domain 仅作为 hint 元数据透传（v1 不参与过滤）。"""
    name: str
    slug: str
    domain: str = ""
    top_k: int = 5


class ObjectTypeCandidateDTO(BaseModel):
    rid: str
    display_name: str
    slug: str
    similarity: float
    suggested_action: str  # merge | rename | cancel


class ObjectTypePrecheckResponse(BaseModel):
    candidates: list[ObjectTypeCandidateDTO] = Field(default_factory=list)


@router.post(
    "/object-types/precheck",
    response_model=ObjectTypePrecheckResponse,
    operation_id="ontPrecheckV2ObjectType",
)
async def precheck_object_type(
    payload: ObjectTypePrecheckDTO, request: Request,
) -> ObjectTypePrecheckResponse:
    """MP-DEDUP-01：创建前相似扫描 —— 找到候选后再决定走 merge / rename。

    不写库，纯只读。embedder 未配置时 fallback 到 slug 归一化（去 ``-`` / ``_``，
    子串 / 前缀打分），保证 dev 路径可用。
    """
    ctx = _ctx(request)
    tenant_id = str(ctx.tenant_id)  # type: ignore[attr-defined]
    repo = _repo(request)
    # _call_scoped 推 threadpool 会丢失 threading.local tenant；显式传 tenant_id
    cands = await asyncio.to_thread(
        search_similar_object_types,
        repo, tenant_id, payload.name, payload.slug, payload.top_k,
    )
    return ObjectTypePrecheckResponse(
        candidates=[ObjectTypeCandidateDTO(**c) for c in cands],
    )


class MergeObjectTypeDTO(BaseModel):
    """Merge 入参：source / target rid + 可选 Property 映射。

    mapping 缺省 → 按 Property slug 兜底（source prop rid 第 4 段 slug
    对应到 target prop rid）。"""
    source_rid: str
    target_rid: str
    mapping: dict[str, str] = Field(default_factory=dict)


class MergeObjectTypeResponse(BaseModel):
    source_rid: str
    target_rid: str
    mapping: dict[str, str] = Field(default_factory=dict)
    affected_individuals: int = 0
    affected_links: int = 0
    source_archived: bool = True


@router.post(
    "/object-types/merge",
    response_model=MergeObjectTypeResponse,
    operation_id="ontMergeV2ObjectTypes",
)
async def merge_object_types(
    payload: MergeObjectTypeDTO, request: Request,
) -> MergeObjectTypeResponse:
    """MP-DEDUP-01：source → target 重映射 + 软删 source。

    重映射范围：
    - Individual.class_rid: source → target
    - Individual.rid: rid 中的 source slug 替换为 target slug
    - LinkInstance.src / dst: Individual rid 同步替换
    - Individual.props JSONB 键: source Property rid → target Property rid

    source 设置 archived=true，UNIQUE INDEX 自动让出 slug，可后续复用。
    """
    ctx = _ctx(request)
    tenant_id = str(ctx.tenant_id)  # type: ignore[attr-defined]
    if not payload.source_rid.startswith(f"ont.{tenant_id}."):
        raise HTTPException(status_code=403, detail="cross-tenant merge denied")
    if not payload.target_rid.startswith(f"ont.{tenant_id}."):
        raise HTTPException(status_code=403, detail="cross-tenant merge denied")
    try:
        result = await _call_scoped(
            request, "merge_object_types",
            payload.source_rid, payload.target_rid, payload.mapping,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return MergeObjectTypeResponse(**result)


class MergeProposalDTO(BaseModel):
    """AI 提议合并的入参。

    similarity 透传到 proposal.parameters 用于前端展示。"""
    source_rid: str
    target_rid: str
    similarity: float = 0.0
    impact_summary: str = ""
    mapping: dict[str, str] = Field(default_factory=dict)


@router.post(
    "/object-types/propose-merge",
    response_model=ProposalResponse,
    operation_id="ontProposeV2ObjectTypeMerge",
)
async def propose_object_type_merge(
    payload: MergeProposalDTO, request: Request,
) -> ProposalResponse:
    """MP-DEDUP-01：AI 提议两个 ObjectType 可能相同 → 走 proposal 状态机。

    user confirm → 自动调 ``execute_proposal`` → 触发 merge_object_types。
    """
    ctx = _ctx(request)
    tenant_id = str(ctx.tenant_id)  # type: ignore[attr-defined]
    if not payload.source_rid.startswith(f"ont.{tenant_id}."):
        raise HTTPException(status_code=403, detail="cross-tenant propose denied")
    if not payload.target_rid.startswith(f"ont.{tenant_id}."):
        raise HTTPException(status_code=403, detail="cross-tenant propose denied")
    try:
        prop = await _call_scoped(
            request, "propose_merge",
            payload.source_rid, payload.target_rid,
            payload.similarity, payload.impact_summary, payload.mapping,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _proposal_to_dto(prop)


class ActionFlowUpsertDTO(BaseModel):
    """MP-SAL-05：流程编排定义持久化（FlowGram WorkflowJSON + 字段配置）。"""

    flow_json: dict[str, Any]
    config: dict[str, Any] = Field(default_factory=dict)


class ActionFlowResponse(BaseModel):
    action_rid: str
    flow_json: dict[str, Any]
    config: dict[str, Any] = Field(default_factory=dict)
    updated_at: str = ""


@router.get(
    "/action-types/{rid:path}/flow",
    response_model=ActionFlowResponse,
    operation_id="ontGetV2ActionFlow",
)
async def get_action_flow(rid: str, request: Request) -> ActionFlowResponse:
    """MP-SAL-05：读取 ActionType 的流程编排定义（未保存 → 404）。"""
    _ctx(request)
    try:
        d = await _call_scoped(request, "get_flow_definition", ClassRef(rid))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return ActionFlowResponse(
        action_rid=d["action_rid"], flow_json=d["flow_json"], config=d["config"],
        updated_at=str(d.get("updated_at") or ""),
    )


@router.put(
    "/action-types/{rid:path}/flow",
    response_model=ActionFlowResponse,
    operation_id="ontPutV2ActionFlow",
)
async def put_action_flow(
    rid: str, payload: ActionFlowUpsertDTO, request: Request,
) -> ActionFlowResponse:
    """MP-SAL-05：持久化 ActionType 的流程编排定义（upsert）。"""
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant flow denied")
    d = await _call_scoped(
        request, "put_flow_definition", ClassRef(rid),
        payload.flow_json, payload.config,
    )
    return ActionFlowResponse(
        action_rid=d["action_rid"], flow_json=d["flow_json"], config=d["config"],
        updated_at=str(d.get("updated_at") or ""),
    )


@router.get(
    "/proposals/{proposal_id}",
    response_model=ProposalResponse,
    operation_id="ontGetV2Proposal",
)
async def get_proposal(proposal_id: str, request: Request) -> ProposalResponse:
    _ctx(request)
    try:
        prop = await _call_scoped(request, "get_proposal", proposal_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _proposal_to_dto(prop)


@router.post(
    "/proposals/{proposal_id}/confirm",
    response_model=ProposalResponse,
    operation_id="ontConfirmV2Proposal",
)
async def confirm_proposal(
    proposal_id: str, payload: ProposalConfirmDTO, request: Request,
) -> ProposalResponse:
    """用户确认（pending → confirmed）。只能由用户侧发起——不是 LLM 工具。"""
    _ctx(request)
    try:
        prop = await _call_scoped(
            request, "confirm_proposal", proposal_id, payload.confirmed_by,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return _proposal_to_dto(prop)


@router.post(
    "/proposals/{proposal_id}/reject",
    response_model=ProposalResponse,
    operation_id="ontRejectV2Proposal",
)
async def reject_proposal(
    proposal_id: str, payload: ProposalConfirmDTO, request: Request,
) -> ProposalResponse:
    _ctx(request)
    try:
        prop = await _call_scoped(
            request, "reject_proposal", proposal_id, payload.confirmed_by,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return _proposal_to_dto(prop)


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


# ─────────────────── 4b) MP-SAL-04c: Staging Preview（pending proposal 渲染） ───────────────────


class ProposalPreviewResponse(BaseModel):
    """MP-SAL-04c：pending proposal 渲染预览（不落库）。

    字段说明：
    - kind: action / create_instance / model_type / merge_suggestion
    - action_type: 后端建议的动作标签（"create" / "upsert" / "execute" / "apply"）
    - impact_summary: 自动算出的影响摘要（受影响个体数 / 跨 schema 引用 / etc）
    - parameters: 原样透传 proposals.parameters（结构化）
    - expected_diff: 原样透传 proposals.expected_diff
    - 额外 kind-specific 字段：properties / field_values / merge_mapping / etc
    """

    proposal_id: str
    kind: str
    action_type: str
    target_rid: str | None = None
    status: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    expected_diff: dict[str, Any] = Field(default_factory=dict)
    impact_summary: dict[str, Any] = Field(default_factory=dict)
    # kind=model_type 专用
    properties: list[dict[str, Any]] = Field(default_factory=list)
    primary_key: list[str] = Field(default_factory=list)
    interfaces: list[str] = Field(default_factory=list)
    display_name: str = ""
    backward_link_candidates: list[str] = Field(default_factory=list)
    # kind=create_instance 专用
    field_values: dict[str, Any] = Field(default_factory=dict)
    class_rid: str | None = None
    validation_status: str = "unknown"
    # kind=merge_suggestion 专用
    merge_source_rid: str | None = None
    merge_target_rid: str | None = None
    merge_mapping: dict[str, str] = Field(default_factory=dict)
    merge_property_overlap: dict[str, Any] = Field(default_factory=dict)
    # 通用 audit
    created_at: str = ""
    confirmed_by: str | None = None
    confirmed_at: str | None = None


_PREVIEW_LOCK_STATES = {"confirmed", "applied", "rejected"}
_PREVIEW_LOCK_MESSAGES = {
    "confirmed": "proposal already confirmed; further preview not allowed",
    "applied": "proposal already applied; preview not available (look at audit)",
    "rejected": "proposal already rejected; cannot preview",
}


def _slug_from_rid(rid: str) -> str:
    parts = (rid or "").split(".")
    if len(parts) >= 5:
        return parts[3]
    return ""


async def _render_model_type_preview(
    request: Request, tenant_id: str, parameters: dict[str, Any],
) -> dict[str, Any]:
    """compute kind=model_type preview payload（不含 proposal metadata）。"""
    type_def = parameters.get("type_def") or {}
    if not isinstance(type_def, dict):
        type_def = {}
    raw_props = type_def.get("properties") or []
    pk = type_def.get("primary_key") or []
    if isinstance(pk, str):
        pk = [pk]
    interfaces = list(type_def.get("interfaces") or [])
    display_name = str(type_def.get("display_name") or "")
    rid = str(type_def.get("rid") or "")
    slug = _slug_from_rid(rid)

    properties: list[dict[str, Any]] = []
    pk_in_props: list[str] = []
    for p in raw_props:
        if not isinstance(p, dict):
            continue
        p_rid = str(p.get("rid") or "")
        properties.append({
            "rid": p_rid,
            "name": _slug_from_rid(p_rid),
            "type_id": str(p.get("type_id") or "string"),
            "nullable": bool(p.get("nullable", False)),
            "primary_key": bool(p.get("primary_key", False)),
            "title": str(p.get("title") or ""),
            "format": str(p.get("format") or "string"),
        })
        if p.get("primary_key"):
            pk_in_props.append(p_rid)
    pk_rids = [r for r in pk if isinstance(r, str)] if isinstance(pk, list) else []
    if not pk_rids:
        pk_rids = pk_in_props

    # 反向引用 —— 已有同 tenant 内引用本 slug 的 Property rid / LinkType 都视作反向引用
    backward: list[str] = []
    try:
        all_ots = await _call_scoped(
            request, "list_object_types", 10000, 0, tenant_id,
        )
        for ot in all_ots:
            other_slug = _slug_from_rid(ot.rid.rid)
            if other_slug == slug:
                continue
            for p in getattr(ot, "properties", ()):
                p_rid = getattr(p.rid, "rid", "") if hasattr(p, "rid") else str(p)
                if slug and slug in p_rid:
                    backward.append(str(p_rid))
                    break
    except Exception:
        # 预览阶段容错：repo 抛错时不影响主字段
        backward = []

    return {
        "properties": properties,
        "primary_key": pk_rids,
        "interfaces": interfaces,
        "display_name": display_name,
        "backward_link_candidates": backward,
    }


async def _render_create_instance_preview(
    request: Request, tenant_id: str, parameters: dict[str, Any],
    fallback_class_rid: str = "",
) -> dict[str, Any]:
    """compute kind=create_instance preview payload。

    参数来源：
    1) 直传 ``{class_rid, props}``（LLM / 手动路径）
    2) InMemory/PG.propose_create_instance 包装为 ``{"props": ...}``，class_rid 由
       proposal.action_rid 字段承担 —— fallback 用 ``fallback_class_rid``。
    """
    class_rid = ""
    props: dict[str, Any] = {}
    if "class_rid" in parameters:
        class_rid = str(parameters.get("class_rid") or "")
        props = dict(parameters.get("props") or {})
    elif "props" in parameters and isinstance(parameters.get("props"), dict):
        props = dict(parameters["props"])
    if not class_rid:
        class_rid = fallback_class_rid
    field_values: dict[str, Any] = {}
    for k, v in props.items():
        key = str(k)
        if isinstance(v, dict) and "value" in v:
            field_values[key] = v["value"]
        else:
            field_values[key] = v
    validation_status = "ok"
    note: list[str] = []
    try:
        if class_rid:
            ot = await _call_scoped(
                request, "get_object_type", ClassRef(class_rid),
            )
            required_props = [
                getattr(p.rid, "rid", "") for p in getattr(ot, "properties", ())
                if getattr(p, "primary_key", False) or not getattr(p, "nullable", True)
            ]
            missing = [r for r in required_props if r and r not in field_values]
            if missing:
                validation_status = "missing_required"
                note.append(f"missing required props: {missing}")
            elif not field_values:
                validation_status = "empty"
                note.append("no props provided")
    except KeyError:
        validation_status = "class_not_found"
        note.append(f"class not found: {class_rid}")
    except Exception as e:
        validation_status = "validation_error"
        note.append(f"{type(e).__name__}: {e}")

    out: dict[str, Any] = {
        "field_values": field_values,
        "class_rid": class_rid,
        "validation_status": validation_status,
    }
    if note:
        out["note"] = note
    return out


async def _render_merge_suggestion_preview(
    request: Request, tenant_id: str, parameters: dict[str, Any],
) -> dict[str, Any]:
    """compute kind=merge_suggestion preview payload。"""
    src = str(parameters.get("source_rid") or "")
    tgt = str(parameters.get("target_rid") or "")
    mapping_raw = parameters.get("mapping") or {}
    if not isinstance(mapping_raw, dict):
        mapping_raw = {}
    mapping: dict[str, str] = {str(k): str(v) for k, v in mapping_raw.items()}

    overlap: dict[str, Any] = {"shared_props": [], "source_only": [], "target_only": []}
    try:
        src_ot = await _call_scoped(
            request, "get_object_type", ClassRef(src),
        )
        tgt_ot = await _call_scoped(
            request, "get_object_type", ClassRef(tgt),
        )
        src_names = {getattr(p.rid, "rid", ""): getattr(p, "title", "") for p in src_ot.properties}
        tgt_names = {getattr(p.rid, "rid", ""): getattr(p, "title", "") for p in tgt_ot.properties}
        overlap["source_only"] = list(src_names.keys())
        overlap["target_only"] = list(tgt_names.keys())
        for p_rid, _title in src_names.items():
            p_slug = _slug_from_rid(p_rid).split("-")[-1]
            for t_rid, _t_title in tgt_names.items():
                t_slug = _slug_from_rid(t_rid).split("-")[-1]
                if p_slug and p_slug == t_slug:
                    overlap["shared_props"].append({
                        "source": p_rid, "target": t_rid,
                        "auto_mapped": p_rid not in mapping,
                    })
                    break
    except KeyError as e:
        overlap = {"shared_props": [], "source_only": [], "target_only": [],
                   "error": f"class not found: {e}"}
    except Exception as e:
        overlap = {"shared_props": [], "source_only": [], "target_only": [],
                   "error": f"{type(e).__name__}: {e}"}

    return {
        "merge_source_rid": src,
        "merge_target_rid": tgt,
        "merge_mapping": mapping,
        "merge_property_overlap": overlap,
    }


def _render_action_preview(parameters: dict[str, Any]) -> dict[str, Any]:
    """kind=action（apply 路径）—— 不在 preview 内执行，仅透传参数。"""
    return {
        "note": "action-kind proposals execute via /action-types/{rid}/apply, not /execute; "
                "preview only shows intended parameters."
    }


@router.get(
    "/proposals/{proposal_id}/preview",
    response_model=ProposalPreviewResponse,
    operation_id="ontPreviewV2Proposal",
)
async def get_proposal_preview(
    proposal_id: str, request: Request,
) -> ProposalPreviewResponse:
    """MP-SAL-04c：pending proposal 渲染（前端 staging 卡片用）。

    返回 proposal 的渲染信息 + 自动算出的 ``impact_summary``：
    - kind=model_type：受影响 Property 表 / 主键 / interface / 反向引用列表
    - kind=create_instance：字段值 / class 关联 / 验证状态
    - kind=merge_suggestion：source/target 对比 + property mapping 建议
    - kind=action：透传参数 + 提示走 /apply

    已确认/已应用/已拒绝的 proposal 返回 409（preview 已不可改）。
    """
    from mate_kernel.action.engine import ProposalStatus  # local import 避免 module 循环
    ctx = _ctx(request)
    tenant_id = str(ctx.tenant_id)  # type: ignore[attr-defined]
    try:
        prop = await _call_scoped(request, "get_proposal", proposal_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    status_value = (
        prop.status.value if hasattr(prop.status, "value") else str(prop.status)
    )
    if status_value in _PREVIEW_LOCK_STATES:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "proposal_locked",
                "message": _PREVIEW_LOCK_MESSAGES[status_value],
                "proposal_id": proposal_id,
                "status": status_value,
            },
        )

    parameters = dict(getattr(prop, "parameters", {}) or {})
    expected_diff = dict(getattr(prop, "expected_diff", {}) or {})
    extra: dict[str, Any] = {}

    kind = str(getattr(prop, "kind", "action") or "action")
    target_rid = str(getattr(prop, "action_rid", "") or "")
    action_type = "execute"
    if kind == "model_type":
        action_type = "upsert"
        try:
            extra = await _render_model_type_preview(request, tenant_id, parameters)
        except Exception as e:
            extra = {"error": f"{type(e).__name__}: {e}"}
    elif kind == "create_instance":
        action_type = "create"
        try:
            extra = await _render_create_instance_preview(
                request, tenant_id, parameters,
                fallback_class_rid=target_rid,
            )
        except Exception as e:
            extra = {"class_rid": target_rid,
                     "validation_status": "validation_error",
                     "field_values": {},
                     "error": f"{type(e).__name__}: {e}"}
    elif kind == "merge_suggestion":
        action_type = "execute"
        try:
            extra = await _render_merge_suggestion_preview(request, tenant_id, parameters)
        except Exception as e:
            extra = {"merge_source_rid": parameters.get("source_rid", ""),
                     "merge_target_rid": parameters.get("target_rid", ""),
                     "merge_mapping": {},
                     "merge_property_overlap": {},
                     "error": f"{type(e).__name__}: {e}"}
    else:  # action
        action_type = "apply"
        extra = _render_action_preview(parameters)

    try:
        impact_summary = await _compute_impact_summary(
            kind=kind, request=request, tenant_id=tenant_id,
            parameters=parameters, target_rid=target_rid, extra=extra,
        )
    except Exception as e:
        impact_summary = {"error": f"{type(e).__name__}: {e}"}

    created_at = getattr(prop, "created_at", None)
    confirmed_at = getattr(prop, "confirmed_at", None)
    confirmed_by = getattr(prop, "confirmed_by", None)
    return ProposalPreviewResponse(
        proposal_id=proposal_id,
        kind=kind,
        action_type=action_type,
        target_rid=target_rid or None,
        status=status_value,
        parameters=parameters,
        expected_diff=expected_diff,
        impact_summary=impact_summary,
        properties=extra.get("properties", []),
        primary_key=extra.get("primary_key", []),
        interfaces=extra.get("interfaces", []),
        display_name=extra.get("display_name", ""),
        backward_link_candidates=extra.get("backward_link_candidates", []),
        field_values=extra.get("field_values", {}),
        class_rid=extra.get("class_rid"),
        validation_status=extra.get("validation_status", "unknown"),
        merge_source_rid=extra.get("merge_source_rid"),
        merge_target_rid=extra.get("merge_target_rid"),
        merge_mapping=extra.get("merge_mapping", {}),
        merge_property_overlap=extra.get("merge_property_overlap", {}),
        created_at=created_at.isoformat() if created_at else "",
        confirmed_by=confirmed_by,
        confirmed_at=confirmed_at.isoformat() if confirmed_at else None,
    )


async def _compute_impact_summary(
    *,
    kind: str,
    request: Request,
    tenant_id: str,
    parameters: dict[str, Any],
    target_rid: str,
    extra: dict[str, Any],
) -> dict[str, Any]:
    """MP-SAL-04c：根据 proposal kind 自动算影响摘要。"""
    summary: dict[str, Any] = {
        "kind": kind,
        "tenant_id": tenant_id,
        "warnings": [],
    }

    if kind == "model_type":
        type_def = parameters.get("type_def") or {}
        rid = str(type_def.get("rid") or target_rid or "")
        properties = extra.get("properties", []) or []
        primary_key = extra.get("primary_key", []) or []
        backward = extra.get("backward_link_candidates", []) or []
        summary.update({
            "new_object_type_rid": rid,
            "new_property_count": len(properties),
            "primary_key": primary_key,
            "interfaces": extra.get("interfaces", []) or [],
            "backward_link_candidates": backward,
            "affected_individuals_estimate": 0,
            "affected_link_instances_estimate": 0,
        })
        if backward:
            summary["warnings"].append(
                f"{len(backward)} properties from other ObjectTypes seem to reference "
                f"this slug's name; after apply, you may want to consolidate via merge."
            )
        cross_refs: list[dict[str, str]] = []
        for r in backward:
            cross_refs.append({"source_property_rid": str(r)})
        summary["cross_schema_references"] = cross_refs

    elif kind == "create_instance":
        class_rid = extra.get("class_rid") or ""
        validation = extra.get("validation_status", "unknown")
        field_values = extra.get("field_values", {}) or {}
        existing_count = 0
        try:
            if class_rid:
                rows = await _call_scoped(
                    request, "list_individuals", ClassRef(class_rid),
                )
                existing_count = len(rows)
        except Exception:
            existing_count = 0
        summary.update({
            "class_rid": class_rid,
            "field_count": len(field_values),
            "validation_status": validation,
            "affected_individuals_estimate": 1,
            "existing_individuals_in_class": existing_count,
            "cross_schema_references": [],
        })
        if validation in {"missing_required", "empty"}:
            summary["warnings"].append(
                f"validation status={validation}; user will need to refill fields before confirm."
            )

    elif kind == "merge_suggestion":
        src = str(parameters.get("source_rid") or "")
        tgt = str(parameters.get("target_rid") or "")
        mapping = extra.get("merge_mapping", {}) or {}
        overlap = extra.get("merge_property_overlap", {}) or {}
        ind_count, li_count = 0, 0
        try:
            inds = await _call_scoped(
                request, "list_individuals", ClassRef(src),
            )
            lis = await _call_scoped(request, "list_link_instances")
            ind_count = len(inds)
            li_count = sum(1 for li in lis if li.src.startswith(src) or li.dst.startswith(src))
        except Exception:
            pass
        try:
            similarity = float(parameters.get("similarity") or 0.0)
        except (TypeError, ValueError):
            similarity = 0.0
        summary.update({
            "source_rid": src,
            "target_rid": tgt,
            "similarity": similarity,
            "mapping_count": len(mapping),
            "shared_property_count": len(overlap.get("shared_props", []) or []),
            "affected_individuals": ind_count,
            "affected_links": li_count,
            "cross_schema_references": [
                {"source_property_rid": str(p.get("source"))}
                for p in (overlap.get("shared_props", []) or [])
            ],
        })
        if similarity < 0.7:
            summary["warnings"].append(
                f"similarity={similarity:.2f} below safe-merge floor (0.7); user must confirm explicitly."
            )

    else:  # action
        summary.update({
            "target_action_rid": target_rid,
            "parameters_keys": list(parameters.keys()),
            "affected_individuals_estimate": 1,
        })

    return summary


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

    object_types = await _call_scoped(
        request, "list_object_types", 10000, 0,
        str(ctx.tenant_id),  # type: ignore[attr-defined]  # 显式租户（thread-local 不可见）
    )
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
        str(ctx.tenant_id),  # type: ignore[attr-defined]  # to_thread 下 thread-local 不可见，显式传租户
    )
    return ObjectSearchResultDTO(cards=cards)


@router.post(
    "/object-search/reindex",
    operation_id="ontReindexV2ObjectSearch",
)
async def reindex_object_search(request: Request) -> dict[str, int]:
    """MP-SAL-02: 存量 Individual 补齐 embedding（租户内）。"""
    ctx = _ctx(request)
    count = await _call_scoped(
        request, "reindex_object_embeddings", str(ctx.tenant_id),  # type: ignore[attr-defined]
    )
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
