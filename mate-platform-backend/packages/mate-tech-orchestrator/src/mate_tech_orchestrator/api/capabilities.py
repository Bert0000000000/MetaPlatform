"""mate_tech_orchestrator.api.capabilities — reactive capability surface.

MP-COMP-01 pilot (ADR-0042): the notification entrypoint the MCP
center calls when a tool is registered or unregistered. Mounting a
capability activates the role fibers injecting it; withdrawing it
deactivates them with their effects reverted. When the app lifespan
did not run (bare TestClient), the runtime is absent and these
endpoints report 503 — the rest of the orchestrator is unaffected.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from mate_platform.tenancy.guards import require_tenant

from ..scheduler.capability_runtime import CapabilityRuntime, get_capability_runtime
from .schemas import TrackCapabilityRequest

router = APIRouter(prefix="/api/v1/orchestrator", tags=["orchestrator-capabilities"])


def _tid(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _runtime(request: Request) -> CapabilityRuntime:
    runtime = getattr(request.app.state, "capability_runtime", None) or get_capability_runtime()
    if runtime is None:
        raise HTTPException(
            status_code=503,
            detail="capability runtime not started (lifespan did not run)",
        )
    return runtime


@router.post("/capabilities", status_code=201)
async def track_capability(request: Request, body: TrackCapabilityRequest) -> dict[str, Any]:
    """Announce a capability as available (e.g. MCP tool registered)."""
    tid = _tid(request)
    runtime = _runtime(request)
    await runtime.track_capability(tid, body.name, body.ref)
    return {"tracked": body.name, "tenant_id": tid, "snapshot": runtime.snapshot()}


@router.delete("/capabilities/{name}")
async def untrack_capability(name: str, request: Request) -> dict[str, Any]:
    """Withdraw a capability; dependent role fibers deactivate reactively."""
    tid = _tid(request)
    runtime = _runtime(request)
    if not await runtime.untrack_capability(tid, name):
        raise HTTPException(status_code=404, detail=f"capability not tracked: {name}")
    return {"untracked": name, "tenant_id": tid, "snapshot": runtime.snapshot()}


@router.get("/capabilities")
async def capability_snapshot(request: Request) -> dict[str, Any]:
    """Fiber-state view: capability providers + role activation overlay."""
    _tid(request)
    return _runtime(request).snapshot()
