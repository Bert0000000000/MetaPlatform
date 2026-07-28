"""Bootstrap verification tests (ST-5.3.6.x)."""
from __future__ import annotations

import pytest

from mate_tech_mcp.main import app, mcp_server, _rate_limiter, _ontology


def test_app_initialized() -> None:
    """ST-5.3.6.1 DoD: app 已初始化."""
    assert app.title == "mate-tech-mcp"
    assert app.version == "0.1.0"


def test_mcp_server_module_level() -> None:
    """mcp_server 模块级单例."""
    assert mcp_server is not None
    assert mcp_server.name == "mate-tech-mcp"


def test_default_tools_registered() -> None:
    """kb_search 已默认注册."""
    tool_names = [getattr(t, "name", None) for t in mcp_server._tools]
    assert "kb_search" in tool_names


def test_default_resources_registered() -> None:
    """ontology 资源已默认注册."""
    assert len(mcp_server._resources) >= 1


def test_rate_limiter_module_level() -> None:
    """_rate_limiter 已初始化."""
    assert _rate_limiter is not None


def test_ontology_module_level() -> None:
    """_ontology 已初始化."""
    assert _ontology is not None


def test_routes_registered() -> None:
    """FastAPI 路由注册."""
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    # 核心 4 路由
    assert "/healthz" in paths
    assert "/api/v1/mcp/tools" in paths
    assert "/api/v1/mcp/resources" in paths
    assert "/api/v1/mcp/prompts" in paths