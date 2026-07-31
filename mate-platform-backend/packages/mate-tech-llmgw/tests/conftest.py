"""Conftest for mate-tech-llmgw (ST-5.5.12.1 enhanced).

Adds the package src/ + cross-package dependencies to sys.path so
that the existing `from mate_tech_llmgw.X import Y` and
`from mate_platform.X import Y` imports work, even when pytest is
invoked from the package directory without `pip install -e .`.
"""
from __future__ import annotations

import sys
from pathlib import Path

# conftest.py path: <monorepo>/packages/mate-tech-llmgw/tests/conftest.py
# parents[3] is the monorepo root.
_MONOREPO = Path(__file__).resolve().parents[3]
for sub in (
    "mate-tech-llmgw",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    p = str(_MONOREPO / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)

from unittest.mock import AsyncMock  # noqa: E402

import pytest  # noqa: E402

from mate_tech_llmgw.cache.llm_cache import LLMCache  # noqa: E402


@pytest.fixture
def llm_cache() -> LLMCache:
    cache = LLMCache.__new__(LLMCache)
    cache._redis = AsyncMock()
    return cache