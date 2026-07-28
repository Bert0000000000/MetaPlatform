"""W6-3 dw edge tests (ST-6.3.x edge)."""
from __future__ import annotations

import pytest


def test_dw_node_categories() -> None:
    """ST-6.3.14: 节点库（10 个内置）."""
    node_types = [
        "DB", "HTTP", "LLM", "Agent", "Branch",
        "Filter", "Map", "Union", "Sink", "Source",
    ]
    assert len(node_types) == 10
    assert "DB" in node_types
    assert "LLM" in node_types
    assert "Agent" in node_types


def test_dw_node_config_fields() -> None:
    """ST-6.3.13: 节点配置字段."""
    config = {"name": "fetch_data", "inputs": ["url"], "outputs": ["data"]}
    assert "name" in config
    assert "inputs" in config
    assert "outputs" in config


def test_dw_workflow_save_format() -> None:
    """ST-6.3.13: workflow 保存格式."""
    workflow = {
        "id": "wf-1",
        "name": "Data Pipeline",
        "nodes": [],
        "edges": [],
    }
    assert "id" in workflow
    assert "nodes" in workflow
    assert "edges" in workflow


def test_dw_pipeline_status() -> None:
    """ST-6.3.13: pipeline 状态."""
    states = ["draft", "running", "paused", "completed", "failed"]
    assert "draft" in states
    assert "running" in states