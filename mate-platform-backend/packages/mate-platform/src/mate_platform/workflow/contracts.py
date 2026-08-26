"""Stable workflow contracts shared by APIs, workers, and adapters.

The public workflow model deliberately contains no Temporal-specific fields.
Temporal workflow ids, task queues, and query names belong to the adapter
layer so the frontend consumes the same contract regardless of the backend.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


class WorkflowRunStatus(StrEnum):
    """Public lifecycle states for a durable workflow run."""

    PENDING = "pending"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


@dataclass(frozen=True, slots=True)
class PlanStep:
    """One business step in the stable Plan DSL."""

    id: str
    action_type: str
    input: dict[str, Any] = field(default_factory=dict)
    requires_confirmation: bool = False

    def __post_init__(self) -> None:
        if not self.id.strip():
            raise ValueError("plan step id is required")
        if not self.action_type.strip():
            raise ValueError("plan step action_type is required")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "action_type": self.action_type,
            "input": dict(self.input),
            "requires_confirmation": self.requires_confirmation,
        }


@dataclass(frozen=True, slots=True)
class Plan:
    """Stable workflow input DSL; execution details stay in the backend."""

    definition_id: str
    version: str
    tenant_id: str
    steps: tuple[PlanStep, ...]
    input: dict[str, Any] = field(default_factory=dict)
    trace_id: str = ""
    correlation_id: str = ""

    def __post_init__(self) -> None:
        if not self.definition_id.strip():
            raise ValueError("plan definition_id is required")
        if not self.version.strip():
            raise ValueError("plan version is required")
        if not self.tenant_id.strip():
            raise ValueError("plan tenant_id is required")
        step_ids = [step.id for step in self.steps]
        if len(step_ids) != len(set(step_ids)):
            raise ValueError("plan step ids must be unique")

    def to_dict(self) -> dict[str, Any]:
        """Return the versioned payload passed to a workflow backend."""
        return {
            "definition_id": self.definition_id,
            "version": self.version,
            "tenant_id": self.tenant_id,
            "steps": [step.to_dict() for step in self.steps],
            "input": dict(self.input),
            "trace_id": self.trace_id,
            "correlation_id": self.correlation_id,
        }


@dataclass(frozen=True, slots=True)
class WorkflowRun:
    """Public state of one workflow execution."""

    run_id: str
    definition_id: str
    version: str
    tenant_id: str
    status: WorkflowRunStatus
    idempotency_key: str
    created_at: str
    updated_at: str
    error: str | None = None

    @classmethod
    def new(
        cls,
        plan: Plan,
        *,
        idempotency_key: str,
        status: WorkflowRunStatus = WorkflowRunStatus.RUNNING,
        run_id: str | None = None,
    ) -> WorkflowRun:
        if not idempotency_key.strip():
            raise ValueError("idempotency_key is required")
        now = datetime.now(UTC).isoformat()
        return cls(
            run_id=run_id or f"run-{uuid.uuid4().hex}",
            definition_id=plan.definition_id,
            version=plan.version,
            tenant_id=plan.tenant_id,
            status=status,
            idempotency_key=idempotency_key,
            created_at=now,
            updated_at=now,
        )

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> WorkflowRun:
        return cls(
            run_id=str(payload["run_id"]),
            definition_id=str(payload["definition_id"]),
            version=str(payload["version"]),
            tenant_id=str(payload["tenant_id"]),
            status=WorkflowRunStatus(str(payload["status"])),
            idempotency_key=str(payload["idempotency_key"]),
            created_at=str(payload["created_at"]),
            updated_at=str(payload["updated_at"]),
            error=str(payload["error"]) if payload.get("error") else None,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "definition_id": self.definition_id,
            "version": self.version,
            "tenant_id": self.tenant_id,
            "status": self.status.value,
            "idempotency_key": self.idempotency_key,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "error": self.error,
        }
