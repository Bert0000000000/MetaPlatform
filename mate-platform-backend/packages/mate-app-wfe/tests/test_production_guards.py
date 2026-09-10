"""Production profile must not silently deploy flows in memory."""

from __future__ import annotations

import pytest
from mate_app_wfe.clients import FlowableClient


def test_production_rejects_unconfigured_flowable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    with pytest.raises(RuntimeError, match="Flowable"):
        FlowableClient(base_url="")


def test_production_configures_sql_and_temporal_without_memory_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.setenv("MATE_WORKFLOW_BACKEND", "temporal")
    monkeypatch.setenv("TEMPORAL_ADDRESS", "temporal:7233")
    monkeypatch.setenv("MATE_DB_URL", "postgresql://meta:meta@postgres:5432/metaplatform")

    from mate_app_wfe.main import create_app

    app = create_app()
    assert app.state.workflow_settings.is_deployed_profile is True
    assert app.state.workflow_executor is None
