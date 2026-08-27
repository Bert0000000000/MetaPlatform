"""Shared pytest fixtures for mate-tech-mcp (ST-5.3.10.1)."""
from __future__ import annotations

# install_auth() reads these env vars at app-import time. Set them
# BEFORE any `mate_tech_mcp.main` import so the AuthConfig resolves in
# test profile (mirrors mate-tech-iam / mate-app-copilot conftest).
import os

# The streamable-http integration test starts a loopback server.  CI/dev
# machines may inject an HTTP proxy that turns 127.0.0.1 requests into 502s;
# MCP protocol tests must always exercise the local server directly.
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _sys
from pathlib import Path as _Path

_MONOREPO = _Path(__file__).resolve().parents[3]
for _sub in (
    "mate-tech-mcp",
    "mate-platform",
    "mate-clients",
    "mate-common",
    "mate-tech-db",
):
    _p = str(_MONOREPO / "packages" / _sub / "src")
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys  # noqa: E402
from pathlib import Path as _bsl_Path  # noqa: E402
from unittest.mock import AsyncMock  # noqa: E402

import pytest  # noqa: E402

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
_TESTS_DIR = str(_bsl_Path(__file__).resolve().parent)
if _TESTS_DIR not in _bsl_sys.path:
    _bsl_sys.path.insert(0, _TESTS_DIR)
for _bsl_sub in (
    "mate-tech-mcp",
    "mate-platform",
    "mate-clients",
    "mate-common",
    "mate-tech-db",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys  # noqa: E402
from pathlib import Path as _bsl_Path  # noqa: E402

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-mcp",
    "mate-platform",
    "mate-clients",
    "mate-common",
    "mate-tech-db",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)

from helpers import make_keycloak_token  # noqa: E402

from mate_tech_mcp.prompts.templates import (  # noqa: E402
    EXTRACT_ENTITIES,
    PLAN_TASK,
    SUMMARIZE_DOC,
)
from mate_tech_mcp.resources.ontology import OntologyResource  # noqa: E402
from mate_tech_mcp.server import MCPServer, create_server  # noqa: E402
from mate_tech_mcp.tools.kb_search import KbSearchTool  # noqa: E402


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_keycloak_token()}"}


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
