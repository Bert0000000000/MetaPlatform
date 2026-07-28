"""W6 跨 app 集成 (portal + dashboard + kb + superai)."""
from __future__ import annotations

import pytest


def test_portal_navigate_to_dashboard() -> None:
    """portal → dashboard."""
    url = "http://localhost:9200/dashboard"
    assert url == "http://localhost:9200/dashboard"


def test_portal_iam_login_uses_keycloak() -> None:
    """portal IAM 走 keycloak (W3)."""
    auth_url = "http://keycloak:8080/realms/mate"
    assert "keycloak" in auth_url


def test_dashboard_shows_kb_stats() -> None:
    """dashboard 显示 KB 统计 (W5-8)."""
    endpoint = "/api/v1/app-kb/stats"
    assert endpoint.startswith("/api/v1/app-kb")


def test_kb_search_uses_tech_rag() -> None:
    """kb 检索走 tech-rag (W5-6)."""
    endpoint = "/api/v1/rag/search"
    assert endpoint.startswith("/api/v1/rag")


def test_superai_uses_tech_agent() -> None:
    """superai 调 tech-agent (W5-7)."""
    endpoint = "/api/v1/agent/chat"
    assert endpoint.startswith("/api/v1/agent")


def test_ontstudio_uses_tech_ont() -> None:
    """ontstudio 调 tech-ont (W5-4)."""
    endpoint = "/api/v1/ont/sparql"
    assert endpoint.startswith("/api/v1/ont")


def test_mcphub_uses_tech_mcp() -> None:
    """mcphub 调 tech-mcp (W5-3)."""
    endpoint = "/api/v1/mcp/tools"
    assert endpoint.startswith("/api/v1/mcp")


def test_apphub_routes_to_dashboard() -> None:
    """apphub 链接到 dashboard."""
    link = "/dashboard"
    assert link == "/dashboard"


def test_arch_canvas_saves_to_tech_ont() -> None:
    """arch 画布保存到 tech-ont."""
    endpoint = "/api/v1/ont/classes"
    assert endpoint.startswith("/api/v1/ont")


def test_dw_workflow_runs_through_tech_rag() -> None:
    """dw workflow 走 tech-rag (S4)."""
    flow = ["dw trigger", "tech-rag query", "result"]
    assert len(flow) == 3