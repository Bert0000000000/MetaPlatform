"""Contract tests for the Temporal-only workflow boundary."""
from __future__ import annotations

import pytest
from temporalio.exceptions import WorkflowAlreadyStartedError

from mate_platform.workflow import (
    InMemoryWorkflowExecutor,
    Plan,
    PlanStep,
    TemporalWorkflowExecutor,
    WorkflowBackend,
    WorkflowRunStatus,
    WorkflowSettings,
    build_workflow_executor,
)


def _plan() -> Plan:
    return Plan(
        definition_id="order-review",
        version="1.0",
        tenant_id="tenant-acme",
        steps=(
            PlanStep(
                id="review",
                action_type="order.review",
                input={"order_id": "order-1"},
                requires_confirmation=True,
            ),
        ),
        input={"priority": "high"},
        trace_id="trace-1",
        correlation_id="corr-1",
    )


def test_plan_serializes_stable_dsl_without_temporal_details() -> None:
    payload = _plan().to_dict()

    assert payload == {
        "definition_id": "order-review",
        "version": "1.0",
        "tenant_id": "tenant-acme",
        "steps": [
            {
                "id": "review",
                "action_type": "order.review",
                "input": {"order_id": "order-1"},
                "requires_confirmation": True,
            }
        ],
        "input": {"priority": "high"},
        "trace_id": "trace-1",
        "correlation_id": "corr-1",
    }
    assert "temporal" not in str(payload).lower()


def test_plan_rejects_duplicate_step_ids() -> None:
    with pytest.raises(ValueError, match="unique"):
        Plan(
            definition_id="order-review",
            version="1.0",
            tenant_id="tenant-acme",
            steps=(
                PlanStep(id="same", action_type="a"),
                PlanStep(id="same", action_type="b"),
            ),
        )


def test_production_requires_temporal_backend_and_address(monkeypatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.delenv("MATE_WORKFLOW_BACKEND", raising=False)
    monkeypatch.delenv("TEMPORAL_ADDRESS", raising=False)

    with pytest.raises(RuntimeError, match="Temporal"):
        WorkflowSettings.from_env()


def test_staging_rejects_local_workflow_backend(monkeypatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "staging")
    monkeypatch.setenv("MATE_WORKFLOW_BACKEND", "local")

    with pytest.raises(RuntimeError, match="Temporal"):
        WorkflowSettings.from_env()


def test_development_defaults_to_local_backend(monkeypatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "development")
    monkeypatch.delenv("MATE_WORKFLOW_BACKEND", raising=False)
    monkeypatch.delenv("TEMPORAL_ADDRESS", raising=False)

    settings = WorkflowSettings.from_env()

    assert settings.backend is WorkflowBackend.LOCAL
    assert settings.temporal_address == ""


@pytest.mark.asyncio
async def test_local_executor_is_explicit_and_keeps_run_state() -> None:
    executor = InMemoryWorkflowExecutor()

    run = await executor.start(_plan(), idempotency_key="idem-1")
    stored = await executor.get(run.run_id)

    assert run.status is WorkflowRunStatus.RUNNING
    assert stored == run
    assert stored.tenant_id == "tenant-acme"


def test_production_factory_never_returns_local_executor(monkeypatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.setenv("MATE_WORKFLOW_BACKEND", "temporal")
    monkeypatch.setenv("TEMPORAL_ADDRESS", "temporal:7233")

    settings = WorkflowSettings.from_env()

    with pytest.raises(RuntimeError, match="client"):
        build_workflow_executor(settings)


@pytest.mark.asyncio
async def test_temporal_adapter_sends_only_stable_plan_payload() -> None:
    calls: list[dict[str, object]] = []

    class _Client:
        async def start_workflow(self, workflow, arg, *, id, task_queue):
            calls.append(
                {
                    "workflow": workflow,
                    "arg": arg,
                    "id": id,
                    "task_queue": task_queue,
                }
            )

        def get_workflow_handle(self, workflow_id):
            raise AssertionError(f"unexpected handle lookup: {workflow_id}")

    settings = WorkflowSettings(
        profile="staging",
        backend=WorkflowBackend.TEMPORAL,
        temporal_address="temporal:7233",
        namespace="mate-staging",
        task_queue="mate-workflows",
    )
    executor = TemporalWorkflowExecutor(_Client(), settings)

    run = await executor.start(_plan(), idempotency_key="idem-1")
    run_again = await executor.start(_plan(), idempotency_key="idem-1")

    assert run.run_id == run_again.run_id
    assert calls[0]["workflow"] == "mate.workflow.execute"
    assert calls[0]["task_queue"] == "mate-workflows"
    assert calls[0]["arg"] == _plan().to_dict()
    assert str(calls[0]["id"]).startswith("mate-workflow-run-")


@pytest.mark.asyncio
async def test_temporal_adapter_recovers_duplicate_idempotent_start() -> None:
    class _Handle:
        async def query(self, name):
            assert name == "mate.workflow.run_state"
            return existing.to_dict()

        async def cancel(self):
            raise AssertionError("cancel is not part of this test")

    class _Client:
        def __init__(self) -> None:
            self.started = False

        async def start_workflow(self, workflow, arg, *, id, task_queue):
            if self.started:
                raise WorkflowAlreadyStartedError(id, workflow)
            self.started = True

        def get_workflow_handle(self, workflow_id):
            assert workflow_id.startswith("mate-workflow-run-")
            return _Handle()

    settings = WorkflowSettings(
        profile="staging",
        backend=WorkflowBackend.TEMPORAL,
        temporal_address="temporal:7233",
        namespace="default",
        task_queue="mate-platform",
    )
    executor = TemporalWorkflowExecutor(_Client(), settings)
    existing = await executor.start(_plan(), idempotency_key="idem-2")

    recovered = await executor.start(_plan(), idempotency_key="idem-2")

    assert recovered == existing
