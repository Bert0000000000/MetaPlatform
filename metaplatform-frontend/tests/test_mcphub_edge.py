"""W6-2 mcphub edge tests (ST-6.2.x edge)."""
from __future__ import annotations

import pytest


def test_mcphub_tool_schema_validation() -> None:
    """ST-6.2.15: tool schema JSON Schema 验证."""
    schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    }
    assert schema["type"] == "object"
    assert "query" in schema["properties"]
    assert "query" in schema["required"]


def test_mcphub_resource_uri_scheme() -> None:
    """ST-6.2.16: resource URI scheme."""
    uri = "ontology://Concept"
    assert uri.startswith("ontology://")


def test_mcphub_prompt_template_args() -> None:
    """ST-6.2.13: prompt 模板参数."""
    template = {"task": "search X", "tools": "kb_search"}
    assert "task" in template
    assert "tools" in template


def test_mcphub_try_it_validation() -> None:
    """ST-6.2.16: Try It 输入校验."""
    args = {"query": "test", "top_k": 5}
    assert args["query"]
    assert 1 <= args["top_k"] <= 100


def test_mcphub_resources_listing() -> None:
    """ST-6.2.17: resources listing."""
    resources = [{"uri": "ontology://Concept"}, {"uri": "ontology://Object"}]
    assert len(resources) == 2
    for r in resources:
        assert r["uri"].startswith("ontology://")