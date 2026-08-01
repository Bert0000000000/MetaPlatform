"""FastAPI router exposing the dw endpoints (FR-DW-001..015).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

15 endpoints under `/api/v1/dw/*`:

  GET  /api/v1/dw/auth/login          — digital employee login records
  GET  /api/v1/dw/collaborations      — peer collaboration sessions
  GET  /api/v1/dw/commit              — commit history (kb/agent/flow/form)
  GET  /api/v1/dw/documents           — documents uploaded to knowledge bases
  POST /api/v1/dw/documents/upload    — upload a new document (stub)
  GET  /api/v1/dw/employees           — digital employees
  GET  /api/v1/dw/employees/tasks     — employee task history
  GET  /api/v1/dw/evaluations         — employee evaluations
  GET  /api/v1/dw/extract             — fact extraction records
  GET  /api/v1/dw/knowledge-bases     — knowledge bases
  GET  /api/v1/dw/learning/extract    — learning extraction records
  GET  /api/v1/dw/learning/feedback   — learning feedback records
  GET  /api/v1/dw/models              — LLM models available
  GET  /api/v1/dw/tools               — tools (mcp / function / flow)
  GET  /api/v1/dw/traces              — invocation traces

The router is mounted by `mate_tech_dw.main.create_app()` after
`install_auth(app)` so the bearer-token middleware populates
`request.state.ctx` before any handler runs.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import asdict

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    DwDocument,
    list_auth_logins,
    list_collaborations,
    list_commits,
    list_documents,
    append_document,
    list_employees,
    list_employee_tasks,
    list_evaluations,
    list_extracts,
    list_knowledge_bases,
    list_learning_extracts,
    list_learning_feedback,
    list_models,
    list_tools,
    list_traces,
)

router = APIRouter(prefix="/api/v1/dw", tags=["dw"])


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


def _paginate(items: list, page: int, size: int) -> dict:
    """Apply pagination to a list of items."""
    total = len(items)
    pages = (total + size - 1) // size if size > 0 else 0
    start = (page - 1) * size
    end = start + size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


# ---------------------------------------------------------------------------
# 1. GET /auth/login
# ---------------------------------------------------------------------------
@router.get("/auth/login")
async def dw_get_auth_login(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_auth_logins(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 2. GET /collaborations
# ---------------------------------------------------------------------------
@router.get("/collaborations")
async def dw_get_collaborations(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_collaborations(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 3. GET /commit
# ---------------------------------------------------------------------------
@router.get("/commit")
async def dw_get_commit(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_commits(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 4. GET /documents
# ---------------------------------------------------------------------------
@router.get("/documents")
async def dw_get_documents(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_documents(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 5. POST /documents/upload (stub — accepts ApiResponse schema)
# ---------------------------------------------------------------------------
class DocumentUploadRequest(BaseModel):
    """Body schema for POST /documents/upload.

    Matches the OpenAPI `ApiResponse` schema (all fields optional
    except code/message/data). The dw stub ignores the body content
    and returns a synthesized document record so the contract test
    can verify the endpoint exists.
    """
    name: str | None = None
    kind: str | None = "pdf"
    size_bytes: int | None = 0
    kb_id: str | None = None


@router.post("/documents/upload")
async def dw_post_documents_upload(
    request: Request,
    body: DocumentUploadRequest,
) -> dict:
    tenant_id = _tenant_id(request)
    # Extract uploader from ctx (sub) — fall back to "anonymous"
    ctx = getattr(request.state, "ctx", None)
    raw_user = getattr(ctx, "user_id", None) if ctx else None
    uploader = str(raw_user) if raw_user else "anonymous"
    doc = DwDocument(
        id=f"dw-doc-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        name=body.name or "untitled",
        kind=body.kind or "pdf",
        size_bytes=body.size_bytes or 0,
        uploaded_by=uploader,
        uploaded_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        kb_id=body.kb_id or "dw-kb-default",
    )
    append_document(tenant_id, doc)
    return {
        "code": 0,
        "message": "ok",
        "data": asdict(doc),
    }


# ---------------------------------------------------------------------------
# 6. GET /employees
# ---------------------------------------------------------------------------
@router.get("/employees")
async def dw_get_employees(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_employees(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 7. GET /employees/tasks
# ---------------------------------------------------------------------------
@router.get("/employees/tasks")
async def dw_get_employees_tasks(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_employee_tasks(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 8. GET /evaluations
# ---------------------------------------------------------------------------
@router.get("/evaluations")
async def dw_get_evaluations(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_evaluations(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 9. GET /extract
# ---------------------------------------------------------------------------
@router.get("/extract")
async def dw_get_extract(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_extracts(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 10. GET /knowledge-bases
# ---------------------------------------------------------------------------
@router.get("/knowledge-bases")
async def dw_get_knowledge_bases(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_knowledge_bases(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 11. GET /learning/extract
# ---------------------------------------------------------------------------
@router.get("/learning/extract")
async def dw_get_learning_extract(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_learning_extracts(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 12. GET /learning/feedback
# ---------------------------------------------------------------------------
@router.get("/learning/feedback")
async def dw_get_learning_feedback(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_learning_feedback(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 13. GET /models
# ---------------------------------------------------------------------------
@router.get("/models")
async def dw_get_models(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_models(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 14. GET /tools
# ---------------------------------------------------------------------------
@router.get("/tools")
async def dw_get_tools(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_tools(tenant_id))
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# 15. GET /traces
# ---------------------------------------------------------------------------
@router.get("/traces")
async def dw_get_traces(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    tenant_id = _tenant_id(request)
    items = _serialize(list_traces(tenant_id))
    return _paginate(items, page, size)
