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

The router is mounted by `mate_app_hub.main.create_app()` after
`install_auth(app)` so the bearer-token middleware populates
`request.state.ctx` before any handler runs.
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Query, Request

from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    list_apps,
    list_groups,
    list_modules,
    list_pages,
    list_templates,
)

router = APIRouter(prefix="/api/v1/apphub", tags=["apphub"])


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
