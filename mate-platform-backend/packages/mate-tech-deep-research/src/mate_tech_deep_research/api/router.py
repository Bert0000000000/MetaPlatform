"""FastAPI router exposing the Deep Research A2A endpoint.

Single endpoint:

  POST /api/v1/a2a/agent/deep-research/invoke

Every handler enforces ADR-0014 step 2 (`require_tenant(ctx)`) before
doing any work. Successful research emits a `deep.research.completed`
outbox event (ADR-0014 step 3).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from mate_platform.tenancy.context import RequestContext
from mate_platform.tenancy.guards import require_tenant

from ..deerflow.client import DeerFlowClient, DeerFlowUnavailableError
from ..events.publisher import publish_research_completed
from .schemas import ResearchRequest, ResearchResponse

router = APIRouter(prefix="/api/v1/a2a/agent/deep-research", tags=["deep-research"])

# Module-level singleton; tests call ``set_deerflow_client`` to inject a mock.
_client_singleton: DeerFlowClient | None = None


def set_deerflow_client(client: DeerFlowClient | None) -> None:
    """Test hook: override the singleton DeerFlowClient (or clear it)."""
    global _client_singleton
    _client_singleton = client


def _get_client(request: Request) -> DeerFlowClient:
    """Resolve the DeerFlowClient.

    Order of precedence:
      1. ``request.app.state.deerflow_client`` (per-app override).
      2. The module-level singleton (set via ``set_deerflow_client``).
      3. A fresh ``DeerFlowClient()`` built from env vars.
    """
    injected = getattr(request.app.state, "deerflow_client", None)
    if injected is not None:
        return injected
    if _client_singleton is not None:
        return _client_singleton
    return DeerFlowClient()


def _ctx(request: Request) -> RequestContext | None:
    """Return the verified request context, or None if middleware didn't run."""
    return getattr(request.state, "ctx", None)


@router.post("/invoke")
async def invoke_deep_research(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    """Delegate a deep research task to DeerFlow (FR-DEEP-RESEARCH-INVOKE).

    Body shape:
      {
        "capability_id": "web-research",
        "input": {
          "query": "...",
          "depth": "deep" | "medium" | "shallow",
          "max_sources": 10,
          "output_format": "markdown" | "json"
        }
      }
    """
    # Step 2 of ADR-0014: tenant guard. The middleware always sets ctx;
    # the getattr fallback is for direct router-level tests.
    ctx = _ctx(request)
    if ctx is not None:
        require_tenant(ctx)
    else:
        raise HTTPException(
            status_code=400,
            detail={"code": "E_TENANT_REQUIRED", "message": "missing request context"},
        )

    capability_id = body.get("capability_id")
    if not capability_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "E_MISSING_CAPABILITY", "message": "capability_id is required"},
        )

    input_data = body.get("input") or {}
    if not isinstance(input_data, dict):
        input_data = {}

    if capability_id != "web-research":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "E_UNKNOWN_CAPABILITY",
                "message": f"unknown capability: {capability_id}",
                "capability_id": capability_id,
            },
        )

    query = str(input_data.get("query", "")).strip()
    if not query:
        raise HTTPException(
            status_code=400,
            detail={"code": "E_EMPTY_QUERY", "message": "input.query must not be empty"},
        )

    req = ResearchRequest(
        query=query,
        depth=str(input_data.get("depth", "deep")),
        max_sources=int(input_data.get("max_sources", 10)),
        output_format=str(input_data.get("output_format", "markdown")),
    )

    client = _get_client(request)
    try:
        result = await client.research(req)
    except DeerFlowUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "E_DEERFLOW_UNAVAILABLE",
                "message": str(exc),
            },
        ) from exc

    # Step 3 of ADR-0014: emit outbox event in the same logical transaction.
    publish_research_completed(
        outbox=getattr(request.app.state, "outbox_writer", None),
        ctx=ctx,
        query=req.query,
        report_size=len(result.report),
        sources_count=len(result.sources),
        duration_ms=result.duration_ms,
    )

    return {
        "capability_id": capability_id,
        "report": result.report,
        "sources": [s.to_dict() for s in result.sources],
        "duration_ms": result.duration_ms,
    }
