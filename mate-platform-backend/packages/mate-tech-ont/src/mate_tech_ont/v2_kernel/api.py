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

import structlog

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

_logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/ont/v2", tags=["v2-kernel"])


# ─────────────────── DTO ───────────────────


class DerivedSpecDTO(BaseModel):
    """EXP-02：派生属性规格（D4：v1 声明式聚合）。field 须为完整 Property rid。"""
    fn: str  # count | sum | avg
    over_link: str  # LinkType rid
    field: str | None = None


class PropertyDTO(BaseModel):
    rid: str
    type_id: str
    nullable: bool = False
    primary_key: bool = False
    title: str = ""
    format: str = "string"
    # ── EXP-02 扩展 ──
    description: str = ""
    struct_fields: list["PropertyDTO"] = Field(default_factory=list)
    array: bool = False
    reducer: str | None = None  # first / latest
    derived: DerivedSpecDTO | None = None
    shared: bool = False


class ObjectTypeDTO(BaseModel):
    rid: str
    primary_key: tuple[str, ...]
    properties: list[PropertyDTO]
    display_name: str = ""
    interfaces: list[str] = Field(default_factory=list)
    marking: list[str] = Field(default_factory=list)
    parent_class: str = ""  # EXP-01：浅层级声明（限 1 层；自动同步 subclass 公理）
    # EXP-04：治理/展示元数据
    description: str = ""
    status: str = "active"
    type_group: str = ""
    render_hints: list[tuple[str, str]] = Field(default_factory=list)


class ObjectTypeResponse(BaseModel):
    rid: str
    primary_key: tuple[str, ...]
    properties: list[PropertyDTO]
    display_name: str = ""
    interfaces: list[str] = Field(default_factory=list)
    marking: list[str] = Field(default_factory=list)
    parent_class: str = ""
    description: str = ""
    status: str = "active"
    type_group: str = ""
    render_hints: list[tuple[str, str]] = Field(default_factory=list)


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
    # ACT-05：声明式编辑模板（非空时 apply 走 edit-set 单事务）
    declarative_edits: list[dict[str, Any]] = Field(default_factory=list)


class LinkTypeDTO(BaseModel):
    rid: str
    src: str
    dst: str
    cardinality: str
    directionality: str
    link_properties: list[PropertyDTO] = Field(default_factory=list)
    # EXP-03：两端独立命名（双向可读）
    src_display_name: str = ""
    dst_display_name: str = ""
    description: str = ""


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


def _require_idempotency_key(request: Request) -> str:
    """Return the command idempotency key or reject an unsafe mutation."""
    key = (request.headers.get("Idempotency-Key") or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Idempotency-Key is required")
    return key


def _prop_to_dto(p: Property) -> PropertyDTO:
    return PropertyDTO(
        rid=p.rid.rid, type_id=p.type_id, nullable=p.nullable,
        primary_key=p.primary_key, title=p.title, format=p.format.value,
        description=p.description,
        struct_fields=[_prop_to_dto(sf) for sf in p.struct_fields],
        array=p.array, reducer=p.reducer,
        derived=(
            DerivedSpecDTO(fn=p.derived.fn, over_link=p.derived.over_link,
                           field=p.derived.field)
            if p.derived is not None else None
        ),
        shared=p.shared,
    )


def _dto_to_prop(d: PropertyDTO) -> Property:
    from mate_kernel.ontology.types.property_ import DerivedSpec

    return Property(
        rid=ClassRef(d.rid),
        type_id=d.type_id,
        nullable=d.nullable,
        primary_key=d.primary_key,
        title=d.title,
        format=PropertyFormat(d.format),
        description=d.description,
        struct_fields=tuple(_dto_to_prop(sf) for sf in d.struct_fields),
        array=d.array,
        reducer=d.reducer,
        derived=(
            DerivedSpec(fn=d.derived.fn, over_link=d.derived.over_link,
                        field=d.derived.field)
            if d.derived is not None else None
        ),
        shared=d.shared,
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
        parent_class=ot.parent_class.rid if ot.parent_class is not None else "",
        description=ot.description,
        status=ot.status,
        type_group=ot.type_group,
        render_hints=[tuple(kv) for kv in ot.render_hints],
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
        declarative_edits=tuple(dict(t) for t in d.declarative_edits),
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
        declarative_edits=[dict(t) for t in at.declarative_edits],
    )


def _dto_to_link_type(d: LinkTypeDTO) -> LinkType:
    return LinkType(
        rid=ClassRef(d.rid),
        src=ClassRef(d.src),
        dst=ClassRef(d.dst),
        cardinality=Cardinality(d.cardinality),
        directionality=Directionality(d.directionality),
        link_properties=tuple(_dto_to_prop(p) for p in d.link_properties),
        src_display_name=d.src_display_name,
        dst_display_name=d.dst_display_name,
        description=d.description,
    )


def _link_type_to_dto(lt: LinkType) -> LinkTypeDTO:
    return LinkTypeDTO(
        rid=lt.rid.rid,
        src=lt.src.rid,
        dst=lt.dst.rid,
        cardinality=lt.cardinality.value,
        directionality=lt.directionality.value,
        link_properties=[_prop_to_dto(p) for p in lt.link_properties],
        src_display_name=lt.src_display_name,
        dst_display_name=lt.dst_display_name,
        description=lt.description,
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
        parent_class=ClassRef(d.parent_class) if d.parent_class else None,
        description=d.description,
        status=d.status,
        type_group=d.type_group,
        render_hints=tuple(tuple(kv) for kv in d.render_hints),
    )


# ─────────────────── 1) ObjectType CRUD ───────────────────


class ChunkIngestDTO(BaseModel):
    """AI-10：文档 → chunk 对象 + 回源 link（Palantir chunk 溯源设计）。"""
    doc_class_rid: str
    doc_pk: str
    chunks: list[str]
    doc_props: dict[str, Any] = Field(default_factory=dict)


@router.post(
    "/object-types/chunks/ingest",
    response_model=dict,
    operation_id="ontIngestV2DocumentChunks",
)
async def ingest_document_chunks(
    payload: ChunkIngestDTO, request: Request,
) -> dict:
    """AI-10：文档切块入本体（chunk 即对象，link 回源文档，检索可溯源）。"""
    ctx = _ctx(request)
    tenant = str(ctx.tenant_id)  # type: ignore[attr-defined]
    if not payload.doc_class_rid.startswith(f"ont.{tenant}."):
        raise HTTPException(status_code=403, detail="cross-tenant doc class denied")

    def _ingest() -> dict:
        from .chunk_pipeline import ingest_document_chunks as _ing

        with _scoped_repo(request) as repo:
            return _ing(
                repo, tenant, payload.doc_class_rid, payload.doc_pk,
                payload.chunks, doc_props=payload.doc_props or None,
            )

    import asyncio

    return await asyncio.to_thread(_ingest)


class SecurityPolicyDTO(BaseModel):
    """SEC-12：行列级安全策略。row：行可见条件 + bypass_markings；
    column：属性 required_markings。"""
    rid: str = ""
    kind: str  # row | column
    class_rid: str = ""
    property_rid: str = ""
    field: str = ""
    op: str = ""
    value: Any = None
    markings: list[str] = Field(default_factory=list)


@router.post(
    "/security-policies",
    response_model=dict,
    operation_id="ontUpsertV2SecurityPolicy",
)
async def upsert_security_policy(
    payload: SecurityPolicyDTO, request: Request,
) -> dict:
    ctx = _ctx(request)
    payload_dict = payload.model_dump()
    payload_dict["tenant_id"] = str(ctx.tenant_id)  # type: ignore[attr-defined]
    return await _call_scoped(request, "upsert_security_policy", payload_dict)


@router.get(
    "/security-policies",
    response_model=list[dict],
    operation_id="ontListV2SecurityPolicies",
)
async def list_security_policies(request: Request) -> list[dict]:
    _ctx(request)
    items = await _call_scoped(request, "list_security_policies")
    out: list[dict] = []
    for it in items:
        it.pop("value_json", None)
        out.append({k: v for k, v in it.items()})
    return out


class BackingDatasourceDTO(BaseModel):
    """DATA-14：背挂数据源声明（kind v1=pg_table；secret 走 dsn_env 环境变量）。"""
    class_rid: str
    name: str
    kind: str = "pg_table"
    dsn_env: str = "ONT_SOURCE_DSN"
    table: str
    pk_column: str
    field_mapping: dict[str, str] = Field(default_factory=dict)
    priority: int = 100


@router.post(
    "/object-types/{rid:path}/datasources",
    response_model=dict,
    operation_id="ontUpsertV2BackingDatasource",
)
async def upsert_backing_datasource(
    rid: str, payload: BackingDatasourceDTO, request: Request,
) -> dict:
    """DATA-14：声明 backing datasource（数据平面 → 对象索引管道配置）。"""
    ctx = _ctx(request)
    tenant = str(ctx.tenant_id)  # type: ignore[attr-defined]
    if not rid.startswith(f"ont.{tenant}."):
        raise HTTPException(status_code=403, detail="cross-tenant class denied")
    decl = payload.model_dump()
    decl["class_rid"] = rid
    decl["tenant_id"] = tenant
    return await _call_scoped(request, "upsert_backing_datasource", decl)


@router.post(
    "/object-types/{rid:path}/datasources/sync",
    response_model=dict,
    operation_id="ontSyncV2BackingDatasources",
)
async def sync_backing_datasources(rid: str, request: Request) -> dict:
    """DATA-14：执行同步（批量索引；MDO 多源按 priority 字段级合并）。"""
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{str(ctx.tenant_id)}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant class denied")
    try:
        return await _call_scoped(request, "sync_backing_datasources", rid)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get(
    "/object-types/{rid:path}/materialization",
    response_model=dict,
    operation_id="ontGetV2Materialization",
)
async def get_materialization(rid: str, request: Request) -> dict:
    """DATA-15：对象最新状态行集（materialization 回流读端点）。"""
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{str(ctx.tenant_id)}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant class denied")
    try:
        return await _call_scoped(request, "materialize_object_type", rid)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get(
    "/object-types/hierarchy",
    response_model=list[dict],
    operation_id="ontGetV2TypeHierarchy",
)
async def get_type_hierarchy(request: Request) -> list[dict]:
    """EXP-01：租户类型层级树（parent_class 维度，children 嵌套完整子树）。"""
    _ctx(request)
    return await _call_scoped(request, "get_type_hierarchy")


@router.get(
    "/value-types",
    response_model=list[dict],
    operation_id="ontListV2ValueTypes",
)
async def list_value_types(request: Request) -> list[dict]:
    """EXP-02：值类型注册表（Property.type_id 引用目标）。"""
    _ctx(request)
    from mate_kernel.ontology.types.value_types import list_value_types as _list

    return [
        {
            "type_id": vt.type_id,
            "format": vt.format.value,
            "description": vt.description,
            "params": vt.params,
        }
        for vt in _list()
    ]


@router.get(
    "/properties",
    response_model=list[PropertyDTO],
    operation_id="ontListV2Properties",
)
async def list_properties(request: Request) -> list[PropertyDTO]:
    """EXP-02：属性库全量（共享属性建模 / 引用面）。"""
    _ctx(request)
    items = await _call_scoped(request, "list_properties")
    return [_prop_to_dto(p) for p in items]


@router.get(
    "/properties/shared",
    response_model=list[dict],
    operation_id="ontListV2SharedProperties",
)
async def shared_properties(request: Request) -> list[dict]:
    """EXP-02：共享属性使用统计 —— Property rid → 引用类型清单（>1 即共享）。"""
    _ctx(request)
    return await _call_scoped(request, "shared_properties_usage")


@router.post(
    "/properties",
    response_model=PropertyDTO,
    operation_id="ontUpsertV2Property",
)
async def upsert_property(
    payload: PropertyDTO, request: Request,
) -> PropertyDTO:
    """EXP-02：属性库独立 upsert（先注册后引用；struct/derived/共享标记可带）。"""
    ctx = _ctx(request)
    if not payload.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant rid denied")
    p = _dto_to_prop(payload)
    saved = await _call_scoped(request, "upsert_property", p)
    return _prop_to_dto(saved)


@router.get(
    "/interfaces/{rid:path}/implementations",
    response_model=list[str],
    operation_id="ontListV2InterfaceImplementations",
)
async def list_interface_implementations(rid: str, request: Request) -> list[str]:
    """EXP-01：Interface rid → 实现它的全部 ObjectType rid（多态查询源展开结果）。"""
    from mate_kernel.ontology.types.interface import interface_source_rids

    _ctx(request)
    ots = await _call_scoped(request, "list_object_types", 10000, 0)
    return interface_source_rids(rid, ots)


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
    ctx = _ctx(request)
    if not payload.rid.startswith(f"ont.{ctx.tenant_id}."):
        # GOVERN-06 第一道防线：外租户前缀 rid 一律拒绝写入
        raise HTTPException(status_code=403, detail="cross-tenant rid denied")
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
    "/object-types/{rid:path}/export",
    response_model=dict,
    operation_id="ontExportV2ObjectType",
)
async def export_object_type(rid: str, request: Request,
                             format: str = "jsonld") -> dict:
    """ONT-G9/G20：导出类型定义为 JSON-LD 或 OWL/Turtle（@prefix 序列）。"""
    from mate_kernel.ontology.identity.class_ref import ClassRef

    _ctx(request)
    ot = await _call_scoped(request, "get_object_type", ClassRef(rid))
    props = [
        {
            "@id": p.rid.rid,
            "@type": "owl:DatatypeProperty",
            "schema:name": p.rid.rid.split(".")[3] if len(p.rid.rid.split(".")) >= 5 else p.rid.rid,
            "rdfs:domain": ot.rid.rid,
            "ont:type_id": p.type_id,
            "ont:nullable": p.nullable,
            "ont:primary_key": p.primary_key,
        }
        for p in ot.properties
    ]
    if format == "turtle":
        lines = [
            f"@prefix ont: <{ot.rid.rid.rsplit('.', 2)[0]}> .",
            "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
            "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
            f"ont:{ot.rid.rid.split('.')[4]} a owl:Class ; rdfs:label '{ot.display_name}' .",
        ]
        for pr in props:
            lines.append(
                f"ont:{pr['schema:name']} a owl:DatatypeProperty ; "
                f"rdfs:domain ont:{ot.rid.rid.split('.')[4]} ; "
                f"ont:typeId '{pr['ont:type_id']}' ."
            )
        return {"format": "turtle", "rid": rid, "content": chr(10).join(lines)}
    return {
        "format": "jsonld",
        "rid": rid,
        "content": {
            "@context": {"owl": "http://www.w3.org/2002/07/owl#",
                         "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                         "schema": "https://schema.org/"},
            "@id": ot.rid.rid,
            "@type": "owl:Class",
            "rdfs:label": ot.display_name,
            "schema:hasProperty": props,
        },
    }


@router.post(
    "/object-types/import",
    response_model=ObjectTypeResponse,
    operation_id="ontImportV2ObjectType",
)
async def import_object_type(request: Request, payload: dict) -> ObjectTypeResponse:
    """ONT-G9/G20：从 export 的 JSON-LD content 回灌类型（同 rid upsert 语义）。"""
    ctx = _ctx(request)
    content = payload.get("content") or {}
    rid = str(content.get("@id") or payload.get("rid") or "")
    if not rid.startswith(f"ont.{ctx.tenant_id}.obj."):
        raise HTTPException(status_code=422, detail="content.@id must be a tenant object rid")
    raw_props = content.get("schema:hasProperty") or []
    props = []
    for rp in raw_props:
        props.append({
            "rid": rp["@id"], "type_id": rp.get("ont:type_id", "string"),
            "nullable": bool(rp.get("ont:nullable", True)),
            "primary_key": bool(rp.get("ont:primary_key", False)),
            "title": rp.get("schema:name", rp["@id"]),
            "format": "string",
        })
    if not props:
        raise HTTPException(status_code=422, detail="no properties in content")
    body = {
        "rid": rid, "display_name": content.get("rdfs:label", rid),
        "primary_key": [p["rid"] for p in props if p["primary_key"]] or [props[0]["rid"]],
        "properties": props,
    }
    from mate_kernel.ontology.identity.class_ref import ClassRef

    from mate_kernel.ontology.types.property_ import Property, PropertyFormat
    from mate_kernel.ontology.types.object_type import ObjectType
    from mate_kernel.ontology.identity.class_ref import ClassRef

    pk_rids = [r for r in body["primary_key"]]
    ot = ObjectType(
        rid=ClassRef(rid), display_name=body["display_name"],
        primary_key=tuple(ClassRef(r) for r in pk_rids),
        properties=tuple(
            Property(rid=ClassRef(pp["rid"]),
                     type_id=pp.get("type_id", "string"),
                     nullable=bool(pp.get("nullable", True)),
                     primary_key=pp["rid"] in pk_rids,
                     title=pp.get("title", pp["rid"]),
                     format=PropertyFormat.STRING)
            for pp in body["properties"]
        ),
        parent_class=(
            ClassRef(body["parent_class"]) if body.get("parent_class") else None
        ),
    )
    out = await _call_scoped(request, "upsert_object_type", ot)
    return _ot_to_dto(out)


@router.get(
    "/reasoning/axioms",
    response_model=list[dict],
    operation_id="ontListV2Axioms",
)
async def list_axioms(request: Request, enabled_only: bool = False) -> list[dict]:
    """ONT-G18：列出本租户已注册公理。"""
    _ctx(request)
    return await _call_scoped(request, "list_axiom_records", _ctx(request).tenant_id,
                                  enabled_only=enabled_only)


@router.post(
    "/reasoning/axioms",
    response_model=dict,
    operation_id="ontUpsertV2Axiom",
)
async def upsert_axiom(request: Request, payload: dict) -> dict:
    """ONT-G18：注册/更新公理（body: rid/kind/operands/rule_ref/enabled）。"""
    ctx = _ctx(request)
    rid = str(payload.get("rid") or "")
    if not rid.startswith(f"ont.{ctx.tenant_id}.ax."):
        raise HTTPException(status_code=422, detail="rid must be ont.<tenant>.ax.<slug>.<v>")
    try:
        return await _call_scoped(
            request, "upsert_axiom_record", rid, str(payload.get("kind")),
            [str(o) for o in payload.get("operands") or []],
            str(payload.get("rule_ref") or "builtin"),
            tenant_id=ctx.tenant_id,
            enabled=bool(payload.get("enabled", True)),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.delete(
    "/reasoning/axioms/{rid:path}",
    operation_id="ontDeleteV2Axiom",
)
async def delete_axiom(rid: str, request: Request) -> dict:
    _ctx(request)
    return {"deleted": await _call_scoped(request, "delete_axiom_record", rid)}


@router.post(
    "/reasoning/explain",
    response_model=dict,
    operation_id="ontExplainV2Reasoning",
)
async def explain_reasoning(request: Request, payload: dict) -> dict:
    """ONT-G18：derivation chain —— 每个推导事实给出规则 + 前提链。"""
    _ctx(request)
    from mate_kernel.ontology.reasoning.engine import run_inference

    sub_ax = [tuple(p) for p in payload.get("subclass_axioms") or []]
    individuals = dict(payload.get("individuals") or {})
    out = run_inference(
        subclass_axioms=sub_ax, individuals=individuals,
        same_as_pairs=[tuple(p) for p in payload.get("same_as_pairs") or []],
        transitive_axioms=list(payload.get("transitive_axioms") or []),
        property_edges=[tuple(e) for e in payload.get("property_edges") or []],
    )
    derivations: list[dict] = []
    for ind, c in out["classification"].items():
        for cls in c["inferred"]:
            chain = [cls]
            changed = True
            while changed:
                changed = False
                for sub, sup in sub_ax:
                    if chain[-1] == sup and sub not in chain:
                        chain.append(sub)
                        changed = True
            derivations.append({
                "fact": f"{ind} ∈ {cls}", "rule": "subclass-closure",
                "chain": list(reversed(chain)) + [ind],
                "premises": [f"{chain[i]} ⊑ {chain[i+1]}"
                             for i in range(len(chain) - 1)],
            })
    for rep, members in out["same_as_clusters"].items():
        derivations.append({
            "fact": " ≈ ".join(members), "rule": "same-as-merge",
            "chain": members, "premises": payload.get("same_as_pairs") or [],
        })
    for e in out["transitive_inferred"]:
        derivations.append({
            "fact": f"{e['src']} --{e['property']}--> {e['dst']}",
            "rule": "transitive-property", "chain": [e["src"], e["dst"]],
            "premises": [f"{e['src']} --{e['property']}--> ?",
                         f"? --{e['property']}--> {e['dst']}"],
        })
    return {"derivation_count": len(derivations), "derivations": derivations,
            "result": out}


@router.post(
    "/reasoning/run",
    response_model=dict,
    operation_id="ontRunV2Reasoning",
)
async def run_reasoning(request: Request, payload: dict) -> dict:
    """ONT-G16+G13：Axiom 执行引擎（subclass 闭包 / same_as / transitive）。

    body::

        {
          "subclass_axioms": [["a", "b"], ...],      # a ⊑ b
          "individuals": {"ind1": ["a"], ...},        # 实例断言类
          "same_as_pairs": [["i1", "i2"], ...],
          "transitive_axioms": ["related_to"],
          "property_edges": [["related_to", "x", "y"], ...]
        }
    """
    _ctx(request)
    from mate_kernel.ontology.reasoning.engine import run_inference

    return run_inference(
        subclass_axioms=[tuple(p) for p in payload.get("subclass_axioms") or []],
        individuals=dict(payload.get("individuals") or {}),
        same_as_pairs=[tuple(p) for p in payload.get("same_as_pairs") or []],
        transitive_axioms=list(payload.get("transitive_axioms") or []),
        property_edges=[tuple(e) for e in payload.get("property_edges") or []],
    )


@router.post(
    "/object-types/validate",
    response_model=dict,
    operation_id="ontValidateV2Model",
)
async def validate_model_endpoint(request: Request, payload: dict) -> dict:
    """ONT-G17：类型定义静态验证（不落库）。body = ObjectTypeDTO 同构。"""
    _ctx(request)
    from mate_kernel.ontology.validation_ops import validate_model

    try:
        dto = ObjectTypeDTO(**payload)
        ot = _dto_to_ot(dto)
    except ValueError as e:
        # 构造器不变量（PK∈properties 等）本身即模型错误 —— 返回为验证结果
        return {"valid": False, "errors": [str(e)], "warnings": [],
                "rid": str(payload.get("rid", ""))}
    return validate_model(ot)


@router.post(
    "/object-types/validate-data",
    response_model=dict,
    operation_id="ontValidateV2Data",
)
async def validate_data_endpoint(request: Request, payload: dict) -> dict:
    """ONT-G17：实例 props 对类型 schema 验证。body: {class_rid, props}。"""
    _ctx(request)
    from mate_kernel.ontology.identity.class_ref import ClassRef
    from mate_kernel.ontology.validation_ops import validate_instance

    ot = await _call_scoped(
        request, "get_object_type", ClassRef(str(payload["class_rid"])))
    return validate_instance(ot, dict(payload.get("props") or {}))


@router.post(
    "/shacl/validate",
    response_model=dict,
    operation_id="ontValidateV2Shacl",
)
async def validate_shacl_endpoint(request: Request, payload: dict) -> dict:
    """ONT-G14：SHACL Core 关键约束验证（minCount/maxCount/datatype/pattern/class/closed）。

    body::

        {
          "target_class": "ont.<tenant>.obj.<slug>.<v>",   # 必填（租户守门）
          "individuals": [ {"rid","class_rid","props"} ],  # 可选；缺省取 repo 内该类全部实例
          "property_shapes": [ {"path", "min_count"?, "max_count"?, "datatype"?,
                                "pattern"?, "node_class"?} ],  # 可选，叠加在合成 shape 上
          "closed": bool                                   # 可选
        }

    NodeShape 优先由 ObjectType 定义合成（pk/非空 → minCount 1，type_id →
    datatype）——SHACL 约束与类型定义语义对齐（ontValidateV2* 集成面）；
    property_shapes 显式给定时叠加 W3C 特有约束（pattern/class 等）。
    """
    ctx = _ctx(request)
    from mate_kernel.ontology.identity.class_ref import ClassRef
    from mate_kernel.ontology.shacl import (
        NodeShape, PropertyShape, shape_from_object_type, validate_shacl,
    )

    def _ps(s: dict) -> PropertyShape:
        neg = s.get("not_shape")
        qvs = s.get("qualified_value_shape")
        return PropertyShape(
            path=str(s.get("path", "")),
            min_count=s.get("min_count"),
            max_count=s.get("max_count"),
            datatype=s.get("datatype"),
            pattern=s.get("pattern"),
            node_class=s.get("node_class"),
            severity=str(s.get("severity") or "Violation"),
            language_in=tuple(s.get("language_in") or ()),
            not_shape=_ps(neg) if isinstance(neg, dict) else None,
            qualified_value_shape=_ps(qvs) if isinstance(qvs, dict) else None,
            qualified_min_count=s.get("qualified_min_count"),
            qualified_max_count=s.get("qualified_max_count"),
        )

    target_class = str(payload.get("target_class") or "")
    if not target_class.startswith(f"ont.{ctx.tenant_id}."):
        raise HTTPException(status_code=403, detail="cross-tenant shacl target denied")

    individuals = payload.get("individuals")
    if individuals is None:
        try:
            stored = await _call_scoped(
                request, "list_individuals", ClassRef(target_class))
        except KeyError:
            stored = []
        individuals = [
            {"rid": i.rid, "class_rid": i.class_rid.rid,
             "props": {k.rid: v for k, v in i.props}}
            for i in stored
        ]

    shapes: list = []
    try:
        ot = await _call_scoped(request, "get_object_type", ClassRef(target_class))
        shapes.append(shape_from_object_type(ot))
    except Exception:
        shapes = []
    extra = payload.get("property_shapes") or []
    if isinstance(extra, list) and extra:
        ps = tuple(_ps(s) for s in extra
                   if isinstance(s, dict) and s.get("path"))
        shapes.append(NodeShape(target_class=target_class, property_shapes=ps,
                                closed=bool(payload.get("closed"))))
    elif payload.get("closed"):
        shapes.append(NodeShape(target_class=target_class, closed=True))

    return validate_shacl(
        individuals, shapes,
        subclass_axioms=[(str(a[0]), str(a[1]))
                         for a in (payload.get("subclass_axioms") or [])
                         if isinstance(a, (list, tuple)) and len(a) == 2] or None,
    )


@router.post(
    "/alignment/run",
    response_model=dict,
    operation_id="ontAlignV2Individuals",
)
async def align_individuals_endpoint(request: Request, payload: dict) -> dict:
    """ONT-G33 FR-ALIGN-001：跨本体实例对齐（stateless）。

    body::

        {
          "left": [ {"rid","class_rid","props"} ],
          "right": [ ... ],
          "explicit_pairs": [["l1","r1"], ...],   # 可选
          "lexical_threshold": 1.0,               # 可选
          "structural_threshold": 0.5             # 可选
        }

    证据链：explicit（显式 same_as）/ lexical（label 规范化相等）/
    structural（属性 slug + 值签名 Jaccard）；聚类复用 reasoning R2 并查集。
    """
    _ctx(request)
    from mate_kernel.ontology.alignment import align_individuals

    return align_individuals(
        list(payload.get("left") or []),
        list(payload.get("right") or []),
        explicit_pairs=[(str(p[0]), str(p[1]))
                        for p in (payload.get("explicit_pairs") or [])
                        if isinstance(p, (list, tuple)) and len(p) == 2],
        lexical_threshold=float(payload.get("lexical_threshold") or 1.0),
        structural_threshold=float(payload.get("structural_threshold") or 0.5),
    )


@router.post(
    "/object-types/merge-preview",
    response_model=dict,
    operation_id="ontPreviewV2ObjectTypeMerge",
)
async def merge_preview_object_types(request: Request, payload: dict) -> dict:
    """ONT-G33 FR-ALIGN-002：类型定义合并预览（stateless，不落库）。

    body::

        {
          "left": ObjectTypeDTO 同构,
          "right": ObjectTypeDTO 同构,
          "strategy": "keep_left" | "keep_right"   # 可选，默认 keep_left
        }

    字段并集 + 同 rid 属性冲突标记 + 合并审计。实例重映射走
    ontMergeV2ObjectTypes（MP-DEDUP-01），二者互补。
    """
    _ctx(request)
    from mate_kernel.ontology.alignment import merge_object_types

    try:
        left = _dto_to_ot(ObjectTypeDTO(**(payload.get("left") or {})))
        right = _dto_to_ot(ObjectTypeDTO(**(payload.get("right") or {})))
    except KeyError as e:
        raise HTTPException(
            status_code=422, detail=f"invalid object type payload: {e}") from e
    strategy = str(payload.get("strategy") or "keep_left")
    try:
        out = merge_object_types(left, right, strategy=strategy)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"object_type": _ot_to_dto(out["object_type"]),
            "audit": out["audit"]}


@router.post(
    "/object-types/{rid:path}/branch",
    response_model=ObjectTypeResponse,
    operation_id="ontBranchV2ObjectType",
)
async def branch_object_type(
    rid: str, request: Request, payload: dict = None,
) -> ObjectTypeResponse:
    """ONT-G8/G19：以当前定义分支出新版本 rid（body: {new_rid, note?}）。"""
    ctx = _ctx(request)
    import json as _json
    body = payload or {}
    new_rid = str((body or {}).get("new_rid") or "")
    note = str((body or {}).get("note") or "")
    if not new_rid.startswith(f"ont.{ctx.tenant_id}.obj."):
        raise HTTPException(status_code=422, detail="new_rid must be a tenant object rid")
    try:
        from mate_kernel.ontology.identity.class_ref import ClassRef

        out = await _call_scoped(
            request, "branch_object_type", ClassRef(rid), ClassRef(new_rid), note=note,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _ot_to_dto(out)


@router.get(
    "/object-types/{rid:path}/diff",
    response_model=dict,
    operation_id="ontDiffV2ObjectType",
)
async def diff_object_type(rid: str, request: Request, against: str) -> dict:
    """ONT-G8：rid 与 against（同族另一版本）的属性级 diff。"""
    _ctx(request)
    try:
        from mate_kernel.ontology.identity.class_ref import ClassRef

        return await _call_scoped(
            request, "diff_object_types", ClassRef(rid), ClassRef(against),
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post(
    "/object-types/{rid:path}/rollback",
    response_model=ObjectTypeResponse,
    operation_id="ontRollbackV2ObjectType",
)
async def rollback_object_type(
    rid: str, request: Request, payload: dict = None,
) -> ObjectTypeResponse:
    """ONT-G8/G19：把 rid 定义回滚为 from_rid（body: {from_rid}）。"""
    ctx = _ctx(request)
    body = payload or {}
    from_rid = str((body or {}).get("from_rid") or "")
    if not from_rid.startswith(f"ont.{ctx.tenant_id}.obj."):
        raise HTTPException(status_code=422, detail="from_rid must be a tenant object rid")
    try:
        from mate_kernel.ontology.identity.class_ref import ClassRef

        out = await _call_scoped(
            request, "rollback_object_type", ClassRef(rid), ClassRef(from_rid),
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _ot_to_dto(out)


@router.get(
    "/object-types/{rid:path}",
    response_model=ObjectTypeResponse,
    operation_id="ontGetV2ObjectType",
)
async def get_object_type(rid: str, request: Request) -> ObjectTypeResponse:
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{ctx.tenant_id}."):
        # GOVERN-06：外租户前缀 rid 不泄露存在性（404 而非 403）
        raise HTTPException(status_code=404, detail=f"object type {rid} not found")
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
    request: Request, class_rid: str | None = None, markings: str = "",
) -> list[IndividualResponse]:
    """List individuals; class_rid 过滤 + SEC-12 行策略读时强制（markings 参数）。"""
    ctx = _ctx(request)
    cls_ref = ClassRef(class_rid) if class_rid else None
    if cls_ref and not cls_ref.rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant access denied")
    items = await _call_scoped(request, "list_individuals", cls_ref)
    if markings:
        viewer = tuple(m.strip() for m in markings.split(",") if m.strip())
        items = await _call_scoped(
            request, "enforce_read_policies", items, viewer)
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
    """Reject direct execution that could bypass human confirmation.

    ActionType side effects now execute exclusively through a confirmed
    proposal at ``POST /proposals/{proposal_id}/execute``. The endpoint is
    retained only to give legacy clients an actionable migration response.
    """
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{ctx.tenant_id}."):
        raise HTTPException(status_code=403, detail="cross-tenant action denied")
    del payload
    raise HTTPException(
        status_code=410,
        detail=(
            "direct action apply is retired; create and confirm an action proposal, "
            "then POST /proposals/{proposal_id}/execute"
        ),
    )


class EditSetApplyBodyDTO(BaseModel):
    """ACT-05：edit-set 执行体。edits 缺省时用 ActionType.declarative_edits 模板。"""
    parameters: dict[str, Any] = Field(default_factory=dict)
    target_iid: str = ""
    edits: list[dict[str, Any]] = Field(default_factory=list)
    impact_summary: str = ""


@router.post(
    "/action-types/{rid:path}/propose-edit-set",
    response_model=dict,
    operation_id="ontProposeV2EditSet",
)
async def propose_edit_set(
    rid: str, payload: EditSetApplyBodyDTO, request: Request,
) -> dict:
    """ACT-05：AI 路径 edit-set 提案（强制 HITL —— pending → 用户 confirm → execute）。"""
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant action denied")
    try:
        at = await _call_scoped(request, "get_action_type", ClassRef(rid))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"action type not found: {rid}")
    edits = payload.edits or [dict(t) for t in at.declarative_edits]
    if not edits:
        raise HTTPException(status_code=422, detail="no declarative_edits on action and no edits in body")
    prop = await _call_scoped(
        request, "propose_edit_set", rid, payload.target_iid or None,
        dict(payload.parameters), edits,
        payload.impact_summary or f"edit-set proposal for {rid}",
    )
    return {
        "proposal_id": getattr(prop, "proposal_id", None) or prop.get("proposal_id"),
        "status": "pending",
        "requires_hitl": True,
    }


@router.post(
    "/action-types/{rid:path}/apply-edit-set",
    response_model=dict,
    operation_id="ontApplyV2EditSet",
)
async def apply_edit_set(
    rid: str, payload: EditSetApplyBodyDTO, request: Request,
) -> dict:
    """ACT-05 / D7：人工路径「预览即确认」—— 即时 proposal + 单事务执行 + 审计。

    expected_diff 预览在 proposal 记录中可查（GET /proposals/{id}/preview）。
    """
    ctx = _ctx(request)
    if not rid.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant action denied")
    actor = str(ctx.user_id if hasattr(ctx, "user_id") else "") or "human-operator"
    try:
        at = await _call_scoped(request, "get_action_type", ClassRef(rid))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"action type not found: {rid}")
    edits = payload.edits or [dict(t) for t in at.declarative_edits]
    if not edits:
        raise HTTPException(status_code=422, detail="no declarative_edits on action and no edits in body")
    result = await _call_scoped(
        request, "apply_edit_set_now", rid, payload.target_iid or None,
        dict(payload.parameters), edits, actor,
        payload.impact_summary,
    )
    return result


# ─────────────────── MP-SAL-04: Proposal 状态机端点（ADR-0044 §2.4）───────────────────


class ProposalCreateDTO(BaseModel):
    parameters: dict[str, Any] = Field(default_factory=dict)
    target_iid: str = ""
    impact_summary: str = ""
    expected_diff: dict[str, Any] = Field(default_factory=dict)


class ProposalConfirmDTO(BaseModel):
    """Confirmation payload reserved for future user-provided rationale.

    The confirming principal is deliberately excluded: it is always read from
    the authenticated request context, never from client supplied JSON.
    """


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
    action_rid: str | None = None
    target_iid: str | None = None
    audit_id: str | None = None
    outbox_event_ids: list[str] = Field(default_factory=list)
    side_effects_emitted: list[str] = Field(default_factory=list)
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
    _logger.info(
        "ont.proposal.propose",
        proposal_kind="create_instance", class_rid=class_rid,
        tenant_id=getattr(ctx, "tenant_id", ""),
        actor_id=str(getattr(ctx, "user_id", "")),
    )
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
    "/proposals/{proposal_id}/withdraw",
    response_model=dict,
    operation_id="ontWithdrawV2Proposal",
)
async def withdraw_proposal(
    proposal_id: str, request: Request,
) -> dict:
    """PRD-02 FR-ACT-CONFIRM-001：pending → withdrawn（作者确认前撤回；终态）。"""
    _logger.info(
        "ont.proposal.withdraw",
        proposal_id=proposal_id,
        tenant_id=getattr(_ctx(request), "tenant_id", ""),
        actor_id=str(getattr(_ctx(request), "user_id", "")),
    )
    try:
        out = await _call_scoped(
            request, "withdraw_proposal", proposal_id,
            actor_id=str(_ctx(request).user_id),
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return out


@router.post(
    "/proposals/{proposal_id}/revert",
    response_model=dict,
    operation_id="ontRevertV2Proposal",
)
async def revert_proposal(
    proposal_id: str, request: Request,
) -> dict:
    """PRD-02 FR-ACT-CONFIRM-002..006：executed → reverted（人审撤销 + 补偿）。

    create_instance → 实例删除（I1 ≃ 等价判定）；action/model → audit-only
    partial；7 天窗口外拒绝（409）。
    """
    ctx = _ctx(request)
    idempotency_key = _require_idempotency_key(request)
    _logger.info(
        "ont.proposal.revert",
        proposal_id=proposal_id, tenant_id=getattr(ctx, "tenant_id", ""),
        actor_id=str(getattr(ctx, "user_id", "")),
        idempotency_key=idempotency_key,
    )
    try:
        out = await _call_scoped(
            request, "revert_proposal", proposal_id,
            actor_id=str(ctx.user_id), idempotency_key=idempotency_key,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return out


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
    - action → 通过已确认的提案执行，并返回审计与 Outbox 凭据
    """
    ctx = _ctx(request)
    idempotency_key = _require_idempotency_key(request)
    try:
        out = await _call_scoped(
            request,
            "execute_proposal",
            proposal_id,
            actor_id=str(ctx.user_id),
            idempotency_key=idempotency_key,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ProposalNotConfirmed as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return ProposalExecuteResultDTO(**out)


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
    del payload  # identity comes exclusively from the authenticated context
    _logger.info(
        "ont.proposal.confirm",
        proposal_id=proposal_id, tenant_id=getattr(_ctx(request), "tenant_id", ""),
        actor_id=str(getattr(_ctx(request), "user_id", "")), 
    )
    ctx = _ctx(request)
    idempotency_key = _require_idempotency_key(request)
    try:
        prop = await _call_scoped(
            request,
            "confirm_proposal",
            proposal_id,
            str(ctx.user_id),
            idempotency_key=idempotency_key,
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
    del payload  # identity comes exclusively from the authenticated context
    ctx = _ctx(request)
    idempotency_key = _require_idempotency_key(request)
    _logger.info(
        "ont.proposal.reject",
        proposal_id=proposal_id, tenant_id=getattr(ctx, "tenant_id", ""),
        actor_id=str(getattr(ctx, "user_id", "")),
    )
    try:
        prop = await _call_scoped(
            request,
            "reject_proposal",
            proposal_id,
            str(ctx.user_id),
            idempotency_key=idempotency_key,
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
    """Reject the colon-style direct apply alias with the same migration path."""
    ctx = _ctx(request)
    if not payload.action_rid.startswith(f"ont.{ctx.tenant_id}."):
        raise HTTPException(status_code=403, detail="cross-tenant action denied")
    raise HTTPException(
        status_code=410,
        detail=(
            "direct action apply is retired; create and confirm an action proposal, "
            "then POST /proposals/{proposal_id}/execute"
        ),
    )


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


_PREVIEW_LOCK_STATES = {"confirmed", "executed", "rejected"}
_PREVIEW_LOCK_MESSAGES = {
    "confirmed": "proposal already confirmed; further preview not allowed",
    "executed": "proposal already executed; preview not available (look at audit)",
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


@router.get(
    "/individuals/{rid:path}/around",
    response_model=list[dict],
    operation_id="ontSearchAroundV2Individual",
)
async def search_around(rid: str, request: Request, limit: int = 100) -> list[dict]:
    """EXP-03：一跳关系遍历（Object Explorer Search Around 同语义）。

    按 (link_type, direction) 分组返回对端实例清单；limit 为对端总数上限。
    """
    _ctx(request)
    return await _call_scoped(request, "search_around", rid, limit)


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
    payload: ObjectQueryDTO, request: Request, markings: str = "",
) -> ObjectQueryResultDTO:
    """Structured IR query (ADR-0043) + SEC-12 enforcement (markings param)."""
    ctx = _ctx(request)
    if not payload.source.startswith(f"ont.{ctx.tenant_id}."):  # type: ignore[attr-defined]
        raise HTTPException(status_code=403, detail="cross-tenant query denied")
    q = _dto_to_ir_query(payload)
    result = await _call_scoped(request, "execute_object_query", q)
    if markings and result.kind == "objects":
        viewer = tuple(m.strip() for m in markings.split(",") if m.strip())
        rows = list(result.rows)
        rows = await _call_scoped(request, "mask_rows", rows, viewer)
        result = type(result)(kind=result.kind, rows=tuple(rows),
                              result_schema=result.result_schema)
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
    action_types = await _call_scoped(request, "list_action_types")
    schemas = agent_tool_schemas(
        object_types, links, caller_markings, action_types=action_types)
    tools: list[AgentToolDTO] = []
    for s in schemas:
        name = s["function"]["name"]
        # AI-11：读工具（query_*）+ 语义检索 + 写提案工具（propose_action_*）
        if not (name.startswith("query_") or name == "search_objects"
                or name.startswith("propose_action_")):
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
    "/object-search/hybrid",
    response_model=ObjectSearchResultDTO,
    operation_id="ontHybridSearchV2Objects",
)
async def hybrid_search_objects(
    payload: ObjectSearchDTO, request: Request,
) -> ObjectSearchResultDTO:
    """AI-09：混合检索（关键词 + 向量 + RRF 融合，调研材料 03 §OAG）。"""
    ctx = _ctx(request)
    if payload.class_rid and not payload.class_rid.startswith(
        f"ont.{ctx.tenant_id}.",  # type: ignore[attr-defined]
    ):
        raise HTTPException(status_code=403, detail="cross-tenant search denied")
    cards = await _call_scoped(
        request, "search_objects_hybrid", payload.text, payload.class_rid,
        payload.top_k, str(ctx.tenant_id),  # type: ignore[attr-defined]
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
