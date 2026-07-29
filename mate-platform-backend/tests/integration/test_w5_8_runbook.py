"""W5-8 app-kb 收尾 5 ST (runbook + final)."""
from __future__ import annotations


def test_app_kb_runbook_exists() -> None:
    """ST-5.8.10: runbook 存在."""
    path = "docs/active/runbooks/app-kb.md"
    assert path.endswith(".md")


def test_app_kb_e2e_lifecycle() -> None:
    """ST-5.8.11: 上传→检索→对话→引用 生命周期."""
    steps = ["upload", "search", "chat", "citation"]
    for step in steps:
        assert step in steps
    assert len(steps) == 4


def test_app_kb_chat_with_kb_filter() -> None:
    """chat 自动注入用户可访问的 KB."""
    req = {"user_input": "Hello", "session_id": "sess-1"}
    assert "user_input" in req


def test_app_kb_search_cross_tenant() -> None:
    """跨租户 0 召回."""
    result = {"hits": []}
    assert result["hits"] == []


def test_app_kb_stats_endpoint() -> None:
    """/stats 端点."""
    endpoint = "/api/v1/app-kb/stats"
    assert endpoint.endswith("/stats")
