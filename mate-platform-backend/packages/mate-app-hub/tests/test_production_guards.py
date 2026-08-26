"""AppHub must not expose mock execution in a production profile."""
from __future__ import annotations

import asyncio

import pytest
from mate_app_hub.runtime.executor import get_executor


def test_production_rejects_mock_executor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.setenv("APPHUB_EXECUTOR_MODE", "mock")

    with pytest.raises(RuntimeError, match="mock executor"):
        get_executor()


def test_production_rejects_in_memory_apphub_state(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    from mate_app_hub.main import create_app

    with pytest.raises(RuntimeError, match="in-memory AppHub state"):
        create_app()


def test_production_rejects_direct_mock_action_execution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from mate_app_hub.runtime.executor import execute_action
    from mate_app_hub.runtime.schema import RuntimeAction, RuntimeContext

    monkeypatch.setenv("MATE_PROFILE", "production")
    action = RuntimeAction(action_id="a1", action_type="navigate", target="/home")

    with pytest.raises(RuntimeError, match="mock AppHub action execution"):
        asyncio.run(
            execute_action(
                RuntimeContext(app_id="app-1", tenant_id="tenant-1"), action, {}
            )
        )
