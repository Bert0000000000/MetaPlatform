"""Shared pytest fixtures for mate-tech-agent."""
from __future__ import annotations

import pytest

from mate_tech_agent.scenarios.memory import ShortTermMemory


@pytest.fixture
def short_memory() -> ShortTermMemory:
    return ShortTermMemory(thread_id="test-thread", max_turns=5)