"""FastAPI router exposing the apphub endpoints (FR-APP-HUB-001..005).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

5 GET endpoints:

  GET /api/v1/apphub/apps        — registered applications
  GET /api/v1/apphub/apps/groups — application groups
  GET /api/v1/apphub/modules     — business modules
  GET /api/v1/apphub/pages       — page templates
  GET /api/v1/apphub/templates   — workflow / form templates

BUSINESS-SLICES deep: adds CRUD endpoints for apps, groups, modules,
pages, and templates with version management, category validation,
and outbox event emission (ADR-0014 step 3).

The router is mounted by `mate_app_hub.main.create_app()` after
`install_auth(app)` so the bearer-token middleware populates
`request.state.ctx` before any handler runs.
"""

from __future__ import annotations

import re
from copy import deepcopy
from urllib.parse import quote
import uuid
from dataclasses import asdict, replace
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    ApphubApp,
    ApphubDomain,
    ApphubGroup,
    ApphubModule,
    ApphubPage,
    ApphubTemplate,
    delete_app,
    delete_domain,
    delete_group,
    get_app,
    get_domain,
    get_group,
    get_module,
    get_template,
    list_apps,
    list_domains,
    list_groups,
    list_modules,
    list_pages,
    list_templates,
    put_app as _put_app,
    put_domain,
    put_group,
    insert_group,
    put_module,
    put_page,
    put_template,
)
from ..runtime import (
    RuntimeAction,
    get_executor,
    load_app_runtime,
    render_page,
)
from ..runtime.binding import ontology_client, ontology_request, validate_order_binding
from ..shortlink import (
    create_shortlink,
    get_default_store,
    list_shortlinks,
    resolve_shortlink,
)

router = APIRouter(prefix="/api/v1/apphub", tags=["apphub"])

# Valid categories (must match an existing group code).
_VALID_CATEGORIES = frozenset({"knowledge", "platform", "data", "business"})

# Valid template types.
_VALID_TEMPLATE_TYPES = frozenset({"workflow", "form", "approval"})

# Semver pattern: MAJOR.MINOR.PATCH
_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")


def _serialize(rows: list) -> list[dict]:
    """Convert dataclass rows to JSON-friendly dicts."""
    return [asdict(r) for r in rows]


def _now_iso() -> str:
    """Current UTC timestamp in ISO format."""
    return datetime.now(UTC).isoformat()


def put_app(tenant_id: str, app: ApphubApp, *, insert_only: bool = False) -> ApphubApp:
    from ..repositories.in_memory import AppRevisionConflict
    try:
        return _put_app(tenant_id, app, insert_only=insert_only)
    except (AppRevisionConflict, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None


def _tenant_id(request: Request, *, require_write: bool = True) -> str:
    """Return the verified tenant_id for the current request.

    Reads `request.state.ctx` (populated by `install_auth`) and
    delegates to `require_tenant` which raises TenantAccessError
    on anonymous / empty-tenant callers. Returns the bare string
    for repository lookups.
    """
    ctx = request.state.ctx
    tenant_id = require_tenant(ctx)
    if require_write and request.method not in {"GET", "HEAD", "OPTIONS"} and not ctx.has_scope("platform.write"):
        raise HTTPException(status_code=403, detail="platform.write required")
    return str(tenant_id)


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (ADR-0014 step 3)."""
    writer: InMemoryOutboxWriter | None = getattr(request.app.state, "outbox_writer", None)
    if writer is None:
        return
    writer.append(
        Event.create(
            type=event_type,
            tenant_id=TenantId(tenant_id),
            aggregate_id=aggregate_id,
            payload=payload,
            trace_id=getattr(request.state.ctx, "trace_id", ""),
        )
    )


@router.get("/apps", operation_id='apphubGetApphubApps')
async def list_registered_apps(
    request: Request,
    keyword: str | None = Query(default=None, description="name/code 模糊匹配"),
    category: str | None = Query(default=None, description="category 精确过滤"),
) -> dict:
    tenant_id = _tenant_id(request)
    items = [_app_payload(a) for a in list_apps(tenant_id)]
    if keyword:
        kw = keyword.lower()
        items = [a for a in items if kw in a["name"].lower() or kw in a["code"].lower()]
    if category:
        items = [a for a in items if a["category"] == category]
    return {"items": items, "total": len(items)}


@router.get("/apps/groups", operation_id='apphubGetApphubAppsGroups')
async def list_app_groups(request: Request) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_groups(tenant_id))
    return {"items": items, "total": len(items)}


@router.get("/apps/domains")
async def list_app_domains(request: Request) -> dict:
    """业务域列表（应用中心业务域 tab 的候选来源）。

    必须声明在 `/apps/{app_id}` 之前，否则会被路径参数吃掉。
    """
    tenant_id = _tenant_id(request)
    items = _serialize(list_domains(tenant_id))
    return {"items": items, "total": len(items)}


@router.get("/apps/{app_id}", operation_id='apphubGetAppDetail')
async def get_app_detail(request: Request, app_id: str) -> dict:
    """Get a single application detail by id or code."""
    tid = _tenant_id(request)
    app = get_app(tid, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="app not found")
    return _app_payload(app)


@router.get("/modules", operation_id='apphubGetApphubModules')
async def list_business_modules(
    request: Request,
    app_code: str | None = Query(default=None, description="所属 app 编码"),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_modules(tenant_id))
    if app_code:
        items = [m for m in items if m["app_code"] == app_code]
    return {"items": items, "total": len(items)}


@router.get("/modules/{module_id}", operation_id='apphubGetModuleDetail')
async def get_module_detail(request: Request, module_id: str) -> dict:
    """Get a single business module detail."""
    tid = _tenant_id(request)
    for m in list_modules(tid):
        if m.id == module_id:
            return _serialize([m])[0]
    raise HTTPException(status_code=404, detail="module not found")


@router.get("/pages", operation_id='apphubGetApphubPages')
async def list_page_templates(
    request: Request,
    module_code: str | None = Query(default=None, description="所属 module 编码"),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_pages(tenant_id))
    if module_code:
        items = [p for p in items if p["module_code"] == module_code]
    return {"items": items, "total": len(items)}


@router.get("/templates")
async def list_workflow_templates(
    request: Request,
    template_type: str | None = Query(
        default=None,
        description="workflow / form / approval",
    ),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_templates(tenant_id))
    if template_type:
        items = [t for t in items if t["template_type"] == template_type]
    return {"items": items, "total": len(items)}


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: App registration + version management
# ---------------------------------------------------------------------------
class AppRegisterRequest(BaseModel):
    """Body schema for POST /apps."""

    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    category: Annotated[str, Field(min_length=1, max_length=64)]
    description: Annotated[str, Field(default="", max_length=2048)]
    version: Annotated[str, Field(default="1.0.0")]
    owner: Annotated[str, Field(default="platform-team")]
    tags: Annotated[list[str], Field(default_factory=list)]
    business_domain: Annotated[str, Field(default="", max_length=64)]


class AppUpdateRequest(BaseModel):
    """Body schema for PATCH /apps/{code}."""

    status: Literal["OFFLINE", "DESIGNING"] | None = None
    name: Annotated[str | None, Field(default=None, max_length=256)]
    description: Annotated[str | None, Field(default=None, max_length=2048)]
    version: Annotated[str | None, Field(default=None)]
    owner: Annotated[str | None, Field(default=None, max_length=256)]
    business_domain: Annotated[str | None, Field(default=None, max_length=64)]


@router.post("/apps", status_code=201, operation_id='apphubPostApphubApps')
async def register_app(
    request: Request,
    body: AppRegisterRequest,
) -> dict:
    """Register a new application.

    Validation rules:
      - ``code`` must be unique within the tenant.
      - ``category`` must be one of the known categories (knowledge /
        platform / data) and match an existing group.
      - ``version`` must be a valid semver (MAJOR.MINOR.PATCH).
    """
    tid = _tenant_id(request)
    if body.category not in _VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"invalid category '{body.category}'; must be one of {sorted(_VALID_CATEGORIES)}",
        )
    if get_group(tid, body.category) is None:
        raise HTTPException(
            status_code=422,
            detail=f"category '{body.category}' has no matching group",
        )
    if not _SEMVER_RE.match(body.version):
        raise HTTPException(
            status_code=422,
            detail=f"invalid version '{body.version}'; expected MAJOR.MINOR.PATCH",
        )
    app = ApphubApp(
        id="app-" + uuid.uuid5(uuid.NAMESPACE_URL, f"apphub-app:{tid}:{body.code}").hex,
        tenant_id=tid,
        name=body.name,
        code=body.code,
        category=body.category,
        description=body.description,
        version=body.version,
        owner=body.owner,
        tags=tuple(body.tags),
        business_domain=body.business_domain,
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    put_app(tid, app, insert_only=True)
    _emit(
        request,
        "apphub.app.registered",
        body.code,
        {"code": body.code, "name": body.name, "version": body.version},
        tid,
    )
    return _app_payload(app)


@router.patch("/apps/{code}", operation_id='apphubPatchApphubAppsCode')
async def update_app(
    request: Request,
    code: str,
    body: AppUpdateRequest,
) -> dict:
    """Update an application's metadata.

    Version bumps must follow semver. The new version must differ
    from the current one.
    """
    tid = _tenant_id(request)
    app = get_app(tid, code)
    if app is None:
        raise HTTPException(status_code=404, detail="app not found")
    new_version = body.version if body.version is not None else app.version
    if not _SEMVER_RE.match(new_version):
        raise HTTPException(
            status_code=422,
            detail=f"invalid version '{new_version}'; expected MAJOR.MINOR.PATCH",
        )
    if new_version == app.version and body.version is not None:
        raise HTTPException(
            status_code=409,
            detail="new version must differ from current version",
        )
    updated = ApphubApp(
        revision=app.revision, status=body.status or app.status, created_at=app.created_at, updated_at=_now_iso(),
        published_version_id=app.published_version_id, versions=app.versions, releases=app.releases,
        id=app.id,
        tenant_id=tid,
        name=body.name if body.name is not None else app.name,
        code=app.code,
        category=app.category,
        description=body.description if body.description is not None else app.description,
        version=new_version,
        owner=body.owner if body.owner is not None else app.owner,
        tags=app.tags,
        business_domain=(
            body.business_domain if body.business_domain is not None else app.business_domain
        ),
    )
    put_app(tid, updated)
    _emit(
        request,
        "apphub.app.updated",
        code,
        {"code": code, "version": new_version},
        tid,
    )
    return _app_payload(updated)


@router.delete("/apps/{code}", operation_id='apphubDeleteApphubAppsCode')
async def delete_app_endpoint(request: Request, code: str) -> dict:
    """Delete an application by code."""
    tid = _tenant_id(request)
    app = get_app(tid, code)
    if app is None:
        raise HTTPException(status_code=404, detail="app not found")
    if not delete_app(tid, app.id, by_id=True):
        raise HTTPException(status_code=404, detail="app already deleted")
    _emit(request, "apphub.app.deleted", app.code, {"code": app.code}, tid)
    return {"deleted": code}


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Group CRUD
# ---------------------------------------------------------------------------
class GroupCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    icon: Annotated[str, Field(default="folder", max_length=64)]
    sort_order: Annotated[int, Field(default=0, ge=0)]


@router.post("/groups", status_code=201, operation_id='apphubPostApphubGroups')
async def create_group(
    request: Request,
    body: GroupCreateRequest,
) -> dict:
    """Create a new application group."""
    tid = _tenant_id(request)
    if get_group(tid, body.code) is not None:
        raise HTTPException(status_code=409, detail=f"group '{body.code}' already exists")
    group = ApphubGroup(
        id="grp-" + uuid.uuid5(uuid.NAMESPACE_URL, f"apphub-group:{tid}:{body.code}").hex,
        tenant_id=tid,
        name=body.name,
        code=body.code,
        icon=body.icon,
        sort_order=body.sort_order,
    )
    try:
        insert_group(tid, group)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    _emit(
        request,
        "apphub.group.created",
        body.code,
        {"code": body.code, "name": body.name},
        tid,
    )
    return asdict(group)


@router.delete("/groups/{code}", operation_id='apphubDeleteApphubGroupsCode')
async def delete_group_endpoint(request: Request, code: str) -> dict:
    """Delete a group. A group with apps referencing its category cannot be deleted."""
    tid = _tenant_id(request)
    group = get_group(tid, code)
    if group is None:
        raise HTTPException(status_code=404, detail="group not found")
    # Check no apps use this category.
    apps = [a for a in list_apps(tid) if a.category == code]
    if apps:
        raise HTTPException(
            status_code=409,
            detail=f"cannot delete group '{code}'; {len(apps)} apps reference it",
        )
    delete_group(tid, code)
    _emit(request, "apphub.group.deleted", code, {"code": code}, tid)
    return {"deleted": code}


# ---------------------------------------------------------------------------
# 业务域 CRUD
# ---------------------------------------------------------------------------
class DomainCreateRequest(BaseModel):
    """Body schema for POST /domains."""

    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    icon: Annotated[str, Field(default="folder", max_length=64)]
    sort_order: Annotated[int, Field(default=0, ge=0)]


class DomainUpdateRequest(BaseModel):
    """Body schema for PATCH /domains/{code}.

    ``code`` is intentionally absent: it is the key apps reference, so it is
    immutable. Renaming a domain changes ``name``, not ``code``.
    """

    name: Annotated[str | None, Field(default=None, min_length=1, max_length=256)]
    icon: Annotated[str | None, Field(default=None, max_length=64)]
    sort_order: Annotated[int | None, Field(default=None, ge=0)]


@router.post("/domains", status_code=201)
async def create_domain(
    request: Request,
    body: DomainCreateRequest,
) -> dict:
    """Create a new business domain."""
    tid = _tenant_id(request)
    if get_domain(tid, body.code) is not None:
        raise HTTPException(status_code=409, detail=f"domain '{body.code}' already exists")
    domain = ApphubDomain(
        id=f"dom-{body.code}",
        tenant_id=tid,
        name=body.name,
        code=body.code,
        icon=body.icon,
        sort_order=body.sort_order,
    )
    put_domain(tid, domain)
    _emit(
        request,
        "apphub.domain.created",
        body.code,
        {"code": body.code, "name": body.name},
        tid,
    )
    return asdict(domain)


@router.patch("/domains/{code}")
async def update_domain(
    request: Request,
    code: str,
    body: DomainUpdateRequest,
) -> dict:
    """Update a business domain's display attributes. ``code`` is immutable."""
    tid = _tenant_id(request)
    existing = get_domain(tid, code)
    if existing is None:
        raise HTTPException(status_code=404, detail="domain not found")
    updated = ApphubDomain(
        id=existing.id,
        tenant_id=existing.tenant_id,
        name=body.name if body.name is not None else existing.name,
        code=existing.code,
        icon=body.icon if body.icon is not None else existing.icon,
        sort_order=body.sort_order if body.sort_order is not None else existing.sort_order,
    )
    put_domain(tid, updated)
    _emit(
        request,
        "apphub.domain.updated",
        code,
        {"code": code, "name": updated.name},
        tid,
    )
    return asdict(updated)


@router.delete("/domains/{code}")
async def delete_domain_endpoint(request: Request, code: str) -> dict:
    """Delete a business domain.

    A domain that still has apps classified under it cannot be deleted — the
    caller must reclassify those apps first. Mirrors the group delete rule.
    """
    tid = _tenant_id(request)
    domain = get_domain(tid, code)
    if domain is None:
        raise HTTPException(status_code=404, detail="domain not found")
    apps = [a for a in list_apps(tid) if a.business_domain == code]
    if apps:
        raise HTTPException(
            status_code=409,
            detail=f"cannot delete domain '{code}'; {len(apps)} apps reference it",
        )
    delete_domain(tid, code)
    _emit(request, "apphub.domain.deleted", code, {"code": code}, tid)
    return {"deleted": code}


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Module CRUD
# ---------------------------------------------------------------------------
class ModuleCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    app_code: Annotated[str, Field(min_length=1, max_length=64)]
    description: Annotated[str, Field(default="", max_length=2048)]
    entry_path: Annotated[str, Field(default="", max_length=512)]


@router.post("/modules", status_code=201, operation_id='apphubPostApphubModules')
async def create_module(
    request: Request,
    body: ModuleCreateRequest,
) -> dict:
    """Create a new business module.

    The ``app_code`` must reference an existing registered app.
    """
    tid = _tenant_id(request)
    if get_app(tid, body.app_code) is None:
        raise HTTPException(
            status_code=422,
            detail=f"app '{body.app_code}' not found",
        )
    if get_module(tid, body.code) is not None:
        raise HTTPException(
            status_code=409,
            detail=f"module '{body.code}' already exists",
        )
    module = ApphubModule(
        id="mod-" + uuid.uuid5(uuid.NAMESPACE_URL, f"apphub:module:{tid}:{body.code}").hex,
        tenant_id=tid,
        name=body.name,
        code=body.code,
        app_code=body.app_code,
        description=body.description,
        entry_path=body.entry_path,
    )
    try:
        put_module(tid, module, insert_only=True)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    _emit(
        request,
        "apphub.module.created",
        body.code,
        {"code": body.code, "app_code": body.app_code},
        tid,
    )
    return asdict(module)


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Page CRUD
# ---------------------------------------------------------------------------
class PageCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    module_code: Annotated[str, Field(min_length=1, max_length=64)]
    layout: Annotated[str, Field(default="single", max_length=64)]
    schema_version: Annotated[int, Field(default=1, ge=1)]


@router.post("/pages", status_code=201, operation_id='apphubPostApphubPages')
async def create_page(
    request: Request,
    body: PageCreateRequest,
) -> dict:
    """Create a new page template.

    The ``module_code`` must reference an existing module.
    """
    tid = _tenant_id(request)
    if get_module(tid, body.module_code) is None:
        raise HTTPException(
            status_code=422,
            detail=f"module '{body.module_code}' not found",
        )
    page = ApphubPage(
        id="page-" + uuid.uuid5(uuid.NAMESPACE_URL, f"apphub:page:{tid}:{body.code}").hex,
        tenant_id=tid,
        name=body.name,
        code=body.code,
        module_code=body.module_code,
        layout=body.layout,
        schema_version=body.schema_version,
    )
    try:
        put_page(tid, page, insert_only=True)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    _emit(
        request,
        "apphub.page.created",
        body.code,
        {"code": body.code, "module_code": body.module_code},
        tid,
    )
    return asdict(page)


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Template CRUD
# ---------------------------------------------------------------------------
class TemplateCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    template_type: Annotated[str, Field(min_length=1, max_length=64)]
    description: Annotated[str, Field(default="", max_length=2048)]
    content: Annotated[dict, Field(default_factory=dict)]


@router.post("/templates", status_code=201)
async def create_template(
    request: Request,
    body: TemplateCreateRequest,
) -> dict:
    """Create a new workflow / form / approval template.

    The ``template_type`` must be one of: workflow / form / approval.
    """
    tid = _tenant_id(request)
    if body.template_type not in _VALID_TEMPLATE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"invalid template_type '{body.template_type}'; must be one of {sorted(_VALID_TEMPLATE_TYPES)}",
        )
    if get_template(tid, body.code) is not None:
        raise HTTPException(
            status_code=409,
            detail=f"template '{body.code}' already exists",
        )
    template = ApphubTemplate(
        id=f"tpl-{body.code}",
        tenant_id=tid,
        name=body.name,
        code=body.code,
        template_type=body.template_type,
        description=body.description,
        content=body.content,
    )
    put_template(tid, template)
    _emit(
        request,
        "apphub.template.created",
        body.code,
        {"code": body.code, "template_type": body.template_type},
        tid,
    )
    return asdict(template)


# ---------------------------------------------------------------------------
# APPHUB-RUNTIME-01 phase B: runtime engine endpoints
# ---------------------------------------------------------------------------
@router.get("/apps/{app_id}/runtime", operation_id='apphubGetAppRuntime')
async def get_app_runtime(app_id: str, request: Request) -> dict:
    """Return the runtime context + render tree for an app."""
    tenant_id = _tenant_id(request)
    try:
        ctx = load_app_runtime(tenant_id, app_id, published_only=True)
    except ValueError as exc:
        raise HTTPException(status_code=409 if "publish" in str(exc) else 404, detail=str(exc)) from None
    await _validate_modules(request, ctx.modules)
    nodes = render_page(ctx)
    return {
        "app_id": ctx.app_id,
        "version": ctx.version,
        "modules": ctx.modules,
        "render_tree": [asdict(node) for node in nodes],
    }


@router.post("/apps/{app_id}/runtime/execute", operation_id='apphubPostAppRuntimeExecute')
async def execute_runtime_action(app_id: str, request: Request) -> dict:
    """Execute a runtime action (submit_form / trigger_flow / call_api / navigate)."""
    tenant_id = _tenant_id(request)
    body = await request.json()
    try:
        ctx = load_app_runtime(tenant_id, app_id, published_only=True)
    except ValueError as exc:
        raise HTTPException(status_code=409 if "publish" in str(exc) else 404, detail=str(exc)) from None
    if body.get("action_type") == "ontology_propose":
        page_id = str(body.get("page_id", ""))
        binding = _runtime_binding(ctx, page_id)
        if not ctx.published_version_id:
            raise HTTPException(status_code=409, detail="Published snapshot identity required")
        async with ontology_client(request) as client:
            binding = await validate_order_binding(client, tenant_id, binding)
            rows = await ontology_request(client, "POST", "/object-sets:evaluate", json=binding["object_set"])
            target = body.get("payload", {}).get("target_iid")
            if target not in {row["rid"] for row in rows}:
                raise HTTPException(status_code=422, detail="Target is outside the published ObjectSet")
            proposal = await ontology_request(client, "POST",
                "/action-types/" + quote(binding["action_rid"], safe="") + "/propose",
                json={"target_iid": target, "parameters": body.get("payload", {}).get("parameters", {}),
                      "impact_summary": f"Application {ctx.app_id} version {ctx.version}",
                      "provenance": {"source": "user", "app_id": ctx.app_id, "page_id": page_id,
                                     "app_version": ctx.version, "app_version_id": ctx.published_version_id}})
        return {"action_id": body.get("action_id", ""), "success": True, "data": proposal, "error": None}
    action = RuntimeAction(
        action_id=body["action_id"],
        action_type=body["action_type"],
        target=body.get("target", ""),
    )
    result = await get_executor().dispatch(ctx, action, body.get("payload", {}))
    return {
        "action_id": result.action_id,
        "success": result.success,
        "data": result.data,
        "error": result.error,
    }


def _app_payload(app: ApphubApp) -> dict:
    raw = asdict(app)
    # Snapshots are fetched via /versions, not copied into every registry card.
    raw.pop("versions")
    raw.pop("releases")
    raw["published_version"] = next((v.get("version") for v in app.versions
                                     if v.get("versionId") == app.published_version_id), None)
    raw["module_count"] = sum(m.app_code == app.code for m in list_modules(app.tenant_id))
    return raw


async def _validate_modules(request: Request, modules: list[dict]) -> None:
    for module in modules:
        for page in module.get("pages", []):
            definition = page.get("definition", {})
            if definition.get("binding"):
                async with ontology_client(request) as client:
                    definition["binding"] = await validate_order_binding(client, _tenant_id(request), definition["binding"])


def _runtime_binding(ctx, page_id: str) -> dict:
    page = next((p for m in ctx.modules for p in m.get("pages", []) if p.get("id") == page_id), None)
    if not page or not page.get("definition", {}).get("binding"):
        raise HTTPException(status_code=404, detail="Published order binding not found")
    return page["definition"]["binding"]


async def _publication_report(request: Request, app: ApphubApp, modules: list[dict]) -> dict:
    checks = {key: {"key": key, "status": "unknown", "message": "尚未验证", "next_step": "重新检查"}
              for key in ("bindings", "reference_versions", "access", "components", "action_policy", "runtime")}
    def record(key, status, message, next_step=""):
        checks[key].update(status=status, message=message, next_step=next_step)
    allowed = request.state.ctx.has_scope("platform.read") and request.state.ctx.has_scope("platform.write")
    record("access", "pass" if allowed else "fail", "当前租户的读取与发布权限" if allowed else "缺少 platform.read / platform.write",
           "" if allowed else "使用具有读取和发布权限的身份重试")
    pages = [p for m in modules for p in m.get("pages", [])]
    runnable = any(p.get("definition", {}).get("widgets") or p.get("definition", {}).get("binding") for p in pages)
    record("components", "pass" if runnable else "fail", "已保存可运行页面" if runnable else "没有已保存的可运行页面",
           "" if runnable else "在页面设计器保存组件或订单绑定")
    bindings = [p["definition"]["binding"] for p in pages if p.get("definition", {}).get("binding")]
    if not bindings:
        for key in ("bindings", "reference_versions", "action_policy"):
            record(key, "pass" if runnable else "unknown", "该页面没有本体绑定或审核动作" if runnable else "需先保存页面",
                   "" if runnable else "保存页面后重新检查")
    else:
        try:
            await _validate_modules(request, modules)
            record("bindings", "pass", f"已验证 {len(bindings)} 个订单、客户与关系绑定")
            record("reference_versions", "pass", "模型版本及 Action / 关系指纹与已保存绑定一致")
            record("action_policy", "pass", "注册 Action 的目标类型有效；执行仍须人工 USER 确认及写权限")
        except HTTPException as exc:
            key = "reference_versions" if exc.status_code == 409 else "access" if exc.status_code in {401, 403} else "bindings"
            record(key, "unknown" if exc.status_code >= 500 else "fail", str(exc.detail), "修复绑定、权限或服务连接后重新检查")
    if runnable and allowed and all(checks[k]["status"] == "pass" for k in ("bindings", "reference_versions", "action_policy")):
        try:
            for binding in bindings:
                await _read_order_binding(request, binding, app.version)
            ctx = load_app_runtime(app.tenant_id, app.id)
            if not render_page(replace(ctx, modules=modules)):
                raise HTTPException(status_code=422, detail="Runtime has no renderable pages")
            record("runtime", "pass", "已加载保存的运行树及实际绑定数据（不执行动作）")
        except HTTPException as exc:
            record("runtime", "unknown" if exc.status_code >= 500 else "fail", str(exc.detail), "检查实际 ObjectSet、关系数据和服务连接后重试")
    return {"app_id": app.id, "draft_version": app.version, "revision": app.revision,
            "checked_at": _now_iso(), "can_publish": all(c["status"] == "pass" for c in checks.values()),
            "checks": list(checks.values())}


@router.get("/apps/{app_id}/publication-check", operation_id="apphubCheckPublication")
async def check_publication(app_id: str, request: Request) -> dict:
    app = _release_app(_tenant_id(request), app_id)
    ctx = load_app_runtime(app.tenant_id, app.id)
    return await _publication_report(request, app, deepcopy(ctx.modules))


async def _capture_snapshot(request: Request, app: ApphubApp, version: str) -> dict:
    ctx = load_app_runtime(app.tenant_id, app.id)
    modules = deepcopy(ctx.modules)
    report = await _publication_report(request, app, modules)
    if not report["can_publish"]:
        raise HTTPException(status_code=422, detail={"message": "Publication validation failed", "validation": report})
    return {"versionId": f"ver-{uuid.uuid4().hex}", "appId": app.id, "version": version,
            "status": "DRAFT", "createdAt": _now_iso(), "modules": modules}


@router.post("/apps/{app_id}/publish", operation_id='apphubPostAppPublish')
async def publish_app(app_id: str, request: Request) -> dict:
    tenant_id = _tenant_id(request)
    app = _release_app(tenant_id, app_id)
    snapshot = await _capture_snapshot(request, app, app.version)
    now = _now_iso()
    snapshot.update(status="PUBLISHED", publishedAt=now)
    published = replace(app, status="PUBLISHED", updated_at=now,
                        published_version_id=snapshot["versionId"],
                        versions=[snapshot, *app.versions])
    put_app(tenant_id, published)
    _emit(request, "apphub.app.published", app.id, {"version": app.version, "status": "PUBLISHED"}, tenant_id)
    return {"app_id": app.id, "status": "PUBLISHED", "version": app.version, "version_id": snapshot["versionId"]}


# ---------------------------------------------------------------------------
# APPHUB-RUNTIME-01 phase C: short-link endpoints
# ---------------------------------------------------------------------------
@router.get("/shortlinks/{code}", operation_id='apphubGetShortlink')
async def resolve_shortlink_endpoint(code: str, request: Request) -> dict:
    """Resolve a short code to its bound app metadata."""
    tenant_id = _tenant_id(request)
    try:
        result = resolve_shortlink(get_default_store(), tenant_id, code)
    except ValueError:
        raise HTTPException(status_code=404, detail="shortlink not found") from None
    return result


@router.post("/shortlinks", status_code=201, operation_id='apphubPostShortlink')
async def create_shortlink_endpoint(request: Request) -> dict:
    """Create a new short-link for an app."""
    tenant_id = _tenant_id(request)
    body = await request.json()
    app = _release_app(tenant_id, body.get("app_id", ""))
    if app.status != "PUBLISHED" or not app.published_version_id:
        raise HTTPException(status_code=409, detail="App must be published before creating a shortlink")
    runtime = load_app_runtime(tenant_id, app.id, published_only=True)
    await _validate_modules(request, runtime.modules)
    expires_at_raw = body.get("expires_at")
    expires_at_dt: datetime | None = None
    if expires_at_raw:
        expires_at_dt = datetime.fromisoformat(expires_at_raw)
    entry = create_shortlink(
        get_default_store(),
        tenant_id,
        app.id,
        None,
        expires_at_dt,
    )
    _emit(
        request,
        "apphub.shortlink.created",
        entry.code,
        {"app_id": body["app_id"]},
        tenant_id,
    )
    return {
        "code": entry.code,
        "app_id": entry.app_id,
        "created_at": entry.created_at,
    }


@router.get("/shortlinks", operation_id='apphubListShortlinks')
async def list_shortlinks_endpoint(request: Request) -> dict:
    """List all short-links for the current tenant."""
    tenant_id = _tenant_id(request)
    entries = list_shortlinks(get_default_store(), tenant_id)
    return {
        "items": [
            {"code": e.code, "app_id": e.app_id, "created_at": e.created_at} for e in entries
        ],
    }


# ---------------------------------------------------------------------------
# WFE embedded: Form Designer (联调 integration)
# ---------------------------------------------------------------------------
_FORMS: dict[str, dict[str, Any]] = {}


@router.get("/v1/wfe/forms/{form_id}")
async def get_form_definition(request: Request, form_id: str) -> dict:
    tid = _tenant_id(request)
    key = f"{tid}:{form_id}"
    form = _FORMS.get(key)
    if form is None:
        form = {
            "formId": form_id,
            "appId": "",
            "globalSettings": {},
            "linkageRules": [],
            "scripts": {},
            "fields": [],
            "createdAt": "",
            "updatedAt": "",
        }
        _FORMS[key] = form
    return form


@router.put("/v1/wfe/forms/{form_id}/settings")
async def save_form_settings(request: Request, form_id: str) -> dict:
    body = await request.json()
    tid = _tenant_id(request)
    key = f"{tid}:{form_id}"
    form = _FORMS.get(key) or await get_form_definition(request, form_id)
    form["globalSettings"] = body
    form["updatedAt"] = _now_iso()
    _FORMS[key] = form
    return form


@router.put("/v1/wfe/forms/{form_id}/linkage-rules")
async def save_form_linkage_rules(request: Request, form_id: str) -> dict:
    body = await request.json()
    tid = _tenant_id(request)
    key = f"{tid}:{form_id}"
    form = _FORMS.get(key) or await get_form_definition(request, form_id)
    form["linkageRules"] = body.get("rules", [])
    form["updatedAt"] = _now_iso()
    _FORMS[key] = form
    return form


@router.put("/v1/wfe/forms/{form_id}/scripts")
async def save_form_scripts(request: Request, form_id: str) -> dict:
    body = await request.json()
    tid = _tenant_id(request)
    key = f"{tid}:{form_id}"
    form = _FORMS.get(key) or await get_form_definition(request, form_id)
    form["scripts"] = body
    form["updatedAt"] = _now_iso()
    _FORMS[key] = form
    return form


@router.post("/v1/wfe/forms/{form_id}/validate")
async def validate_form(request: Request, form_id: str) -> dict:
    return {"valid": True, "errors": []}


# ---------------------------------------------------------------------------
# WFE embedded: Flow Designer (联调 integration)
# ---------------------------------------------------------------------------
_FLOWS: dict[str, dict[str, Any]] = {}


@router.get("/v1/wfe/flows/{module_id}")
async def get_flow(request: Request, module_id: str) -> dict:
    tid = _tenant_id(request)
    key = f"{tid}:{module_id}"
    flow = _FLOWS.get(key)
    if flow is None:
        flow = {"moduleId": module_id, "name": "", "nodes": [], "edges": [], "bpmnXml": ""}
        _FLOWS[key] = flow
    return flow


@router.put("/v1/wfe/flows/{module_id}")
async def save_flow(request: Request, module_id: str) -> dict:
    body = await request.json()
    tid = _tenant_id(request)
    key = f"{tid}:{module_id}"
    flow = body
    flow["moduleId"] = module_id
    _FLOWS[key] = flow
    return flow


@router.post("/wfe/flows/validate")
async def validate_flow(request: Request) -> dict:
    body = await request.json()
    nodes = body.get("nodes", [])
    errors = []
    if not nodes:
        errors.append({"code": "NO_NODES", "message": "流程至少需要一个节点"})
    return {"valid": len(errors) == 0, "errors": errors, "warnings": []}


@router.post("/wfe/flows/test")
async def test_flow(request: Request) -> dict:
    body = await request.json()
    nodes = body.get("nodes", [])
    steps = [
        {
            "stepIndex": i + 1,
            "nodeId": n.get("id", ""),
            "nodeName": n.get("name", ""),
            "nodeType": n.get("type", "start"),
            "action": "complete",
            "actionLabel": "模拟执行",
            "timestamp": _now_iso(),
            "status": "completed",
        }
        for i, n in enumerate(nodes[:3])
    ]
    return {"steps": steps, "finalStatus": "approved", "duration": 0}


@router.post("/v1/wfe/flows/{module_id}/publish")
async def publish_flow(request: Request, module_id: str) -> dict:
    body = await request.json()
    tid = _tenant_id(request)
    key = f"{tid}:{module_id}"
    flow = body
    flow["moduleId"] = module_id
    flow["published"] = True
    _FLOWS[key] = flow
    return {"success": True, "message": "流程已发布"}


# ---------------------------------------------------------------------------
# App versions (联调 integration)
# ---------------------------------------------------------------------------

def _release_app(tenant_id: str, app_id: str) -> ApphubApp:
    """Resolve exact public ID before considering the tenant-local code."""
    app = get_app(tenant_id, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="app not found")
    return app


def _find_release(tenant_id: str, release_id: str) -> tuple[ApphubApp, dict[str, Any]]:
    for app in list_apps(tenant_id):
        for record in app.releases:
            if record["releaseId"] == release_id:
                return app, deepcopy(record)
    raise HTTPException(status_code=404, detail="release not found")


def _find_release_process(tenant_id: str, process_id: str) -> tuple[ApphubApp, dict[str, Any]]:
    for app in list_apps(tenant_id):
        for record in app.releases:
            if record.get("processInstanceId") == process_id:
                return app, deepcopy(record)
    raise HTTPException(status_code=404, detail="approval process not found")


def _release_dto(record: dict) -> dict:
    return {k: v for k, v in record.items() if k not in {"tasks", "logs", "snapshot"}}


@router.get("/apps/{app_id}/versions", operation_id='apphubListAppVersions')
async def list_app_versions(request: Request, app_id: str) -> dict:
    app = _release_app(_tenant_id(request), app_id)
    return {"items": app.versions, "total": len(app.versions)}


@router.post("/apps/{app_id}/versions", status_code=201, operation_id='apphubCreateAppVersion')
async def create_app_version(request: Request, app_id: str) -> dict:
    tid = _tenant_id(request)
    app = _release_app(tid, app_id)
    body = await request.json()
    version = body.get("version", app.version)
    if not isinstance(version, str) or not _SEMVER_RE.fullmatch(version):
        raise HTTPException(status_code=422, detail="Invalid semver")
    snapshot = await _capture_snapshot(request, app, version)
    snapshot["changeLog"] = str(body.get("changeLog", ""))
    put_app(tid, replace(app, versions=[snapshot, *app.versions], updated_at=_now_iso()))
    return snapshot


@router.post("/apps/{app_id}/versions/{version_id}/publish", operation_id='apphubPublishAppVersion')
async def publish_app_version(request: Request, app_id: str, version_id: str) -> dict:
    tid = _tenant_id(request)
    app = _release_app(tid, app_id)
    versions = deepcopy(app.versions)
    snapshot = next((v for v in versions if v["versionId"] == version_id), None)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="version not found")
    await _validate_modules(request, snapshot["modules"])
    snapshot.update(status="PUBLISHED", publishedAt=_now_iso())
    put_app(tid, replace(app, status="PUBLISHED", version=snapshot["version"],
                        published_version_id=version_id, versions=versions, updated_at=_now_iso()))
    return snapshot


@router.post("/apps/{app_id}/versions/{version_id}/rollback", operation_id='apphubRollbackAppVersion')
async def rollback_app_version(request: Request, app_id: str, version_id: str) -> dict:
    return await publish_app_version(request, app_id, version_id)


@router.delete("/apps/{app_id}/versions/{version_id}", operation_id='apphubDeleteAppVersion')
async def delete_app_version(request: Request, app_id: str, version_id: str) -> dict:
    tid = _tenant_id(request)
    app = _release_app(tid, app_id)
    if app.published_version_id == version_id:
        raise HTTPException(status_code=409, detail="Cannot delete the running published version")
    put_app(tid, replace(app, versions=[v for v in app.versions if v["versionId"] != version_id]))
    return {"deleted": version_id}


# ---------------------------------------------------------------------------
# App release records and approval tasks
# ---------------------------------------------------------------------------
@router.get("/apps/{app_id}/releases", operation_id='apphubListAppReleases')
async def list_app_releases(request: Request, app_id: str,
                            page: int = Query(default=1, ge=1), size: int = Query(default=20, ge=1, le=100)) -> dict:
    app = _release_app(_tenant_id(request), app_id)
    start = (page - 1) * size
    return {"items": [_release_dto(r) for r in app.releases[start:start + size]], "total": len(app.releases)}


@router.post("/apps/{app_id}/releases", status_code=201, operation_id='apphubCreateAppRelease')
async def create_app_release(request: Request, app_id: str) -> dict:
    tid = _tenant_id(request)
    app = _release_app(tid, app_id)
    body = await request.json()
    version = str(body.get("version", ""))
    if not _SEMVER_RE.fullmatch(version):
        raise HTTPException(status_code=422, detail="invalid semver")
    if body.get("strategy", "FULL") != "FULL":
        raise HTTPException(status_code=422, detail="Grayscale routing is not implemented; use FULL")
    snapshot = await _capture_snapshot(request, app, version)
    now, actor = _now_iso(), str(request.state.ctx.user_id)
    release_id = "rel-" + uuid.uuid4().hex
    record = {
        "releaseId": release_id, "appId": app.id, "version": version,
        "basePublishedVersionId": app.published_version_id, "versionId": snapshot["versionId"], "releaseNotes": str(body.get("releaseNotes", "")),
        "strategy": "FULL", "grayPercent": 0, "grayUsers": [], "grayDepts": [],
        "status": "PENDING_APPROVAL", "approvalStatus": "PENDING",
        "processInstanceId": "release-process-" + uuid.uuid4().hex,
        "createdBy": actor, "createdAt": now, "snapshot": snapshot,
        "logs": [{"logId": "log-" + uuid.uuid4().hex, "releaseId": release_id,
                  "action": "提交发布申请", "operator": actor, "remark": str(body.get("releaseNotes", "")), "createdAt": now}],
        "tasks": [{"id": "task-" + uuid.uuid4().hex, "name": title, "assignee": body.get(key) or actor,
                   "status": "ACTIVE", "createTime": now}
                  for title, key in (("技术负责人审批", "techLeadId"), ("运维审批", "opsOwnerId"))],
    }
    put_app(tid, replace(app, releases=[record, *app.releases], updated_at=now))
    _emit(request, "apphub.release.created", release_id, {"appId": app.id, "version": version}, tid)
    return _release_dto(record)


@router.get("/releases/{release_id}", operation_id='apphubGetAppRelease')
async def get_app_release(request: Request, release_id: str) -> dict:
    _, record = _find_release(_tenant_id(request), release_id)
    return _release_dto(record)


@router.get("/releases/{release_id}/logs", operation_id='apphubListReleaseLogs')
async def list_release_logs(request: Request, release_id: str) -> list[dict[str, Any]]:
    _, record = _find_release(_tenant_id(request), release_id)
    return record["logs"]


@router.get("/v1/wfe/release-approval/{process_instance_id}/tasks", operation_id='apphubListReleaseTasks')
async def list_release_tasks(request: Request, process_instance_id: str) -> list[dict[str, Any]]:
    _, record = _find_release_process(_tenant_id(request), process_instance_id)
    return record["tasks"]


@router.post("/v1/wfe/release-approval/{process_instance_id}/tasks/{task_id}/complete", operation_id='apphubCompleteReleaseTask')
async def complete_release_task(request: Request, process_instance_id: str, task_id: str) -> dict[str, Any]:
    tid = _tenant_id(request)
    if str(request.state.ctx.auth_method) != "user":
        raise HTTPException(status_code=403, detail="Authenticated human approval required")
    app, record = _find_release_process(tid, process_instance_id)
    if record["status"] != "PENDING_APPROVAL":
        raise HTTPException(status_code=409, detail="Release already decided")
    task = next((t for t in record["tasks"] if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="approval task not found")
    if task["assignee"] != str(request.state.ctx.user_id):
        raise HTTPException(status_code=403, detail="Only the assigned human can decide")
    if task["status"] != "ACTIVE":
        raise HTTPException(status_code=409, detail="approval task already completed")
    body = await request.json()
    if not isinstance(body.get("approved"), bool):
        raise HTTPException(status_code=422, detail="approved must be boolean")
    task.update(status="COMPLETED", endTime=_now_iso())
    if not body["approved"]:
        record.update(status="REJECTED", approvalStatus="REJECTED")
        action = "审批驳回"
    elif all(t["status"] == "COMPLETED" for t in record["tasks"]):
        if app.published_version_id != record.get("basePublishedVersionId"):
            raise HTTPException(status_code=409, detail="Running version changed; recreate the release or use explicit rollback")
        await _validate_modules(request, record["snapshot"]["modules"])
        record.update(status="PUBLISHED", approvalStatus="APPROVED", publishedAt=_now_iso())
        snapshot = record["snapshot"]
        snapshot.update(status="PUBLISHED", publishedAt=_now_iso())
        app = replace(app, status="PUBLISHED", version=snapshot["version"],
                      published_version_id=snapshot["versionId"], versions=[snapshot, *app.versions])
        action = "发布完成"
    else:
        action = "审批通过"
    record["logs"].append({"logId": "log-" + uuid.uuid4().hex, "releaseId": record["releaseId"],
                          "action": action, "operator": str(request.state.ctx.user_id),
                          "remark": str(body.get("comment", "")), "createdAt": _now_iso()})
    put_app(tid, replace(app, releases=[record if r["releaseId"] == record["releaseId"] else r for r in app.releases],
                         updated_at=_now_iso()))
    return {"taskId": task_id, "action": action, "status": task["status"], "message": action}


@router.get("/pages/{page_id}", operation_id='apphubGetPageDetail')
async def get_page_detail(request: Request, page_id: str) -> dict:
    tid = _tenant_id(request)
    for page in list_pages(tid):
        if page.id == page_id:
            return {"id": page.id, "name": page.name, "layout": page.layout,
                    "widgets": [], "scripts": {}, **page.definition}
    raise HTTPException(status_code=404, detail="page not found")


class PageSaveRequest(BaseModel):
    name: str
    layout: str = "grid"
    widgets: list[dict[str, Any]] = Field(default_factory=list)
    scripts: dict[str, Any] = Field(default_factory=dict)
    binding: dict[str, Any] | None = None
    description: str = ""


@router.put("/pages/{page_id}", operation_id="apphubSavePage")
async def save_page(request: Request, page_id: str, body: PageSaveRequest) -> dict:
    tid = _tenant_id(request)
    page = next((p for p in list_pages(tid) if p.id == page_id), None)
    if page is None:
        raise HTTPException(status_code=404, detail="page not found")
    definition = body.model_dump(exclude_none=True)
    put_page(tid, replace(page, name=body.name, layout=body.layout, definition=definition,
                          schema_version=page.schema_version + 1))
    metadata_updated = True
    module = get_module(tid, page.module_code)
    if module:
        # Module associations store a code, not a public ID-or-code input.
        app = next((a for a in list_apps(tid) if a.code == module.app_code), None)
        if app:
            try:
                put_app(tid, replace(app, updated_at=_now_iso()))
            except HTTPException as exc:
                if exc.status_code != 409:
                    raise
                metadata_updated = False
    return {"id": page.id, **definition, "application_metadata_updated": metadata_updated}


@router.get("/bindings/usage", operation_id="apphubGetObjectBindingUsage")
async def get_object_binding_usage(request: Request, class_rid: str) -> dict:
    tid = _tenant_id(request)
    if not class_rid.startswith(f"ont.{tid}."):
        raise HTTPException(status_code=403, detail="cross-tenant binding usage denied")
    items = []
    pages = list_pages(tid)
    modules = list_modules(tid)
    for app in list_apps(tid):
        module_codes = {m.code for m in modules if m.app_code == app.code}
        candidates = [("DRAFT", None, p.id, p.definition.get("binding")) for p in pages if p.module_code in module_codes]
        for version in app.versions:
            if version.get("versionId") != app.published_version_id:
                continue
            candidates.extend((app.status, version["versionId"], p.get("id"), p.get("definition", {}).get("binding"))
                              for m in version.get("modules", []) for p in m.get("pages", []))
        for status, version_id, page_id, binding in candidates:
            if binding and class_rid in (binding.get("object_type"), binding.get("customer_type")):
                items.append({"app_id": app.id, "app_name": app.name, "page_id": page_id,
                              "status": status, "version_id": version_id, "model_version": class_rid,
                              "model_checksum": binding.get("model_checksum" if class_rid == binding.get("object_type") else "customer_checksum"),
                              "action_rid": binding.get("action_rid")})
    return {"items": items, "total": len(items)}


@router.get("/apps/{app_id}/runtime/data", operation_id="apphubGetOrderRuntimeData")
async def get_order_runtime_data(request: Request, app_id: str, page_id: str) -> dict:
    tid = _tenant_id(request)
    try:
        ctx = load_app_runtime(tid, app_id, published_only=True)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    return await _read_order_binding(request, _runtime_binding(ctx, page_id), ctx.version)


async def _read_order_binding(request: Request, spec: dict, version: str) -> dict:
    async with ontology_client(request) as client:
        binding = await validate_order_binding(client, _tenant_id(request), spec)
        orders = await ontology_request(client, "POST", "/object-sets:evaluate", json=binding["object_set"])
        customers = await ontology_request(client, "POST", "/object-sets:evaluate",
                                          json={"class_rid": binding["customer_type"], "paging_limit": 1000})
        links = await ontology_request(client, "GET", "/link-instances", params={"link_type_rid": binding["link_type"], "limit": 1000})
    return {"orders": orders, "customers": customers, "links": links, "binding": binding, "version": version}


@router.post("/pages/{page_id}/preview", operation_id="apphubPreviewOrderPage")
async def preview_order_page(request: Request, page_id: str, body: PageSaveRequest) -> dict:
    tid = _tenant_id(request)
    if not any(page.id == page_id for page in list_pages(tid)):
        raise HTTPException(status_code=404, detail="page not found")
    if not body.binding:
        raise HTTPException(status_code=422, detail="Order binding required for preview")
    return await _read_order_binding(request, body.binding, "DRAFT_PREVIEW")


@router.get("/apps/{app_id}/runtime/history", operation_id="apphubGetOrderRuntimeHistory")
async def get_order_runtime_history(request: Request, app_id: str, page_id: str,
                                    version_id: str | None = None,
                                    limit: int = Query(default=100, ge=1, le=1000)) -> list[dict]:
    app = _release_app(_tenant_id(request), app_id)
    selected = version_id or app.published_version_id
    snapshot = next((v for v in app.versions if v.get("versionId") == selected and v.get("status") == "PUBLISHED"), None)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Published snapshot not found")
    page = next((p for m in snapshot.get("modules", []) for p in m.get("pages", []) if p.get("id") == page_id), None)
    if not page or not page.get("definition", {}).get("binding"):
        raise HTTPException(status_code=404, detail="Page does not belong to the published snapshot")
    async with ontology_client(request) as client:
        return await ontology_request(client, "GET", "/action-audit", params={"limit": limit,
            "action_rid": page["definition"]["binding"]["action_rid"], "app_id": app.id,
            "page_id": page_id, "app_version_id": snapshot["versionId"]})


class AppProposalContextRequest(BaseModel):
    page_id: str
    version_id: str
    action_rid: str
    target_iid: str


@router.post("/apps/{app_id}/runtime/proposal-context", operation_id="apphubValidateProposalContext")
async def validate_proposal_context(request: Request, app_id: str, body: AppProposalContextRequest) -> dict:
    """Read-only attribution check; never creates a proposal or executes an action."""
    tid = _tenant_id(request, require_write=False)
    if not request.state.ctx.has_scope("platform.read"):
        raise HTTPException(status_code=403, detail="platform.read required")
    app = _release_app(tid, app_id)
    if app.id != app_id:
        raise HTTPException(status_code=404, detail="Exact application ID required")
    if app.status != "PUBLISHED":
        raise HTTPException(status_code=409, detail="Application is not published")
    snapshot = next((v for v in app.versions if v.get("versionId") == body.version_id and v.get("status") == "PUBLISHED"), None)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Published snapshot not found")
    page = next((p for m in snapshot.get("modules", []) for p in m.get("pages", []) if p.get("id") == body.page_id), None)
    binding = page.get("definition", {}).get("binding") if page else None
    if not binding or body.action_rid != binding.get("action_rid"):
        raise HTTPException(status_code=422, detail="Action/page does not match the published binding")
    async with ontology_client(request) as client:
        binding = await validate_order_binding(client, tid, binding)
        rows = await ontology_request(client, "POST", "/object-sets:evaluate", json=binding["object_set"])
    if body.target_iid not in {row["rid"] for row in rows}:
        raise HTTPException(status_code=422, detail="Target is outside the published ObjectSet")
    return {"app_id": app.id, "page_id": body.page_id, "app_version_id": snapshot["versionId"], "app_version": snapshot["version"]}
