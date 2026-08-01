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

from ..repositories import (
    FlowDefinition,
    append_test_run,
    append_validation,
    get_flow,
    list_validations,
    validate_bpmn,
)

router = APIRouter(prefix="/api/v1/wfe", tags=["wfe"])


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
