"""SQL-backed repository for the wfe domain (P3-W3 TD-5) — SQLAlchemy 2.0.

Provides read + write for ``FlowDefinition``, ``FlowValidation`` and
``FlowTestRun``. Tuple fields (``FlowValidation.issues``) are serialised
as newline-separated TEXT; dict fields (``FlowTestRun.output``) are
JSON-serialised to TEXT.

The ``validate_bpmn`` structural check stays in ``in_memory`` because it
is a pure function that does not touch persistence.
"""
from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import (
    FlowDefinition,
    FlowTestRun,
    FlowValidation,
    WorkflowDefinition,
    WorkflowDefinitionConflict,
    WorkflowDefinitionRevision,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _split_lines(text: str) -> tuple[str, ...]:
    """Split a newline-separated TEXT column back into a tuple."""
    if not text:
        return ()
    return tuple(s for s in text.split("\n") if s.strip())


def _join_lines(items: tuple[str, ...]) -> str:
    """Join a tuple into a newline-separated TEXT value."""
    return "\n".join(items) if items else ""


def _json_dumps(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _json_loads(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}


# ---------------------------------------------------------------------------
# ORM -> dataclass helpers
# ---------------------------------------------------------------------------
def _orm_to_flow_definition(row: models.FlowDefinitionORM) -> FlowDefinition:
    return FlowDefinition(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        bpmn_xml=row.bpmn_xml or "",
        version=row.version or "1.0",
        status=row.status or "draft",
    )


def _orm_to_flow_validation(row: models.FlowValidationORM) -> FlowValidation:
    return FlowValidation(
        id=row.id,
        tenant_id=row.tenant_id,
        flow_id=row.flow_id or "",
        valid=bool(row.valid),
        issues=_split_lines(row.issues or ""),
        validated_at=row.validated_at or "",
    )


def _orm_to_flow_test_run(row: models.FlowTestRunORM) -> FlowTestRun:
    return FlowTestRun(
        id=row.id,
        tenant_id=row.tenant_id,
        flow_id=row.flow_id or "",
        status=row.status or "success",
        started_at=row.started_at or "",
        finished_at=row.finished_at or "",
        duration_ms=row.duration_ms,
        output=_json_loads(row.output),
    )


def _orm_to_workflow_definition(row: models.WorkflowDefinitionORM) -> WorkflowDefinition:
    return WorkflowDefinition(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        draft_plan=deepcopy(row.draft_plan or {}),
        version=row.version,
        status=row.status,
        published_version=row.published_version,
        published_at=row.published_at or "",
        published_by=row.published_by or "",
    )


def _orm_to_workflow_definition_revision(
    row: models.WorkflowDefinitionRevisionORM,
) -> WorkflowDefinitionRevision:
    return WorkflowDefinitionRevision(
        definition_id=row.definition_id,
        tenant_id=row.tenant_id,
        version=row.version,
        plan=deepcopy(row.plan or {}),
        published_at=row.published_at,
        published_by=row.published_by,
    )


# ---------------------------------------------------------------------------
# Read API — flow definitions
# ---------------------------------------------------------------------------
def list_flows(tenant_id: str) -> list[FlowDefinition]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.FlowDefinitionORM)
        .where(models.FlowDefinitionORM.tenant_id == tenant_id)
        .order_by(models.FlowDefinitionORM.id)
    ).scalars().all()
    return [_orm_to_flow_definition(r) for r in rows]


def get_flow(tenant_id: str, flow_id: str) -> FlowDefinition | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.FlowDefinitionORM).where(
            models.FlowDefinitionORM.tenant_id == tenant_id,
            models.FlowDefinitionORM.id == flow_id,
        )
    ).scalar_one_or_none()
    return _orm_to_flow_definition(row) if row else None


# ---------------------------------------------------------------------------
# Read API — flow validations
# ---------------------------------------------------------------------------
def list_validations(tenant_id: str) -> list[FlowValidation]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.FlowValidationORM)
        .where(models.FlowValidationORM.tenant_id == tenant_id)
        .order_by(models.FlowValidationORM.validated_at)
    ).scalars().all()
    return [_orm_to_flow_validation(r) for r in rows]


def get_validation(tenant_id: str, validation_id: str) -> FlowValidation | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.FlowValidationORM).where(
            models.FlowValidationORM.tenant_id == tenant_id,
            models.FlowValidationORM.id == validation_id,
        )
    ).scalar_one_or_none()
    return _orm_to_flow_validation(row) if row else None


# ---------------------------------------------------------------------------
# Read API — flow test runs
# ---------------------------------------------------------------------------
def list_test_runs(tenant_id: str) -> list[FlowTestRun]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.FlowTestRunORM)
        .where(models.FlowTestRunORM.tenant_id == tenant_id)
        .order_by(models.FlowTestRunORM.started_at)
    ).scalars().all()
    return [_orm_to_flow_test_run(r) for r in rows]


def get_test_run(tenant_id: str, run_id: str) -> FlowTestRun | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.FlowTestRunORM).where(
            models.FlowTestRunORM.tenant_id == tenant_id,
            models.FlowTestRunORM.id == run_id,
        )
    ).scalar_one_or_none()
    return _orm_to_flow_test_run(row) if row else None


# ---------------------------------------------------------------------------
# Write API — flow definitions
# ---------------------------------------------------------------------------
def put_flow(tenant_id: str, flow: FlowDefinition) -> FlowDefinition:
    if not tenant_id:
        return flow
    s = _session()
    existing = s.get(models.FlowDefinitionORM, flow.id)
    if existing:
        existing.name = flow.name
        existing.bpmn_xml = flow.bpmn_xml
        existing.version = flow.version
        existing.status = flow.status
    else:
        s.add(models.FlowDefinitionORM(
            id=flow.id, tenant_id=tenant_id, name=flow.name,
            bpmn_xml=flow.bpmn_xml, version=flow.version, status=flow.status,
        ))
    s.commit()
    return flow


# ---------------------------------------------------------------------------
# Versioned Plan-definition repository (new Action Orchestration surface)
# ---------------------------------------------------------------------------
def get_workflow_definition(tenant_id: str, definition_id: str) -> WorkflowDefinition | None:
    if not tenant_id:
        return None
    row = _session().execute(
        select(models.WorkflowDefinitionORM).where(
            models.WorkflowDefinitionORM.tenant_id == tenant_id,
            models.WorkflowDefinitionORM.id == definition_id,
        )
    ).scalar_one_or_none()
    return _orm_to_workflow_definition(row) if row else None


def save_workflow_definition(
    tenant_id: str,
    definition_id: str,
    *,
    name: str,
    draft_plan: dict[str, Any],
    expected_version: int,
) -> WorkflowDefinition:
    if not tenant_id:
        raise ValueError("tenant_id is required")
    session = _session()
    row = session.execute(
        select(models.WorkflowDefinitionORM).where(
            models.WorkflowDefinitionORM.tenant_id == tenant_id,
            models.WorkflowDefinitionORM.id == definition_id,
        )
    ).scalar_one_or_none()
    if row is None:
        if expected_version != 0:
            raise ValueError("new workflow definitions require expected_version=0")
        row = models.WorkflowDefinitionORM(
            id=definition_id,
            tenant_id=tenant_id,
            name=name,
            draft_plan=deepcopy(draft_plan),
            version=1,
        )
        session.add(row)
    else:
        current = _orm_to_workflow_definition(row)
        if expected_version != current.version:
            raise WorkflowDefinitionConflict(current)
        row.name = name
        row.draft_plan = deepcopy(draft_plan)
        row.version = current.version + 1
    session.commit()
    return _orm_to_workflow_definition(row)


def publish_workflow_definition(
    tenant_id: str, definition_id: str, *, actor_id: str,
) -> tuple[WorkflowDefinition, WorkflowDefinitionRevision]:
    import time

    session = _session()
    definition = session.execute(
        select(models.WorkflowDefinitionORM).where(
            models.WorkflowDefinitionORM.tenant_id == tenant_id,
            models.WorkflowDefinitionORM.id == definition_id,
        )
    ).scalar_one_or_none()
    if definition is None:
        raise KeyError(definition_id)
    revision = session.execute(
        select(models.WorkflowDefinitionRevisionORM).where(
            models.WorkflowDefinitionRevisionORM.tenant_id == tenant_id,
            models.WorkflowDefinitionRevisionORM.definition_id == definition_id,
            models.WorkflowDefinitionRevisionORM.version == definition.version,
        )
    ).scalar_one_or_none()
    if revision is None:
        revision = models.WorkflowDefinitionRevisionORM(
            definition_id=definition_id,
            tenant_id=tenant_id,
            version=definition.version,
            plan=deepcopy(definition.draft_plan or {}),
            published_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            published_by=actor_id,
        )
        session.add(revision)
    definition.status = "published"
    definition.published_version = revision.version
    definition.published_at = revision.published_at
    definition.published_by = revision.published_by
    session.commit()
    return _orm_to_workflow_definition(definition), _orm_to_workflow_definition_revision(revision)


def resolve_published_workflow_definition(
    tenant_id: str, definition_id: str,
) -> WorkflowDefinitionRevision | None:
    session = _session()
    definition = session.execute(
        select(models.WorkflowDefinitionORM).where(
            models.WorkflowDefinitionORM.tenant_id == tenant_id,
            models.WorkflowDefinitionORM.id == definition_id,
        )
    ).scalar_one_or_none()
    if definition is None or definition.published_version is None:
        return None
    revision = session.execute(
        select(models.WorkflowDefinitionRevisionORM).where(
            models.WorkflowDefinitionRevisionORM.tenant_id == tenant_id,
            models.WorkflowDefinitionRevisionORM.definition_id == definition_id,
            models.WorkflowDefinitionRevisionORM.version == definition.published_version,
        )
    ).scalar_one_or_none()
    return _orm_to_workflow_definition_revision(revision) if revision else None


# ---------------------------------------------------------------------------
# Write API — flow validations
# ---------------------------------------------------------------------------
def put_validation(tenant_id: str, val: FlowValidation) -> FlowValidation:
    if not tenant_id:
        return val
    s = _session()
    issues_str = _join_lines(val.issues)
    existing = s.get(models.FlowValidationORM, val.id)
    if existing:
        existing.flow_id = val.flow_id
        existing.valid = val.valid
        existing.issues = issues_str
        existing.validated_at = val.validated_at
    else:
        s.add(models.FlowValidationORM(
            id=val.id, tenant_id=tenant_id, flow_id=val.flow_id,
            valid=val.valid, issues=issues_str, validated_at=val.validated_at,
        ))
    s.commit()
    return val


# ---------------------------------------------------------------------------
# Write API — flow test runs
# ---------------------------------------------------------------------------
def put_test_run(tenant_id: str, run: FlowTestRun) -> FlowTestRun:
    if not tenant_id:
        return run
    s = _session()
    output_str = _json_dumps(run.output)
    existing = s.get(models.FlowTestRunORM, run.id)
    if existing:
        existing.flow_id = run.flow_id
        existing.status = run.status
        existing.started_at = run.started_at
        existing.finished_at = run.finished_at
        existing.duration_ms = run.duration_ms
        existing.output = output_str
    else:
        s.add(models.FlowTestRunORM(
            id=run.id, tenant_id=tenant_id, flow_id=run.flow_id,
            status=run.status, started_at=run.started_at,
            finished_at=run.finished_at, duration_ms=run.duration_ms,
            output=output_str,
        ))
    s.commit()
    return run


# ---------------------------------------------------------------------------
# Bootstrap — seed SQL store from in_memory seed data (one-time)
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data.

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem

    counts: dict[str, int] = {}
    counts["flows"] = len(
        [put_flow(tenant_id, f) for f in mem.list_flows(tenant_id)]
    )
    counts["validations"] = len(
        [put_validation(tenant_id, v) for v in mem.list_validations(tenant_id)]
    )
    counts["test_runs"] = len(
        [put_test_run(tenant_id, r) for r in mem.list_test_runs(tenant_id)]
    )
    return counts
