"""INTERCEPT/POLICY 端点接线单测：MP_POLICY_DENY_KINDS deny-first。"""

from __future__ import annotations

import importlib
import os

import pytest


@pytest.fixture()
def api(monkeypatch):
    os.environ.pop("MP_POLICY_DENY_KINDS", None)
    import mate_platform.marketplace.api.install as install_mod

    mod = importlib.reload(install_mod)
    yield mod
    os.environ.pop("MP_POLICY_DENY_KINDS", None)


def test_policy_engine_allows_by_default(api):
    engine = api._install_policy_engine()
    assert engine.check({"kind": "mcp"}).allowed


def test_policy_engine_denies_configured_kind(api, monkeypatch):
    monkeypatch.setenv("MP_POLICY_DENY_KINDS", "agent,ontology")
    engine = api._install_policy_engine()
    assert not engine.check({"kind": "agent"}).allowed
    assert engine.check({"kind": "mcp"}).allowed
    v = engine.check({"kind": "ontology"})
    assert "deny-kind:ontology" in v.reason
