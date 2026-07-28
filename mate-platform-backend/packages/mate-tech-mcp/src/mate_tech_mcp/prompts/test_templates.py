"""Prompt templates tests (ST-5.3.4)."""
from __future__ import annotations

import pytest

from mate_tech_mcp.prompts.templates import (
    PROMPT_REGISTRY,
    list_prompts,
    render_prompt,
)


def test_registry_has_3_prompts() -> None:
    """ST-5.3.4 DoD: 3 个模板."""
    assert len(PROMPT_REGISTRY) == 3
    assert "summarize_doc" in PROMPT_REGISTRY
    assert "extract_entities" in PROMPT_REGISTRY
    assert "plan_task" in PROMPT_REGISTRY


def test_summarize_doc_renders() -> None:
    out = render_prompt("summarize_doc", document="some text")
    assert "some text" in out
    assert "总结" in out


def test_extract_entities_renders() -> None:
    out = render_prompt("extract_entities", text="hello world")
    assert "hello world" in out
    assert "JSON" in out


def test_plan_task_renders() -> None:
    out = render_prompt("plan_task", task="search X", tools="kb_search")
    assert "search X" in out
    assert "kb_search" in out


def test_render_unknown_raises() -> None:
    with pytest.raises(KeyError, match="not registered"):
        render_prompt("nonexistent", foo="bar")


def test_list_prompts_format() -> None:
    prompts = list_prompts()
    assert len(prompts) == 3
    for p in prompts:
        assert "name" in p
        assert "description" in p
        assert "arguments" in p
        assert all("name" in a and "required" in a for a in p["arguments"])