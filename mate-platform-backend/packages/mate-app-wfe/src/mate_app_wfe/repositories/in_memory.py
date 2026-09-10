"""In-memory repository for the wfe domain (P2-W5 batch).

Data shape:
    _FLOWS / _VALIDATIONS / _TEST_RUNS:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = entity dataclass

The store is tenant-scoped: callers MUST pass the tenant binding
(`ctx.tenant_id`) and lookups reject entities that don't belong to
that tenant. This is the layer at which the ADR-0014 cross-tenant
rule is enforced.

Seed data:
    >= 5 flow definitions, >= 5 validation records per tenant.
    Tests rely on these minima; tests assert `>= N` rather than
    equality.

BPMN validation:
    `validate_bpmn(xml)` performs structural checks (presence of
    <definitions> / <process> roots, balanced start/end events).
    Real Flowable 8.0 engine validation lands in P2-W6.
"""

from __future__ import annotations

import re
import uuid
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Entity dataclasses
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class FlowDefinition:
    id: str
    tenant_id: str
    name: str
    bpmn_xml: str
    version: str = "1.0"
    status: str = "draft"  # draft / active / deprecated


@dataclass(frozen=True)
class FlowValidation:
    id: str
    tenant_id: str
    flow_id: str
    valid: bool
    issues: tuple[str, ...] = field(default_factory=tuple)
    validated_at: str = ""


@dataclass(frozen=True)
class FlowTestRun:
    id: str
    tenant_id: str
    flow_id: str
    status: str  # success / failed
    started_at: str
    finished_at: str
    duration_ms: int
    output: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FlowDeployment:
    """A Flowable BPMN deployment record (P3-W8)."""

    id: str
    tenant_id: str
    flow_id: str
    name: str
    deployment_id: str  # Flowable deployment id or synthetic in-memory id
    engine: str  # "flowable" | "in-memory"
    status: str  # "deployed" | "fallback" | "failed"
    deployed_at: str = ""


@dataclass(frozen=True)
class WorkflowDefinition:
    """Tenant-scoped, versioned Plan draft owned by the WFE service."""

    id: str
    tenant_id: str
    name: str
    draft_plan: dict[str, Any]
    version: int = 1
    status: str = "draft"
    published_version: int | None = None
    published_at: str = ""
    published_by: str = ""

    def summary(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "status": self.status,
            "published_version": self.published_version,
        }


@dataclass(frozen=True)
class WorkflowDefinitionRevision:
    """Immutable Plan snapshot used as the only source for a workflow run."""

    definition_id: str
    tenant_id: str
    version: int
    plan: dict[str, Any]
    published_at: str
    published_by: str


class WorkflowDefinitionConflict(Exception):
    """Raised when a save does not match the current optimistic version."""

    def __init__(self, current: WorkflowDefinition) -> None:
        self.current = current
        super().__init__(f"workflow definition version conflict: {current.id}@{current.version}")


# ---------------------------------------------------------------------------
# BPMN structural validation
# ---------------------------------------------------------------------------
_DEF_RE = re.compile(r"<\w*:?definitions\b", re.IGNORECASE)
_PROC_RE = re.compile(r"<\w*:?process\b", re.IGNORECASE)
_START_RE = re.compile(r"<\w*:?startEvent\b", re.IGNORECASE)
_END_RE = re.compile(r"<\w*:?endEvent\b", re.IGNORECASE)


def validate_bpmn(bpmn_xml: str) -> tuple[bool, list[str]]:
    """Structural BPMN check (no engine call).

    Returns ``(valid, issues)``. A flow is valid when it has a
    ``<definitions>`` root, at least one ``<process>``, and at least
    one start + one end event. Returns a list of human-readable
    issue strings for the failing checks.
    """
    issues: list[str] = []
    if not bpmn_xml or not bpmn_xml.strip():
        issues.append("bpmn_xml is empty")
        return (False, issues)
    if not _DEF_RE.search(bpmn_xml):
        issues.append("missing <definitions> root element")
    if not _PROC_RE.search(bpmn_xml):
        issues.append("missing <process> element")
    if not _START_RE.search(bpmn_xml):
        issues.append("missing <startEvent> element")
    if not _END_RE.search(bpmn_xml):
        issues.append("missing <endEvent> element")
    return (not issues, issues)


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
_VALID_BPMN = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">'
    '<bpmn:process id="proc-1" isExecutable="true">'
    '<bpmn:startEvent id="start-1"/>'
    '<bpmn:endEvent id="end-1"/>'
    "</bpmn:process>"
    "</bpmn:definitions>"
)

_INVALID_BPMN = "<not-bpmn>hello</not-bpmn>"


def _seed_flows(tenant_id: str) -> dict[str, FlowDefinition]:
    catalog: list[tuple[str, str, str, str]] = [
        ("flow-approval", "Approval Flow", _VALID_BPMN, "active"),
        ("flow-onboarding", "Onboarding Flow", _VALID_BPMN, "active"),
        ("flow-reimbursement", "Reimbursement Flow", _VALID_BPMN, "draft"),
        ("flow-procurement", "Procurement Flow", _VALID_BPMN, "active"),
        ("flow-leave", "Leave Request Flow", _INVALID_BPMN, "draft"),
    ]
    return {
        fid: FlowDefinition(
            id=fid,
            tenant_id=tenant_id,
            name=name,
            bpmn_xml=xml,
            status=status,
        )
        for fid, name, xml, status in catalog
    }


def _seed_validations(tenant_id: str) -> dict[str, FlowValidation]:
    flows = _seed_flows(tenant_id)
    out: dict[str, FlowValidation] = {}
    for i, (fid, flow) in enumerate(flows.items()):
        valid, issues = validate_bpmn(flow.bpmn_xml)
        out[f"val-{i + 1}"] = FlowValidation(
            id=f"val-{i + 1}",
            tenant_id=tenant_id,
            flow_id=fid,
            valid=valid,
            issues=tuple(issues),
            validated_at=f"2026-07-0{i + 1}T00:00:00Z",
        )
    return out


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
_FLOWS: dict[str, dict[str, FlowDefinition]] = {}
_VALIDATIONS: dict[str, dict[str, FlowValidation]] = {}
_TEST_RUNS: dict[str, dict[str, FlowTestRun]] = {}
_DEPLOYMENTS: dict[str, dict[str, FlowDeployment]] = {}
_WORKFLOW_DEFINITIONS: dict[str, dict[str, WorkflowDefinition]] = {}
_WORKFLOW_DEFINITION_REVISIONS: dict[str, dict[tuple[str, int], WorkflowDefinitionRevision]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return
    if tenant_id not in _FLOWS:
        _FLOWS[tenant_id] = _seed_flows(tenant_id)
    if tenant_id not in _VALIDATIONS:
        _VALIDATIONS[tenant_id] = _seed_validations(tenant_id)
    if tenant_id not in _TEST_RUNS:
        _TEST_RUNS[tenant_id] = {}
    if tenant_id not in _DEPLOYMENTS:
        _DEPLOYMENTS[tenant_id] = {}
    if tenant_id not in _WORKFLOW_DEFINITIONS:
        _WORKFLOW_DEFINITIONS[tenant_id] = {}
    if tenant_id not in _WORKFLOW_DEFINITION_REVISIONS:
        _WORKFLOW_DEFINITION_REVISIONS[tenant_id] = {}


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_flows(tenant_id: str) -> list[FlowDefinition]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_FLOWS[tenant_id].values(), key=lambda x: x.id)


def get_flow(tenant_id: str, flow_id: str) -> FlowDefinition | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _FLOWS[tenant_id].get(flow_id)


def list_validations(tenant_id: str) -> list[FlowValidation]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_VALIDATIONS[tenant_id].values(), key=lambda x: x.validated_at)


def list_test_runs(tenant_id: str) -> list[FlowTestRun]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_TEST_RUNS[tenant_id].values(), key=lambda x: x.started_at)


# ---------------------------------------------------------------------------
# Public write API
# ---------------------------------------------------------------------------
def append_validation(
    tenant_id: str,
    flow_id: str,
    valid: bool,
    issues: list[str],
) -> FlowValidation:
    """Persist a validation record. Used by GET /flows/validate seeding."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    vid = f"val-{uuid.uuid4().hex[:8]}"
    import time

    rec = FlowValidation(
        id=vid,
        tenant_id=tenant_id,
        flow_id=flow_id,
        valid=valid,
        issues=tuple(issues),
        validated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )
    _VALIDATIONS[tenant_id][vid] = rec
    return rec


def append_test_run(
    tenant_id: str,
    flow_id: str,
    status: str,
    duration_ms: int,
    output: dict[str, Any],
) -> FlowTestRun:
    """Persist a test-run record. Used by POST /flows/test."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    import time

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    rid = f"run-{uuid.uuid4().hex[:8]}"
    rec = FlowTestRun(
        id=rid,
        tenant_id=tenant_id,
        flow_id=flow_id,
        status=status,
        started_at=now,
        finished_at=now,
        duration_ms=duration_ms,
        output=output,
    )
    _TEST_RUNS[tenant_id][rid] = rec
    return rec


def put_flow(tenant_id: str, flow: FlowDefinition) -> FlowDefinition:
    """Insert or replace a flow definition. Used by POST /flows."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _FLOWS[tenant_id][flow.id] = flow
    return flow


def update_flow_status(tenant_id: str, flow_id: str, status: str) -> FlowDefinition | None:
    """Transition a flow's status. Returns the updated flow or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    flow = _FLOWS[tenant_id].get(flow_id)
    if flow is None:
        return None
    updated = FlowDefinition(
        id=flow.id,
        tenant_id=flow.tenant_id,
        name=flow.name,
        bpmn_xml=flow.bpmn_xml,
        version=flow.version,
        status=status,
    )
    _FLOWS[tenant_id][flow_id] = updated
    return updated


def delete_flow(tenant_id: str, flow_id: str) -> bool:
    """Delete a flow definition. Returns True if deleted."""
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if flow_id not in _FLOWS[tenant_id]:
        return False
    del _FLOWS[tenant_id][flow_id]
    return True


def deploy_flow(
    tenant_id: str,
    flow_id: str,
    name: str,
    deployment_id: str,
    engine: str,
    status: str,
) -> FlowDeployment:
    """Persist a Flowable BPMN deployment record (P3-W8).

    Used by POST /flows/deploy after the FlowableClient returns the
    engine deployment result (or the in-memory fallback).
    """
    import time

    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    did = f"dep-{uuid.uuid4().hex[:8]}"
    rec = FlowDeployment(
        id=did,
        tenant_id=tenant_id,
        flow_id=flow_id,
        name=name,
        deployment_id=deployment_id,
        engine=engine,
        status=status,
        deployed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )
    _DEPLOYMENTS[tenant_id][did] = rec
    return rec


def list_deployments(tenant_id: str) -> list[FlowDeployment]:
    """List deployment records for a tenant (P3-W8)."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_DEPLOYMENTS[tenant_id].values(), key=lambda x: x.deployed_at)


# ---------------------------------------------------------------------------
# Versioned Plan-definition repository (new Action Orchestration surface)
# ---------------------------------------------------------------------------
def get_workflow_definition(tenant_id: str, definition_id: str) -> WorkflowDefinition | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _WORKFLOW_DEFINITIONS[tenant_id].get(definition_id)


def save_workflow_definition(
    tenant_id: str,
    definition_id: str,
    *,
    name: str,
    draft_plan: dict[str, Any],
    expected_version: int,
) -> WorkflowDefinition:
    """Create or compare-and-save a Plan draft without mutating published revisions."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    existing = _WORKFLOW_DEFINITIONS[tenant_id].get(definition_id)
    if existing is None:
        if expected_version != 0:
            raise ValueError("new workflow definitions require expected_version=0")
        saved = WorkflowDefinition(
            id=definition_id,
            tenant_id=tenant_id,
            name=name,
            draft_plan=deepcopy(draft_plan),
        )
    else:
        if expected_version != existing.version:
            raise WorkflowDefinitionConflict(existing)
        saved = WorkflowDefinition(
            id=existing.id,
            tenant_id=existing.tenant_id,
            name=name,
            draft_plan=deepcopy(draft_plan),
            version=existing.version + 1,
            status=existing.status,
            published_version=existing.published_version,
            published_at=existing.published_at,
            published_by=existing.published_by,
        )
    _WORKFLOW_DEFINITIONS[tenant_id][definition_id] = saved
    return saved


def publish_workflow_definition(
    tenant_id: str,
    definition_id: str,
    *,
    actor_id: str,
) -> tuple[WorkflowDefinition, WorkflowDefinitionRevision]:
    """Freeze the current draft as one immutable revision."""
    definition = get_workflow_definition(tenant_id, definition_id)
    if definition is None:
        raise KeyError(definition_id)
    revisions = _WORKFLOW_DEFINITION_REVISIONS[tenant_id]
    key = (definition_id, definition.version)
    revision = revisions.get(key)
    if revision is None:
        import time

        published_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        revision = WorkflowDefinitionRevision(
            definition_id=definition_id,
            tenant_id=tenant_id,
            version=definition.version,
            plan=deepcopy(definition.draft_plan),
            published_at=published_at,
            published_by=actor_id,
        )
        revisions[key] = revision
    published = WorkflowDefinition(
        id=definition.id,
        tenant_id=definition.tenant_id,
        name=definition.name,
        draft_plan=deepcopy(definition.draft_plan),
        version=definition.version,
        status="published",
        published_version=revision.version,
        published_at=revision.published_at,
        published_by=revision.published_by,
    )
    _WORKFLOW_DEFINITIONS[tenant_id][definition_id] = published
    return published, revision


def resolve_published_workflow_definition(
    tenant_id: str,
    definition_id: str,
) -> WorkflowDefinitionRevision | None:
    definition = get_workflow_definition(tenant_id, definition_id)
    if definition is None or definition.published_version is None:
        return None
    return _WORKFLOW_DEFINITION_REVISIONS[tenant_id].get(
        (definition_id, definition.published_version),
    )


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _FLOWS.clear()
    _VALIDATIONS.clear()
    _TEST_RUNS.clear()
    _DEPLOYMENTS.clear()
    _WORKFLOW_DEFINITIONS.clear()
    _WORKFLOW_DEFINITION_REVISIONS.clear()
