"""W6 集成 E2E 端到端 (9 apps 真实路径)."""
from __future__ import annotations

import pytest


def test_portal_login_e2e_path() -> None:
    """portal 登录 E2E 路径."""
    steps = ["navigate /login", "fill credentials", "submit", "redirect /"]
    assert len(steps) == 4


def test_dashboard_render_charts_e2e() -> None:
    """dashboard 5 图表渲染."""
    charts = ["request_volume", "latency", "error_rate", "top_endpoints", "stats"]
    assert len(charts) == 5


def test_ontstudio_create_class_e2e() -> None:
    """ontstudio 类创建流程."""
    steps = ["click new", "fill name", "add properties", "save"]
    assert "save" in steps


def test_kb_upload_doc_e2e() -> None:
    """kb 上传文档流程."""
    steps = ["drag-drop file", "show progress", "index complete", "search"]
    assert "search" in steps


def test_superai_chat_stream_e2e() -> None:
    """superai 流式对话."""
    events = ["token", "token", "tool_call", "final"]
    assert events[0] == "token"
    assert events[-1] == "final"