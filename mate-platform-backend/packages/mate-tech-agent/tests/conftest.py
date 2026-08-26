"""Shared pytest fixtures for mate-tech-agent."""
from __future__ import annotations

# BUSINESS-SLICES P1 wave 2: ensure cross-package paths work
# without `pip install -e .`. The block is appended after all
# `from __future__` and standard imports to keep Python happy.
import sys as _bsl_sys
from pathlib import Path as _bsl_Path

import pytest

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-agent",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
from mate_tech_agent.scenarios.memory import ShortTermMemory


class _EmptyRAGTool:
    """Deterministic unit-test double for the external RAG service."""

    def search(self, query: str, top_k: int = 5, mode: str = "AUTO", **kwargs):
        return []

    def close(self) -> None:
        return None


@pytest.fixture
def short_memory() -> ShortTermMemory:
    return ShortTermMemory(thread_id="test-thread", max_turns=5)


@pytest.fixture(autouse=True)
def isolated_rag_tool():
    """Keep package tests independent from a live RAG/Keycloak deployment."""
    from mate_tech_agent.tools import set_rag_tool

    set_rag_tool(_EmptyRAGTool())
    yield
    set_rag_tool(None)
