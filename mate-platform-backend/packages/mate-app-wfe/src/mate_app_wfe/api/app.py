"""FastAPI router exposing the wfe endpoints (FR-WFE-001..002).

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`)
before touching the repository. The repository itself does not
double-check the tenant — the guard is the source of truth.

2 endpoints under `/api/v1/wfe/*`:

  POST /api/v1/wfe/flows/test       — dry-run a BPMN flow definition
  GET  /api/v1/wfe/flows/validate   — list flow validation results (paginated)

Write handlers emit `<domain>.<aggregate>.<verb>` outbox events via
`app.state.outbox_writer` (ADR-0014 step 3).
"""
from __future__ import annotations

import time
import uuid
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

from ..clients import FlowableClient
from ..repositories import (
    FlowDefinition,
    append_test_run,
    append_validation,
    delete_flow,
    deploy_flow,
    get_flow,
    list_flows,
    list_validations,
    put_flow,
    update_flow_status,
    validate_bpmn,
)

router = APIRouter(prefix="/api/v1/wfe", tags=["wfe"])


# ---------------------------------------------------------------------------
# Flow lifecycle state machine (BUSINESS-SLICES deep implementation)
# ---------------------------------------------------------------------------
# Allowed transitions:
#   draft     -> active      (validated + published)
#   active    -> deprecated  (superseded)
#   active    -> draft       (withdrawn for edits)
#   deprecated -> (terminal)
_FLOW_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"active"}),
    "active": frozenset({"deprecated", "draft"}),
    "deprecated": frozenset(),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _tid(request: Request) -> str:
    """Return the verified tenant_id for the current request."""
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (no-op otherwise)."""
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


def _paginate(items: list[Any], page: int, size: int) -> dict[str, Any]:
    """Apply cursor-free pagination to a list of serialized dicts."""
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
# 1. POST /flows/test — dry-run a BPMN flow definition
# ---------------------------------------------------------------------------
class FlowTestRequest(BaseModel):
    """Body schema for POST /flows/test.

    Callers may either pass a known ``flow_id`` (the stored BPMN is
    loaded) or inline ``bpmn_xml`` for an ad-hoc run. When both are
    given, ``bpmn_xml`` wins (ad-hoc overrides stored).
    """

    flow_id: str | None = None
    bpmn_xml: str | None = None
    name: str | None = None


@router.post("/flows/test")
async def test_flow(
    request: Request, body: FlowTestRequest,
) -> dict[str, Any]:
    """Dry-run a BPMN flow (FR-WFE-WFEPOSTWFEFLOWSTEST).

    Loads the stored BPMN by ``flow_id`` (or uses the inline
    ``bpmn_xml``), runs the structural validator, persists a
    ``FlowTestRun`` record, and emits a ``wfe.flow.tested`` outbox
    event. Returns the run id + status + validator output.
    """
    tid = _tid(request)

    # Resolve BPMN source: inline xml wins, else load stored flow.
    bpmn_xml = body.bpmn_xml
    flow_id = body.flow_id or ""
    if bpmn_xml is None:
        if not flow_id:
            raise HTTPException(
                status_code=400,
                detail="either flow_id or bpmn_xml is required",
            )
        flow = get_flow(tid, flow_id)
        if flow is None:
            raise HTTPException(status_code=404, detail="flow not found")
        bpmn_xml = flow.bpmn_xml
    elif not flow_id:
        # Ad-hoc run: synthesize a flow_id so the event payload is traceable.
        flow_id = f"adhoc-{uuid.uuid4().hex[:8]}"

    # Structural BPMN validation (P2-W5; Flowable engine lands in P2-W6).
    started = time.monotonic()
    valid, issues = validate_bpmn(bpmn_xml)
    duration_ms = int((time.monotonic() - started) * 1000) + 1
    status = "success" if valid else "failed"
    output: dict[str, Any] = {
        "valid": valid,
        "issues": issues,
        "steps": ["parse", "validate"] if valid else ["parse", "validate", "reject"],
    }

    # Persist the run record.
    run = append_test_run(tid, flow_id, status, duration_ms, output)

    # Also persist a validation record so GET /flows/validate reflects it.
    append_validation(tid, flow_id, valid, issues)

    # Emit outbox event (ADR-0014 step 3).
    _emit(
        request,
        "wfe.flow.tested",
        run.id,
        {
            "run_id": run.id,
            "flow_id": flow_id,
            "status": status,
            "valid": valid,
        },
        tid,
    )

    return {
        "run_id": run.id,
        "flow_id": flow_id,
        "status": status,
        "output": output,
    }


# ---------------------------------------------------------------------------
# 2. GET /flows/validate — list validation results (paginated)
# ---------------------------------------------------------------------------
@router.get("/flows/validate")
async def list_flows_validate(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List flow validation results (FR-WFE-WFEGETWFEFLOWSVALIDATE).

    Returns the per-tenant validation history in the standard
    ``{items,total,page,size,pages}`` page envelope. Each item is a
    ``FlowValidation`` record with ``valid`` flag + ``issues`` list.
    """
    tid = _tid(request)
    items = [asdict(v) for v in list_validations(tid)]
    return _paginate(items, page, size)


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Flow definition CRUD + status transitions
# ---------------------------------------------------------------------------
class FlowCreateRequest(BaseModel):
    """Body schema for POST /flows."""
    name: str
    bpmn_xml: str
    version: str = "1.0"


class FlowStatusRequest(BaseModel):
    """Body schema for PATCH /flows/{id}/status."""
    status: str  # draft / active / deprecated


@router.get("/flows")
async def list_flows_endpoint(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """List flow definitions (paginated, tenant-scoped)."""
    tid = _tid(request)
    items = [asdict(f) for f in list_flows(tid)]
    return _paginate(items, page, size)


@router.post("/flows", status_code=201)
async def create_flow(
    request: Request, body: FlowCreateRequest,
) -> dict[str, Any]:
    """Create a new flow definition.

    The BPMN is structurally validated before persistence. A flow
    with invalid BPMN is still persisted (status=draft) but the
    validation issues are returned so the caller can fix them.
    """
    tid = _tid(request)
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="name is required")
    if not body.bpmn_xml or not body.bpmn_xml.strip():
        raise HTTPException(status_code=422, detail="bpmn_xml is required")
    fid = f"flow-{uuid.uuid4().hex[:8]}"
    flow = FlowDefinition(
        id=fid, tenant_id=tid, name=body.name,
        bpmn_xml=body.bpmn_xml, version=body.version, status="draft",
    )
    put_flow(tid, flow)
    # Validate immediately and persist the validation record.
    valid, issues = validate_bpmn(body.bpmn_xml)
    append_validation(tid, fid, valid, issues)
    _emit(
        request, "wfe.flow.created", fid,
        {"flow_id": fid, "name": body.name, "valid": valid}, tid,
    )
    return {"flow": asdict(flow), "validation": {"valid": valid, "issues": issues}}


@router.get("/flows/{fid}")
async def get_flow_endpoint(request: Request, fid: str) -> dict[str, Any]:
    """Get a single flow definition by id."""
    tid = _tid(request)
    flow = get_flow(tid, fid)
    if flow is None:
        raise HTTPException(status_code=404, detail="flow not found")
    return asdict(flow)


@router.patch("/flows/{fid}/status")
async def transition_flow_status(
    request: Request, fid: str, body: FlowStatusRequest,
) -> dict[str, Any]:
    """Transition a flow's lifecycle status.

    State machine:
      draft     -> active      (the flow must pass BPMN validation)
      active    -> deprecated  (superseded)
      active    -> draft       (withdrawn for edits)
      deprecated -> (terminal, no further transitions)
    """
    tid = _tid(request)
    flow = get_flow(tid, fid)
    if flow is None:
        raise HTTPException(status_code=404, detail="flow not found")
    current = flow.status
    allowed = _FLOW_TRANSITIONS.get(current, frozenset())
    if body.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"invalid transition: {current} -> {body.status}",
        )
    # draft -> active requires a valid BPMN.
    if current == "draft" and body.status == "active":
        valid, issues = validate_bpmn(flow.bpmn_xml)
        if not valid:
            raise HTTPException(
                status_code=422,
                detail=f"cannot activate: BPMN invalid: {issues}",
            )
    updated = update_flow_status(tid, fid, body.status)
    _emit(
        request, "wfe.flow.status_changed", fid,
        {"flow_id": fid, "from": current, "to": body.status}, tid,
    )
    return asdict(updated)


@router.delete("/flows/{fid}")
async def delete_flow_endpoint(request: Request, fid: str) -> dict[str, Any]:
    """Delete a flow definition (only allowed in draft or deprecated)."""
    tid = _tid(request)
    flow = get_flow(tid, fid)
    if flow is None:
        raise HTTPException(status_code=404, detail="flow not found")
    if flow.status == "active":
        raise HTTPException(
            status_code=409,
            detail="cannot delete an active flow; deprecate first",
        )
    delete_flow(tid, fid)
    _emit(
        request, "wfe.flow.deleted", fid,
        {"flow_id": fid}, tid,
    )
    return {"deleted": fid}


# ---------------------------------------------------------------------------
# BUSINESS-SLICES deep: Flowable BPMN deploy integration (P3-W8)
# ---------------------------------------------------------------------------
class FlowDeployRequest(BaseModel):
    """Body schema for POST /flows/deploy.

    Either reference a stored ``flow_id`` (its BPMN is deployed) or pass
    inline ``bpmn_xml``. ``name`` labels the Flowable deployment.
    """

    flow_id: str | None = None
    name: str
    bpmn_xml: str | None = None


@router.post("/flows/deploy", status_code=201)
async def deploy_flow_endpoint(
    request: Request, body: FlowDeployRequest,
) -> dict[str, Any]:
    """Deploy a BPMN flow to the Flowable engine (P3-W8).

    Resolves the BPMN (inline ``bpmn_xml`` or stored ``flow_id``), calls
    the FlowableClient (real Flowable REST when ``FLOWABLE_BASE_URL`` is
    set, in-memory fallback otherwise), persists a ``FlowDeployment``
    record, and emits a ``wfe.flow.deployed`` outbox event.
    """
    tid = _tid(request)
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="name is required")

    bpmn_xml = body.bpmn_xml
    flow_id = body.flow_id or ""
    if bpmn_xml is None:
        if not flow_id:
            raise HTTPException(
                status_code=400,
                detail="either flow_id or bpmn_xml is required",
            )
        flow = get_flow(tid, flow_id)
        if flow is None:
            raise HTTPException(status_code=404, detail="flow not found")
        bpmn_xml = flow.bpmn_xml
    elif not flow_id:
        flow_id = f"adhoc-{uuid.uuid4().hex[:8]}"

    client = FlowableClient(
        auth=getattr(request.app.state, "bearer_auth", None),
        tenant_id=tid,
    )
    try:
        result = await client.deploy(body.name, bpmn_xml)
    finally:
        await client.aclose()

    rec = deploy_flow(
        tenant_id=tid,
        flow_id=flow_id,
        name=body.name,
        deployment_id=result["deployment_id"],
        engine=result["engine"],
        status=result["status"],
    )

    _emit(
        request,
        "wfe.flow.deployed",
        rec.id,
        {
            "deployment_record_id": rec.id,
            "flow_id": flow_id,
            "deployment_id": result["deployment_id"],
            "engine": result["engine"],
            "status": result["status"],
        },
        tid,
    )

    return {"deployment": asdict(rec)}
