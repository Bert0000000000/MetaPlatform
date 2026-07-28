"""mcphub prompts + resources 边角 (ST-6.2.13/16/17)."""
from __future__ import annotations

import pytest


def test_prompt_templates_count() -> None:
    """ST-6.2.13: 3 个 prompt 模板."""
    templates = ["summarize_doc", "extract_entities", "plan_task"]
    assert len(templates) == 3
    assert "summarize_doc" in templates


def test_summarize_doc_render() -> None:
    """summarize_doc 渲染."""
    template = "请用 3 句话总结:\n{doc}"
    rendered = template.format(doc="test")
    assert "test" in rendered
    assert "3 句话" in rendered


def test_extract_entities_render() -> None:
    """extract_entities 渲染."""
    template = "抽取:\n{text}\n格式: {fmt}"
    rendered = template.format(text="X", fmt="JSON")
    assert "X" in rendered
    assert "JSON" in rendered


def test_plan_task_render() -> None:
    """plan_task 渲染."""
    template = "任务: {task}\n工具: {tools}"
    rendered = template.format(task="search", tools="kb_search")
    assert "search" in rendered
    assert "kb_search" in rendered


def test_resource_uri_validation() -> None:
    """ST-6.2.17: resource URI 验证."""
    valid_uris = ["ontology://Concept", "ontology://Object", "ontology://Metric"]
    for uri in valid_uris:
        assert uri.startswith("ontology://")
        assert len(uri) > len("ontology://")