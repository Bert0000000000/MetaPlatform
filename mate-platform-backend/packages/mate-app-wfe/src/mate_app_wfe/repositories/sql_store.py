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
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import FlowDefinition, FlowTestRun, FlowValidation


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
    from . import in_memory as mem  # noqa: PLC0415

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
