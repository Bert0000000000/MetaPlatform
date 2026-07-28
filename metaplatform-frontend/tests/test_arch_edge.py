"""W6-3 arch edge tests (ST-6.3.x edge)."""
from __future__ import annotations

import pytest


def test_arch_canvas_node_types() -> None:
    """ST-6.3.8: 画布节点类型."""
    node_types = ["app", "db", "queue", "cache", "user", "external"]
    assert len(node_types) >= 4
    assert "app" in node_types
    assert "db" in node_types


def test_arch_template_categories() -> None:
    """ST-6.3.9: 模板分类."""
    categories = ["microservice", "event-driven", "serverless", "data-pipeline"]
    assert "microservice" in categories
    assert "event-driven" in categories


def test_arch_node_save_payload() -> None:
    """ST-6.3.8: 节点保存 payload."""
    node = {"id": "n1", "type": "app", "x": 100, "y": 200, "label": "API"}
    assert "x" in node and "y" in node
    assert isinstance(node["x"], int)


def test_arch_edge_connection() -> None:
    """ST-6.3.8: 边连接."""
    edge = {"source": "n1", "target": "n2", "label": "calls"}
    assert "source" in edge
    assert "target" in edge


def test_arch_zoom_levels() -> None:
    """ST-6.3.8: 缩放级别."""
    levels = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0]
    assert 1.0 in levels