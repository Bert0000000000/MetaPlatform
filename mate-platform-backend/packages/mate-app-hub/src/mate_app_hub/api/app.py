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
import uuid
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    ApphubApp,
    ApphubGroup,
    ApphubModule,
    ApphubPage,
    ApphubTemplate,
    delete_app,
    delete_group,
    get_app,
    get_group,
    get_module,
    get_template,
    list_apps,
    list_groups,
    list_modules,
    list_pages,
    list_templates,
    put_app,
    put_group,
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
from ..shortlink import (
    create_shortlink,
    get_default_store,
    list_shortlinks,
    resolve_shortlink,
)

router = APIRouter(prefix="/api/v1/apphub", tags=["apphub"])

# Valid categories (must match an existing group code).
_VALID_CATEGORIES = frozenset({"knowledge", "platform", "data"})

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


def _tenant_id(request: Request) -> str:
    """Return the verified tenant_id for the current request.

    Reads `request.state.ctx` (populated by `install_auth`) and
    delegates to `require_tenant` which raises TenantAccessError
    on anonymous / empty-tenant callers. Returns the bare string
    for repository lookups.
    """
    ctx = request.state.ctx
    tenant_id = require_tenant(ctx)
    return str(tenant_id)


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (ADR-0014 step 3)."""
    writer: InMemoryOutboxWriter | None = getattr(
        request.app.state, "outbox_writer", None
    )
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


@router.get("/apps")
async def list_registered_apps(
    request: Request,
    keyword: str | None = Query(default=None, description="name/code 模糊匹配"),
    category: str | None = Query(default=None, description="category 精确过滤"),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_apps(tenant_id))
    if keyword:
        kw = keyword.lower()
        items = [
            a for a in items
            if kw in a["name"].lower() or kw in a["code"].lower()
        ]
    if category:
        items = [a for a in items if a["category"] == category]
    return {"items": items, "total": len(items)}


@router.get("/apps/groups")
async def list_app_groups(request: Request) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_groups(tenant_id))
    return {"items": items, "total": len(items)}


@router.get("/apps/{app_id}")
async def get_app_detail(request: Request, app_id: str) -> dict:
    """Get a single application detail by id or code."""
    tid = _tenant_id(request)
    # 优先按 id 匹配；fallback 按 code 匹配（get_app 以 code 为 key）
    app = None
    for a in list_apps(tid):
        if app_id in (a.id, a.code):
            app = a
            break
    if app is None:
        raise HTTPException(status_code=404, detail="app not found")
    return _serialize([app])[0]


@router.get("/modules")
async def list_business_modules(
    request: Request,
    app_code: str | None = Query(default=None, description="所属 app 编码"),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_modules(tenant_id))
    if app_code:
        items = [m for m in items if m["app_code"] == app_code]
    return {"items": items, "total": len(items)}


@router.get("/modules/{module_id}")
async def get_module_detail(request: Request, module_id: str) -> dict:
    """Get a single business module detail."""
    tid = _tenant_id(request)
    for m in list_modules(tid):
        if m.id == module_id:
            return _serialize([m])[0]
    raise HTTPException(status_code=404, detail="module not found")


@router.get("/pages")
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


class AppUpdateRequest(BaseModel):
    """Body schema for PATCH /apps/{code}."""
    name: Annotated[str | None, Field(default=None, max_length=256)]
    description: Annotated[str | None, Field(default=None, max_length=2048)]
    version: Annotated[str | None, Field(default=None)]
    owner: Annotated[str | None, Field(default=None, max_length=256)]


@router.post("/apps", status_code=201)
async def register_app(
    request: Request, body: AppRegisterRequest,
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
    existing = get_app(tid, body.code)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"app '{body.code}' already registered",
        )
    app = ApphubApp(
        id=f"app-{body.code}", tenant_id=tid,
        name=body.name, code=body.code, category=body.category,
        description=body.description, version=body.version,
        owner=body.owner, tags=tuple(body.tags),
    )
    put_app(tid, app)
    _emit(
        request, "apphub.app.registered", body.code,
        {"code": body.code, "name": body.name, "version": body.version},
        tid,
    )
    return asdict(app)


@router.patch("/apps/{code}")
async def update_app(
    request: Request, code: str, body: AppUpdateRequest,
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
        id=app.id, tenant_id=tid,
        name=body.name if body.name is not None else app.name,
        code=app.code, category=app.category,
        description=body.description if body.description is not None else app.description,
        version=new_version,
        owner=body.owner if body.owner is not None else app.owner,
        tags=app.tags,
    )
    put_app(tid, updated)
    _emit(
        request, "apphub.app.updated", code,
        {"code": code, "version": new_version}, tid,
    )
    return asdict(updated)


@router.delete("/apps/{code}")
async def delete_app_endpoint(request: Request, code: str) -> dict:
    """Delete an application by code."""
    tid = _tenant_id(request)
    app = get_app(tid, code)
    if app is None:
        raise HTTPException(status_code=404, detail="app not found")
    delete_app(tid, code)
    _emit(request, "apphub.app.deleted", code, {"code": code}, tid)
    return {"deleted": code}


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Group CRUD
# ---------------------------------------------------------------------------
class GroupCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    icon: Annotated[str, Field(default="folder", max_length=64)]
    sort_order: Annotated[int, Field(default=0, ge=0)]


@router.post("/groups", status_code=201)
async def create_group(
    request: Request, body: GroupCreateRequest,
) -> dict:
    """Create a new application group."""
    tid = _tenant_id(request)
    if get_group(tid, body.code) is not None:
        raise HTTPException(status_code=409, detail=f"group '{body.code}' already exists")
    group = ApphubGroup(
        id=f"grp-{body.code}", tenant_id=tid,
        name=body.name, code=body.code,
        icon=body.icon, sort_order=body.sort_order,
    )
    put_group(tid, group)
    _emit(
        request, "apphub.group.created", body.code,
        {"code": body.code, "name": body.name}, tid,
    )
    return asdict(group)


@router.delete("/groups/{code}")
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
# BUSINESS-SLICES deep: Module CRUD
# ---------------------------------------------------------------------------
class ModuleCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=256)]
    code: Annotated[str, Field(min_length=1, max_length=64)]
    app_code: Annotated[str, Field(min_length=1, max_length=64)]
    description: Annotated[str, Field(default="", max_length=2048)]
    entry_path: Annotated[str, Field(default="", max_length=512)]


@router.post("/modules", status_code=201)
async def create_module(
    request: Request, body: ModuleCreateRequest,
) -> dict:
    """Create a new business module.

    The ``app_code`` must reference an existing registered app.
    """
    tid = _tenant_id(request)
    if get_app(tid, body.app_code) is None:
        raise HTTPException(
            status_code=422, detail=f"app '{body.app_code}' not found",
        )
    if get_module(tid, body.code) is not None:
        raise HTTPException(
            status_code=409, detail=f"module '{body.code}' already exists",
        )
    module = ApphubModule(
        id=f"mod-{body.code}", tenant_id=tid,
        name=body.name, code=body.code, app_code=body.app_code,
        description=body.description, entry_path=body.entry_path,
    )
    put_module(tid, module)
    _emit(
        request, "apphub.module.created", body.code,
        {"code": body.code, "app_code": body.app_code}, tid,
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


@router.post("/pages", status_code=201)
async def create_page(
    request: Request, body: PageCreateRequest,
) -> dict:
    """Create a new page template.

    The ``module_code`` must reference an existing module.
    """
    tid = _tenant_id(request)
    if get_module(tid, body.module_code) is None:
        raise HTTPException(
            status_code=422, detail=f"module '{body.module_code}' not found",
        )
    page = ApphubPage(
        id=f"page-{body.code}", tenant_id=tid,
        name=body.name, code=body.code,
        module_code=body.module_code, layout=body.layout,
        schema_version=body.schema_version,
    )
    put_page(tid, page)
    _emit(
        request, "apphub.page.created", body.code,
        {"code": body.code, "module_code": body.module_code}, tid,
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
    request: Request, body: TemplateCreateRequest,
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
            status_code=409, detail=f"template '{body.code}' already exists",
        )
    template = ApphubTemplate(
        id=f"tpl-{body.code}", tenant_id=tid,
        name=body.name, code=body.code,
        template_type=body.template_type,
        description=body.description, content=body.content,
    )
    put_template(tid, template)
    _emit(
        request, "apphub.template.created", body.code,
        {"code": body.code, "template_type": body.template_type}, tid,
    )
    return asdict(template)


# ---------------------------------------------------------------------------
# APPHUB-RUNTIME-01 phase B: runtime engine endpoints
# ---------------------------------------------------------------------------
@router.get("/apps/{app_id}/runtime")
async def get_app_runtime(app_id: str, request: Request) -> dict:
    """Return the runtime context + render tree for an app."""
    tenant_id = _tenant_id(request)
    try:
        ctx = load_app_runtime(tenant_id, app_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="app not found") from None
    nodes = render_page(ctx)
    return {
        "app_id": app_id,
        "version": ctx.version,
        "modules": ctx.modules,
        "render_tree": [asdict(node) for node in nodes],
    }


@router.post("/apps/{app_id}/runtime/execute")
async def execute_runtime_action(app_id: str, request: Request) -> dict:
    """Execute a runtime action (submit_form / trigger_flow / call_api / navigate)."""
    tenant_id = _tenant_id(request)
    body = await request.json()
    try:
        ctx = load_app_runtime(tenant_id, app_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="app not found") from None
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


@router.post("/apps/{app_id}/publish")
async def publish_app(app_id: str, request: Request) -> dict:
    """Mark an app as PUBLISHED and emit an outbox event."""
    tenant_id = _tenant_id(request)
    app = get_app(tenant_id, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="app not found")
    published = ApphubApp(
        id=app.id, tenant_id=app.tenant_id,
        name=app.name, code=app.code, category=app.category,
        description=app.description, version="1.0.0",
        owner=app.owner, tags=app.tags,
    )
    put_app(tenant_id, published)
    _emit(
        request, "apphub.app.published", app_id,
        {"version": "1.0.0", "status": "PUBLISHED"}, tenant_id,
    )
    return {"app_id": app_id, "status": "PUBLISHED", "version": "1.0.0"}


# ---------------------------------------------------------------------------
# APPHUB-RUNTIME-01 phase C: short-link endpoints
# ---------------------------------------------------------------------------
@router.get("/shortlinks/{code}")
async def resolve_shortlink_endpoint(code: str, request: Request) -> dict:
    """Resolve a short code to its bound app metadata."""
    tenant_id = _tenant_id(request)
    try:
        result = resolve_shortlink(get_default_store(), tenant_id, code)
    except ValueError:
        raise HTTPException(status_code=404, detail="shortlink not found") from None
    return result


@router.post("/shortlinks", status_code=201)
async def create_shortlink_endpoint(request: Request) -> dict:
    """Create a new short-link for an app."""
    tenant_id = _tenant_id(request)
    body = await request.json()
    expires_at_raw = body.get("expires_at")
    expires_at_dt: datetime | None = None
    if expires_at_raw:
        expires_at_dt = datetime.fromisoformat(expires_at_raw)
    entry = create_shortlink(
        get_default_store(), tenant_id, body["app_id"],
        body.get("role"), expires_at_dt,
    )
    _emit(
        request, "apphub.shortlink.created", entry.code,
        {"app_id": body["app_id"]}, tenant_id,
    )
    return {
        "code": entry.code,
        "app_id": entry.app_id,
        "created_at": entry.created_at,
    }


@router.get("/shortlinks")
async def list_shortlinks_endpoint(request: Request) -> dict:
    """List all short-links for the current tenant."""
    tenant_id = _tenant_id(request)
    entries = list_shortlinks(get_default_store(), tenant_id)
    return {
        "items": [
            {"code": e.code, "app_id": e.app_id, "created_at": e.created_at}
            for e in entries
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
        form = {"formId": form_id, "appId": "", "globalSettings": {}, "linkageRules": [], "scripts": {}, "fields": [], "createdAt": "", "updatedAt": ""}
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
        {"stepIndex": i + 1, "nodeId": n.get("id", ""), "nodeName": n.get("name", ""),
         "nodeType": n.get("type", "start"), "action": "complete", "actionLabel": "模拟执行",
         "timestamp": _now_iso(), "status": "completed"}
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
_VERSIONS: dict[str, list[dict[str, Any]]] = {}

# Tenant-scoped release records used by the AppHub release tab. The local
# acceptance profile keeps this store in memory; the HTTP contract is shared
# with the production persistence adapter.
_RELEASES: dict[str, list[dict[str, Any]]] = {}
_RELEASE_LOGS: dict[str, list[dict[str, Any]]] = {}
_RELEASE_TASKS: dict[str, list[dict[str, Any]]] = {}


def _release_app(tenant_id: str, app_id: str) -> ApphubApp:
    """Resolve an AppHub app by public id or code."""
    for app in list_apps(tenant_id):
        if app.id == app_id or app.code == app_id:
            return app
    raise HTTPException(status_code=404, detail="app not found")


def _release_key(tenant_id: str, app_id: str) -> str:
    app = _release_app(tenant_id, app_id)
    return f"{tenant_id}:{app.code}"


def _find_release(tenant_id: str, release_id: str) -> tuple[str, dict[str, Any]]:
    for key, records in _RELEASES.items():
        if not key.startswith(f"{tenant_id}:"):
            continue
        for record in records:
            if record["releaseId"] == release_id:
                return key, record
    raise HTTPException(status_code=404, detail="release not found")


@router.get("/apps/{app_id}/versions")
async def list_app_versions(request: Request, app_id: str) -> dict:
    tid = _tenant_id(request)
    key = f"{tid}:{app_id}"
    return {"items": _VERSIONS.get(key, []), "total": len(_VERSIONS.get(key, []))}


@router.post("/apps/{app_id}/versions", status_code=201)
async def create_app_version(request: Request, app_id: str) -> dict:
    body = await request.json()
    tid = _tenant_id(request)
    key = f"{tid}:{app_id}"
    now = _now_iso()
    item = {
        "versionId": f"ver-{uuid.uuid4().hex[:8]}",
        "appId": app_id,
        "version": body.get("version", "1.0.0"),
        "status": "DRAFT",
        "changeLog": body.get("changeLog", ""),
        "snapshot": body.get("snapshot", "{}"),
        "createdAt": now,
    }
    _VERSIONS.setdefault(key, []).insert(0, item)
    return item


@router.post("/apps/{app_id}/versions/{version_id}/publish")
async def publish_app_version(request: Request, app_id: str, version_id: str) -> dict:
    tid = _tenant_id(request)
    key = f"{tid}:{app_id}"
    for v in _VERSIONS.get(key, []):
        if v["versionId"] == version_id:
            v["status"] = "PUBLISHED"
            v["publishedAt"] = _now_iso()
            return v
    raise HTTPException(status_code=404, detail="version not found")


@router.post("/apps/{app_id}/versions/{version_id}/rollback")
async def rollback_app_version(request: Request, app_id: str, version_id: str) -> dict:
    tid = _tenant_id(request)
    key = f"{tid}:{app_id}"
    for v in _VERSIONS.get(key, []):
        if v["versionId"] == version_id:
            v["status"] = "ROLLBACK"
            v["rolledBackAt"] = _now_iso()
            return v
    raise HTTPException(status_code=404, detail="version not found")


@router.delete("/apps/{app_id}/versions/{version_id}")
async def delete_app_version(request: Request, app_id: str, version_id: str) -> dict:
    tid = _tenant_id(request)
    key = f"{tid}:{app_id}"
    _VERSIONS[key] = [v for v in _VERSIONS.get(key, []) if v["versionId"] != version_id]
    return {"deleted": version_id}


# ---------------------------------------------------------------------------
# App release records and approval tasks
# ---------------------------------------------------------------------------
@router.get("/apps/{app_id}/releases")
async def list_app_releases(
    request: Request,
    app_id: str,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """List tenant-scoped release records for an app."""
    tid = _tenant_id(request)
    key = _release_key(tid, app_id)
    records = _RELEASES.get(key, [])
    start = (page - 1) * size
    return {"items": records[start:start + size], "total": len(records)}


@router.post("/apps/{app_id}/releases", status_code=201)
async def create_app_release(request: Request, app_id: str) -> dict:
    """Create a release request and its two-step approval task list."""
    tid = _tenant_id(request)
    key = _release_key(tid, app_id)
    body = await request.json()
    version = str(body.get("version", ""))
    if not _SEMVER_RE.match(version):
        raise HTTPException(status_code=422, detail="invalid version; expected MAJOR.MINOR.PATCH")
    strategy = str(body.get("strategy", "FULL")).upper()
    if strategy not in {"FULL", "GRAYSCALE"}:
        raise HTTPException(status_code=422, detail="strategy must be FULL or GRAYSCALE")

    now = _now_iso()
    release_id = f"rel-{uuid.uuid4().hex[:12]}"
    process_id = f"release-process-{uuid.uuid4().hex[:12]}"
    record = {
        "releaseId": release_id,
        "appId": app_id,
        "version": version,
        "releaseNotes": str(body.get("releaseNotes", "")),
        "strategy": strategy,
        "grayPercent": int(body.get("grayPercent", 0) or 0),
        "grayUsers": list(body.get("grayUsers", []) or []),
        "grayDepts": list(body.get("grayDepts", []) or []),
        "status": "PENDING_APPROVAL",
        "approvalStatus": "PENDING",
        "processInstanceId": process_id,
        "createdBy": str(getattr(request.state.ctx, "user_id", "")),
        "createdAt": now,
    }
    _RELEASES.setdefault(key, []).insert(0, record)
    _RELEASE_LOGS[release_id] = [{
        "logId": f"log-{uuid.uuid4().hex[:12]}",
        "releaseId": release_id,
        "action": "提交发布申请",
        "operator": record["createdBy"],
        "remark": record["releaseNotes"],
        "createdAt": now,
    }]
    _RELEASE_TASKS[process_id] = [
        {
            "id": f"task-{uuid.uuid4().hex[:12]}",
            "name": "技术负责人审批",
            "assignee": body.get("techLeadId", ""),
            "status": "ACTIVE",
            "createTime": now,
        },
        {
            "id": f"task-{uuid.uuid4().hex[:12]}",
            "name": "运维审批",
            "assignee": body.get("opsOwnerId", ""),
            "status": "ACTIVE",
            "createTime": now,
        },
    ]
    _emit(request, "apphub.release.created", release_id, {"appId": app_id, "version": version}, tid)
    return record


@router.get("/releases/{release_id}")
async def get_app_release(request: Request, release_id: str) -> dict:
    tid = _tenant_id(request)
    _, record = _find_release(tid, release_id)
    return record


@router.get("/releases/{release_id}/logs")
async def list_release_logs(request: Request, release_id: str) -> list[dict[str, Any]]:
    tid = _tenant_id(request)
    _find_release(tid, release_id)
    return _RELEASE_LOGS.get(release_id, [])


@router.get("/v1/wfe/release-approval/{process_instance_id}/tasks")
async def list_release_tasks(request: Request, process_instance_id: str) -> list[dict[str, Any]]:
    _tenant_id(request)
    return _RELEASE_TASKS.get(process_instance_id, [])


@router.post("/v1/wfe/release-approval/{process_instance_id}/tasks/{task_id}/complete")
async def complete_release_task(
    request: Request, process_instance_id: str, task_id: str,
) -> dict[str, Any]:
    tid = _tenant_id(request)
    body = await request.json()
    tasks = _RELEASE_TASKS.get(process_instance_id)
    if tasks is None:
        raise HTTPException(status_code=404, detail="approval process not found")
    task = next((item for item in tasks if item["id"] == task_id), None)
    if task is None:
        raise HTTPException(status_code=404, detail="approval task not found")
    if task["status"] != "ACTIVE":
        raise HTTPException(status_code=409, detail="approval task already completed")
    approved = bool(body.get("approved", False))
    task["status"] = "COMPLETED"
    task["endTime"] = _now_iso()
    record = next(
        (item for records in _RELEASES.values() for item in records
         if item.get("processInstanceId") == process_instance_id),
        None,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="release not found")
    if not approved:
        record["status"] = "REJECTED"
        record["approvalStatus"] = "REJECTED"
        action = "审批驳回"
    elif all(item["status"] == "COMPLETED" for item in tasks):
        record["status"] = "PUBLISHED"
        record["approvalStatus"] = "APPROVED"
        action = "发布完成"
    else:
        action = "审批通过"
    release_id = record["releaseId"]
    _RELEASE_LOGS.setdefault(release_id, []).append({
        "logId": f"log-{uuid.uuid4().hex[:12]}",
        "releaseId": release_id,
        "action": action,
        "operator": str(getattr(request.state.ctx, "user_id", "")),
        "remark": str(body.get("comment", "")),
        "createdAt": _now_iso(),
    })
    _emit(request, "apphub.release.updated", release_id, {"status": record["status"]}, tid)
    return {"taskId": task_id, "action": action, "status": task["status"], "message": action}


@router.get("/pages/{page_id}")
async def get_page_detail(request: Request, page_id: str) -> dict:
    tid = _tenant_id(request)
    for p in list_pages(tid):
        if p.id == page_id:
            raw = asdict(p)
            return {
                "id": raw.get("id", page_id),
                "name": raw.get("name", ""),
                "description": raw.get("description", ""),
                "layout": raw.get("layout", "grid"),
                "widgets": raw.get("widgets", []) or [],
                "scripts": raw.get("scripts", {}) or {},
            }
    raise HTTPException(status_code=404, detail="page not found")
