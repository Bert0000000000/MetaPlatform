"""Production profile must not silently deploy flows in memory."""
from __future__ import annotations

import pytest
from mate_app_wfe.clients import FlowableClient


def test_production_rejects_unconfigured_flowable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    with pytest.raises(RuntimeError, match="Flowable"):
        FlowableClient(base_url="")


def test_production_rejects_in_memory_wfe_state(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    from mate_app_wfe.main import create_app

    with pytest.raises(RuntimeError, match="in-memory WFE state"):
        create_app()
