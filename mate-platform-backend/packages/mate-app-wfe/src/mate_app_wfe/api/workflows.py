"""Versioned Plan definition and durable workflow-run HTTP contract."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Path, Request
from pydantic import BaseModel, ConfigDict, Field

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant
from mate_platform.workflow import Plan, PlanStep, WorkflowExecutor

from .. import plan_validation
from ..repositories import in_memory as memory_repository
from ..repositories import sql_store

router = APIRouter(prefix="/api/v1", tags=["workflows"])


class PlanDefinitionSaveRequest(BaseModel):
    """Browser-editable draft; optimistic version belongs to the server contract."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=256)
    version: int = Field(ge=0)
    draft_plan: dict[str, Any]


class WorkflowStartRequest(BaseModel):
    """Runtime input only; steps come from an immutable published revision."""

    model_config = ConfigDict(extra="forbid")

    input: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(default="", max_length=256)


def _tenant_id(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _actor_id(request: Request) -> str:
    return str(getattr(request.state.ctx, "user_id", ""))


def _executor(request: Request) -> WorkflowExecutor:
    executor = getattr(request.app.state, "workflow_executor", None)
    if executor is None:
        raise HTTPException(status_code=503, detail="workflow backend unavailable")
    return executor


def _definitions(request: Request):
    """Use SQL storage in deployed profiles; tests retain explicit memory storage."""
    settings = getattr(request.app.state, "workflow_settings", None)
    has_database = bool(os.getenv("MATE_DB_URL", "").strip() or os.getenv("DATABASE_URL", "").strip())
    return sql_store if has_database or (settings is not None and settings.is_deployed_profile) else memory_repository


def _status_url(run_id: str) -> str:
    return f"/api/v1/workflow-runs/{run_id}"


def _definition_payload(definition: Any) -> dict[str, Any]:
    return {
        "id": definition.id,
        "name": definition.name,
        "draft_plan": definition.draft_plan,
        "version": definition.version,
        "status": definition.status,
        "published_version": definition.published_version,
        "published_at": definition.published_at,
        "published_by": definition.published_by,
    }


def _emit(request: Request, event_type: str, aggregate_id: str, payload: dict[str, Any], tenant_id: str) -> None:
    writer: InMemoryOutboxWriter | None = getattr(request.app.state, "outbox_writer", None)
    if writer is None:
        return
    writer.append(Event.create(
        type=event_type,
        tenant_id=TenantId(tenant_id),
        aggregate_id=aggregate_id,
        payload=payload,
        trace_id=getattr(request.state.ctx, "trace_id", ""),
    ))


def _build_plan(definition_id: str, tenant_id: str, revision: Any, body: WorkflowStartRequest, trace_id: str) -> Plan:
    validation = plan_validation.validate_plan(revision.plan)
    if not validation.valid:
        raise ValueError("published workflow definition is invalid")
    by_id = {str(node["id"]): node for node in revision.plan["nodes"]}
    outgoing = {str(edge["source"]): str(edge["target"]) for edge in revision.plan["edges"]}
    current = next(node_id for node_id, node in by_id.items() if node.get("type") == "start")
    steps: list[PlanStep] = []
    while by_id[current].get("type") != "end":
        current = outgoing[current]
        node = by_id[current]
        if node.get("type") == "action":
            steps.append(PlanStep(
                id=current,
                action_type=str(node["action_type"]),
                input=dict(node.get("input") or {}),
                requires_confirmation=bool(node.get("requires_confirmation")),
            ))
    return Plan(
        definition_id=definition_id,
        version=str(revision.version),
        tenant_id=tenant_id,
        steps=tuple(steps),
        input=body.input,
        trace_id=trace_id,
        correlation_id=body.correlation_id,
    )


@router.get("/workflow-definitions/node-registry")
async def get_node_registry(request: Request) -> dict[str, Any]:
    _tenant_id(request)
    return {"items": plan_validation.node_registry()}


@router.get("/workflow-definitions/{definition_id}")
async def get_workflow_definition(request: Request, definition_id: str = Path(min_length=1)) -> dict[str, Any]:
    definition = _definitions(request).get_workflow_definition(_tenant_id(request), definition_id)
    if definition is None:
        raise HTTPException(status_code=404, detail="workflow definition not found")
    return _definition_payload(definition)


@router.put("/workflow-definitions/{definition_id}")
async def save_workflow_definition(
    request: Request,
    body: PlanDefinitionSaveRequest,
    definition_id: str = Path(min_length=1),
) -> dict[str, Any]:
    repository = _definitions(request)
    tenant_id = _tenant_id(request)
    try:
        definition = repository.save_workflow_definition(
            tenant_id,
            definition_id,
            name=body.name,
            draft_plan=body.draft_plan,
            expected_version=body.version,
        )
    except memory_repository.WorkflowDefinitionConflict as exc:
        raise HTTPException(status_code=409, detail={
            "code": "version_conflict",
            "current": exc.current.summary(),
        }) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    payload = _definition_payload(definition)
    payload["validation"] = plan_validation.validate_plan(definition.draft_plan).to_dict()
    return payload


@router.post("/workflow-definitions/{definition_id}:publish")
async def publish_workflow_definition(
    request: Request,
    definition_id: str = Path(min_length=1),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Idempotency-Key is required")
    repository = _definitions(request)
    tenant_id = _tenant_id(request)
    definition = repository.get_workflow_definition(tenant_id, definition_id)
    if definition is None:
        raise HTTPException(status_code=404, detail="workflow definition not found")
    validation = plan_validation.validate_plan(definition.draft_plan)
    if not validation.valid:
        raise HTTPException(status_code=422, detail=validation.to_dict())
    published, revision = repository.publish_workflow_definition(
        tenant_id, definition_id, actor_id=_actor_id(request),
    )
    _emit(request, "workflow_definition.published", definition_id, {
        "definition_version": revision.version,
        "idempotency_key": idempotency_key.strip(),
    }, tenant_id)
    return {
        **_definition_payload(published),
        "revision": {"version": revision.version, "published_at": revision.published_at},
    }


@router.post("/workflows/{definition_id}/runs", status_code=202)
async def start_workflow(
    request: Request,
    body: WorkflowStartRequest,
    definition_id: str = Path(min_length=1),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    """Start a durable workflow from a server-owned published Plan revision."""
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Idempotency-Key is required")
    tenant_id = _tenant_id(request)
    revision = _definitions(request).resolve_published_workflow_definition(tenant_id, definition_id)
    if revision is None:
        raise HTTPException(status_code=404, detail="published workflow definition not found")
    try:
        plan = _build_plan(
            definition_id,
            tenant_id,
            revision,
            body,
            str(getattr(request.state.ctx, "trace_id", "")),
        )
        run = await _executor(request).start(plan, idempotency_key=idempotency_key.strip())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (OSError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="workflow backend unavailable") from exc
    _emit(request, "workflow_run.started", run.run_id, {
        "definition_id": definition_id,
        "definition_version": revision.version,
        "correlation_id": body.correlation_id,
    }, tenant_id)
    return {
        "run_id": run.run_id,
        "status": run.status.value,
        "status_url": _status_url(run.run_id),
        "definition_version": run.version,
    }


@router.get("/workflow-runs/{run_id}")
async def get_workflow_run(request: Request, run_id: str = Path(min_length=1)) -> dict[str, Any]:
    """Read one workflow run after enforcing tenant ownership."""
    tenant_id = _tenant_id(request)
    try:
        run = await _executor(request).get(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workflow run not found") from exc
    except (OSError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="workflow backend unavailable") from exc
    if run.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="workflow run not found")
    payload = run.to_dict()
    payload["definition_version"] = run.version
    return payload
