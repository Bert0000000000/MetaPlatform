"""Conftest for W6-2 P1 batch (ontstudio/kb/mcphub) — ST-6.2.1/7/18."""
from __future__ import annotations

import pytest


@pytest.fixture
def sample_query() -> dict[str, object]:
    """ST-6.2.11 / 6.2.7 测试 kb_search 工具."""
    return {
        "query": "What is RAG?",
        "top_k": 5,
        "kb_ids": ["kb-1", "kb-2"],
    }


@pytest.fixture
def sample_class_tree() -> list[dict[str, object]]:
    """ST-6.2.3 ontstudio 本体树."""
    return [
        {"id": "Concept", "label": "概念", "parent": None, "children": ["Object", "Metric"]},
        {"id": "Object", "label": "对象", "parent": "Concept", "children": []},
        {"id": "Metric", "label": "指标", "parent": "Concept", "children": []},
    ]


@pytest.fixture
def sample_tool_call_args() -> dict[str, object]:
    """ST-6.2.15/16 mcphub 工具调用参数."""
    return {
        "name": "kb_search",
        "arguments": {
            "query": "test",
            "top_k": 3,
        },
    }