"""Workflow executor ports and concrete local/Temporal adapters."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any, Protocol

from temporalio.exceptions import WorkflowAlreadyStartedError

from .config import WorkflowBackend, WorkflowSettings
from .contracts import Plan, WorkflowRun, WorkflowRunStatus


class WorkflowExecutor(Protocol):
    """Backend-neutral operations used by the workflow API."""

    async def start(self, plan: Plan, *, idempotency_key: str) -> WorkflowRun:
        """Start or resume one idempotent workflow run."""

    async def get(self, run_id: str) -> WorkflowRun:
        """Read durable public workflow state."""

    async def cancel(self, run_id: str) -> WorkflowRun:
        """Request cancellation and return the latest public state."""

    async def confirm(self, run_id: str, step_id: str) -> WorkflowRun:
        """Confirm a pending human approval gate."""

    async def reject(self, run_id: str, step_id: str) -> WorkflowRun:
        """Reject a pending human approval gate."""


class TemporalClient(Protocol):
    """Small subset of the Temporal client used by this adapter."""

    async def start_workflow(
        self,
        workflow: str,
        arg: dict[str, Any],
        *,
        id: str,
        task_queue: str,
    ) -> Any:
        ...

    def get_workflow_handle(self, workflow_id: str) -> Any:
        ...


class InMemoryWorkflowExecutor:
    """Explicit development/test executor; never selected in production."""

    def __init__(self) -> None:
        self._runs: dict[str, WorkflowRun] = {}
        self._idempotency: dict[tuple[str, str], str] = {}

    async def start(self, plan: Plan, *, idempotency_key: str) -> WorkflowRun:
        if not idempotency_key.strip():
            raise ValueError("idempotency_key is required")
        key = (plan.tenant_id, idempotency_key)
        existing_id = self._idempotency.get(key)
        if existing_id is not None:
            return self._runs[existing_id]
        run = WorkflowRun.new(plan, idempotency_key=idempotency_key)
        self._runs[run.run_id] = run
        self._idempotency[key] = run.run_id
        return run

    async def get(self, run_id: str) -> WorkflowRun:
        try:
            return self._runs[run_id]
        except KeyError as exc:
            raise KeyError(f"workflow run {run_id!r} not found") from exc

    async def cancel(self, run_id: str) -> WorkflowRun:
        run = await self.get(run_id)
        if run.status in {
            WorkflowRunStatus.COMPLETED,
            WorkflowRunStatus.FAILED,
            WorkflowRunStatus.CANCELED,
        }:
            return run
        updated = replace(
            run,
            status=WorkflowRunStatus.CANCELED,
            updated_at=datetime.now(UTC).isoformat(),
        )
        self._runs[run_id] = updated
        return updated

    async def confirm(self, run_id: str, step_id: str) -> WorkflowRun:
        raise RuntimeError("approval signals require the Temporal backend")

    async def reject(self, run_id: str, step_id: str) -> WorkflowRun:
        raise RuntimeError("approval signals require the Temporal backend")


@dataclass
class TemporalWorkflowExecutor:
    """Temporal adapter behind the backend-neutral workflow port."""

    client: TemporalClient
    settings: WorkflowSettings

    async def start(self, plan: Plan, *, idempotency_key: str) -> WorkflowRun:
        normalized_key = idempotency_key.strip()
        run_id = _stable_run_id(plan, normalized_key)
        workflow_input = {
            "run_id": run_id,
            "idempotency_key": normalized_key,
            "plan": plan.to_dict(),
        }
        try:
            await self.client.start_workflow(
                "mate.workflow.execute",
                workflow_input,
                id=_temporal_workflow_id(run_id),
                task_queue=self.settings.task_queue,
            )
        except WorkflowAlreadyStartedError:
            # Temporal enforces the stable workflow id server-side. Return
            # the existing public state rather than replaying a side effect.
            return await self.get(run_id)
        return WorkflowRun.new(
            plan,
            idempotency_key=normalized_key,
            run_id=run_id,
        )

    async def get(self, run_id: str) -> WorkflowRun:
        handle = self.client.get_workflow_handle(_temporal_workflow_id(run_id))
        payload = await handle.query("mate.workflow.run_state")
        return WorkflowRun.from_dict(payload)

    async def cancel(self, run_id: str) -> WorkflowRun:
        handle = self.client.get_workflow_handle(_temporal_workflow_id(run_id))
        await handle.cancel()
        return await self.get(run_id)

    async def confirm(self, run_id: str, step_id: str) -> WorkflowRun:
        if not step_id.strip():
            raise ValueError("step_id is required")
        handle = self.client.get_workflow_handle(_temporal_workflow_id(run_id))
        await handle.signal("mate.workflow.confirm", step_id.strip())
        return await self.get(run_id)

    async def reject(self, run_id: str, step_id: str) -> WorkflowRun:
        if not step_id.strip():
            raise ValueError("step_id is required")
        handle = self.client.get_workflow_handle(_temporal_workflow_id(run_id))
        await handle.signal("mate.workflow.reject", step_id.strip())
        return await self.get(run_id)


def _stable_run_id(plan: Plan, idempotency_key: str) -> str:
    if not idempotency_key.strip():
        raise ValueError("idempotency_key is required")
    material = "\0".join((plan.tenant_id, plan.definition_id, idempotency_key))
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]
    return f"run-{digest}"


def _temporal_workflow_id(run_id: str) -> str:
    return f"mate-workflow-{run_id}"


def build_workflow_executor(
    settings: WorkflowSettings,
    *,
    temporal_client: TemporalClient | None = None,
) -> WorkflowExecutor:
    """Build the configured executor without silently falling back."""
    if settings.backend is WorkflowBackend.LOCAL:
        if settings.is_deployed_profile:
            raise RuntimeError("local workflow executor is disabled in production")
        return InMemoryWorkflowExecutor()
    if temporal_client is None:
        raise RuntimeError(
            "Temporal client is required; use connect_workflow_executor() "
            "after configuring TEMPORAL_ADDRESS"
        )
    return TemporalWorkflowExecutor(client=temporal_client, settings=settings)


async def connect_workflow_executor(settings: WorkflowSettings) -> WorkflowExecutor:
    """Connect to Temporal and build its adapter.

    The import is lazy so local development can run the existing acceptance
    environment without a Temporal cluster, while a deployed profile still
    fails explicitly if the SDK or cluster is unavailable.
    """
    if settings.backend is not WorkflowBackend.TEMPORAL:
        return build_workflow_executor(settings)
    try:
        from temporalio.client import Client
    except ImportError as exc:
        raise RuntimeError("temporalio SDK is required for the Temporal backend") from exc
    client = await Client.connect(
        settings.temporal_address,
        namespace=settings.namespace,
    )
    return build_workflow_executor(settings, temporal_client=client)
