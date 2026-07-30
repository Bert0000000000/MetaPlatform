"""Shared pytest fixtures for mate-tech-mcp (ST-5.3.10.1)."""
from __future__ import annotations



# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _sys
from pathlib import Path as _Path
_MONOREPO = _Path(__file__).resolve().parents[3]
for _sub in (
    "mate-tech-mcp",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _p = str(_MONOREPO / "packages" / _sub / "src")
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

from unittest.mock import AsyncMock

import pytest


# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys
from pathlib import Path as _bsl_Path
_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-mcp",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys
from pathlib import Path as _bsl_Path
_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-mcp",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
from mate_tech_mcp.prompts.templates import (
    EXTRACT_ENTITIES,
    PLAN_TASK,
    SUMMARIZE_DOC,
)
from mate_tech_mcp.resources.ontology import OntologyResource
from mate_tech_mcp.server import MCPServer, create_server
from mate_tech_mcp.tools.kb_search import KbSearchTool


@pytest.fixture
def mcp_server() -> MCPServer:
    return create_server(name="test-mcp")


@pytest.fixture
def mock_redis() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def mock_keycloak() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def kb_tool() -> KbSearchTool:
    return KbSearchTool()


@pytest.fixture
def ontology_resource() -> OntologyResource:
    return OntologyResource()


@pytest.fixture
def all_prompts() -> list:
    return [SUMMARIZE_DOC, EXTRACT_ENTITIES, PLAN_TASK]