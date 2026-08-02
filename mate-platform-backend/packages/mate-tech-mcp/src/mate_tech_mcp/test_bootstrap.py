"""Bootstrap verification tests (ST-5.3.6.x)."""
from __future__ import annotations

from mate_tech_mcp.main import (
    _ontology,  # pyright: ignore[reportPrivateUsage]
    _rate_limiter,  # pyright: ignore[reportPrivateUsage]
    app,
    mcp_server,
)


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
    tool_names = [getattr(t, "name", None) for t in mcp_server._tools]  # pyright: ignore[reportPrivateUsage]
    assert "kb_search" in tool_names


def test_default_resources_registered() -> None:
    """ontology 资源已默认注册."""
    assert len(mcp_server._resources) >= 1  # pyright: ignore[reportPrivateUsage]


def test_rate_limiter_module_level() -> None:
    """_rate_limiter 已初始化."""
    assert _rate_limiter is not None


def test_ontology_module_level() -> None:
    """_ontology 已初始化."""
    assert _ontology is not None


def test_routes_registered() -> None:
    """FastAPI 路由注册 (P3-W10 Fix-1 / W1).

    Uses ``app.openapi()`` (which honours include_router routing) instead
    of ``app.routes`` — FastAPI puts routers behind ``_IncludedRouter``
    wrappers that do not expose their inner routes via ``r.path``.
    """
    schema = app.openapi()  # pyright: ignore[reportAttributeAccessIssue]
    paths = set(schema.get("paths", {}).keys())
    # 核心 5 路由 (spec endpoint)
    assert "/healthz" in paths
    assert "/api/v1/mcp/tools" in paths
    assert "/api/v1/mcp/tools/{name}" in paths
    assert "/api/v1/mcp/resources" in paths
    assert "/api/v1/mcp/prompts" in paths
    assert "/api/v1/mcp/prompts/{name}" in paths
    # Federation 路由 (W1 commit)
    assert "/api/v1/mcp/federation/servers" in paths
    assert "/api/v1/mcp/federation/tools" in paths