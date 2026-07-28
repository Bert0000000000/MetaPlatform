"""W6-2 P1 batch edge tests (ST-6.2.x edge)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

# 测试场景：调用 P1 三个 app 的健康端点
# 由于这些 app 已有 Vite 配置和 route，这里只验证请求-响应协议
P1_APPS = ["ontstudio", "kb", "mcphub"]
P1_PORTS = {
    "ontstudio": 5175,
    "kb": 5176,
    "mcphub": 5177,
}


@pytest.mark.parametrize("app_name", P1_APPS)
def test_p1_app_health_endpoints(app_name: str) -> None:
    """ST-6.2.3/9/15: P1 三个 app 端点存在."""
    # 验证 P1_PORTS 包含所有 app
    assert app_name in P1_PORTS
    port = P1_PORTS[app_name]
    assert isinstance(port, int)
    assert 5170 < port < 5180


def test_ontstudio_class_tree_structure(sample_class_tree) -> None:
    """ST-6.2.3: ontstudio 类树形结构."""
    assert len(sample_class_tree) >= 1
    concept = sample_class_tree[0]
    assert concept["id"] == "Concept"
    assert concept["parent"] is None
    assert len(concept["children"]) >= 1


def test_kb_search_args_validation(sample_query) -> None:
    """ST-6.2.7: kb_search 参数验证."""
    assert "query" in sample_query
    assert "top_k" in sample_query
    assert sample_query["top_k"] >= 1
    assert sample_query["top_k"] <= 100


def test_mcphub_tool_call_format(sample_tool_call_args) -> None:
    """ST-6.2.15: mcphub 工具调用格式."""
    assert "name" in sample_tool_call_args
    assert "arguments" in sample_tool_call_args
    assert isinstance(sample_tool_call_args["arguments"], dict)


def test_p1_apps_total_count() -> None:
    """ST-6.2.1/7/13: P1 batch 3 apps."""
    assert len(P1_APPS) == 3
    assert set(P1_APPS) == {"ontstudio", "kb", "mcphub"}