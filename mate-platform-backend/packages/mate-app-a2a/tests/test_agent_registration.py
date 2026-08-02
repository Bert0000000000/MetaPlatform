"""Tests for DeerFlow agent auto-registration at startup (PR-3).

Covers:
  - register_deerflow_creates_agent: agent exists after registration
  - register_deerflow_agent_has_correct_id: id == "deep-research"
  - register_deerflow_agent_has_web_research_capability: capability present
  - register_deerflow_disabled_when_env_false: env gate works
  - register_deerflow_endpoint_configurable: DEERFLOW_RESEARCH_URL honoured
"""
from __future__ import annotations

import os

import pytest

from mate_app_a2a.bootstrap.agent_registration import (
    get_startup_agent,
    register_deerflow_at_startup,
    register_deerflow_at_startup_if_enabled,
    reset_startup_agents,
)


@pytest.fixture(autouse=True)
def _clean_registry() -> None:
    """Reset the startup registry before and after each test."""
    reset_startup_agents()
    yield
    reset_startup_agents()


def test_register_deerflow_creates_agent() -> None:
    """After registration the agent is retrievable from the registry."""
    register_deerflow_at_startup()
    agent = get_startup_agent("deep-research")
    assert agent is not None, "deep-research agent should exist after registration"
    assert agent["name"]


def test_register_deerflow_agent_has_correct_id() -> None:
    """The registered agent carries id == 'deep-research'."""
    register_deerflow_at_startup()
    agent = get_startup_agent("deep-research")
    assert agent is not None
    assert agent["id"] == "deep-research"


def test_register_deerflow_agent_has_web_research_capability() -> None:
    """The agent exposes a 'web-research' capability with I/O schemas."""
    register_deerflow_at_startup()
    agent = get_startup_agent("deep-research")
    assert agent is not None
    caps = agent["capabilities"]
    assert len(caps) >= 1
    web_research = next(
        (c for c in caps if c["id"] == "web-research"), None,
    )
    assert web_research is not None, "web-research capability must be present"
    assert "input_schema" in web_research
    assert "output_schema" in web_research
    assert "query" in web_research["input_schema"]


def test_register_deerflow_disabled_when_env_false(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When DEERFLOW_RESEARCH_ENABLED=false the agent is NOT registered."""
    monkeypatch.setenv("DEERFLOW_RESEARCH_ENABLED", "false")
    result = register_deerflow_at_startup_if_enabled()
    assert result is False
    assert get_startup_agent("deep-research") is None


def test_register_deerflow_endpoint_configurable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DEERFLOW_RESEARCH_URL overrides the default endpoint."""
    custom = "https://my-deerflow.example.com/api/v1/a2a/invoke"
    monkeypatch.setenv("DEERFLOW_RESEARCH_URL", custom)
    register_deerflow_at_startup()
    agent = get_startup_agent("deep-research")
    assert agent is not None
    assert agent["endpoint"] == custom
