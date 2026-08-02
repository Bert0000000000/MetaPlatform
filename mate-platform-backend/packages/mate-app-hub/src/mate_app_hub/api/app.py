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
from dataclasses import asdict
from datetime import datetime
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
