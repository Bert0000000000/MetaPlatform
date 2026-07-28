"""Shared pytest fixtures for mate-tech-mcp (ST-5.3.10.1)."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from mate_tech_mcp.server import MCPServer, create_server
from mate_tech_mcp.tools.kb_search import KbSearchTool
from mate_tech_mcp.resources.ontology import OntologyResource
from mate_tech_mcp.prompts.templates import (
    PROMPT_REGISTRY,
    SUMMARIZE_DOC,
    EXTRACT_ENTITIES,
    PLAN_TASK,
)


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