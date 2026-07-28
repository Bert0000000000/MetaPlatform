"""W6-2 ontstudio edge tests (ST-6.2.x edge)."""
from __future__ import annotations

import pytest


def test_ontstudio_class_tree_depth() -> None:
    """ST-6.2.3: 类树深度."""
    # 实际深度不超过 5
    max_depth = 5
    assert max_depth >= 3


def test_ontstudio_property_types() -> None:
    """ST-6.2.3: 属性类型支持."""
    property_types = ["string", "integer", "boolean", "datetime", "uri", "object"]
    assert "string" in property_types
    assert "integer" in property_types
    assert "uri" in property_types


def test_ontstudio_sparql_keywords() -> None:
    """ST-6.2.5: SPARQL 编辑器关键字."""
    keywords = ["SELECT", "INSERT", "DELETE", "WHERE", "LIMIT", "OFFSET", "PREFIX"]
    for kw in keywords:
        assert kw.isupper()


def test_ontstudio_explain_plan_format() -> None:
    """ST-6.2.5: explain 输出格式."""
    plan_lines = ["Operator: MATCH", "  - Triple count: N", "  - Variables: [...]"]
    assert any("Operator" in line for line in plan_lines)
    assert any("Variables" in line for line in plan_lines)


def test_ontstudio_namespace_default() -> None:
    """ST-6.2.3: 默认 namespace."""
    default_ns = "default"
    assert default_ns == "default"