"""Tests for the production Temporal worker composition root."""
from __future__ import annotations

import pytest
from mate_app_wfe import worker_main
from mate_tech_orchestrator.workflow_actions import OrderReviewActionExecutor


def test_worker_action_executor_is_the_order_review_adapter():
    executor = worker_main.build_worker_action_executor()

    assert isinstance(executor, OrderReviewActionExecutor)


@pytest.mark.asyncio
async def test_run_worker_connects_and_runs_with_real_action_executor(monkeypatch):
    settings = object()
    executor = object()
    events: list[object] = []

    class FakeWorker:
        async def run(self) -> None:
            events.append("run")

    monkeypatch.setattr(worker_main.WorkflowSettings, "from_env", lambda: settings)
    monkeypatch.setattr(worker_main, "init_engine", lambda: events.append("db"))
    monkeypatch.setattr(worker_main, "build_worker_action_executor", lambda: executor)

    async def fake_connect(actual_settings, *, action_executor):
        assert actual_settings is settings
        assert action_executor is executor
        events.append("connect")
        return FakeWorker()

    monkeypatch.setattr(worker_main, "connect_temporal_worker", fake_connect)

    await worker_main.run_worker()

    assert events == ["db", "connect", "run"]
