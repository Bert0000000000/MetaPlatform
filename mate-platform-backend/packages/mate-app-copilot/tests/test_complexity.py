"""Tests for query complexity classification (PR-4).

Covers keyword matching, length gating, boundary conditions, and
Chinese / English keyword variants.
"""
from __future__ import annotations

from mate_app_copilot.routing.complexity import is_deep_research_query


def test_short_query_not_deep_research() -> None:
    """Short queries (even with keywords) are NOT deep research."""
    assert is_deep_research_query("研究") is False
    assert is_deep_research_query("分析一下") is False


def test_long_query_without_keywords_not_deep_research() -> None:
    """Long query without any research keyword is NOT deep research."""
    query = "今天天气不错我们去公园散步吧顺便买个冰淇淋吃一吃"  # > 30 chars, no keyword
    assert is_deep_research_query(query) is False


def test_long_query_with_research_keyword() -> None:
    """Long query containing 研究 → deep research."""
    query = (
        "请帮我做一个关于人工智能发展趋势的深入研究报告需要涵盖多个方面"
    )
    assert len(query) >= 30
    assert is_deep_research_query(query) is True


def test_long_query_with_analysis_keyword() -> None:
    """Long query containing 分析 → deep research."""
    query = (
        "我们需要对这份财务报表进行详细的财务分析包括资产负债和现金流"
    )
    assert len(query) >= 30
    assert is_deep_research_query(query) is True


def test_long_query_with_industry_keyword() -> None:
    """Long query containing 行业 → deep research."""
    query = (
        "请调研新能源汽车行业的发展现状并对比主要厂商的市场份额和竞争力"
    )
    assert len(query) >= 30
    assert is_deep_research_query(query) is True


def test_long_query_with_english_keywords() -> None:
    """English keywords (research / analysis / market) also trigger."""
    q1 = "Please do a comprehensive market research on cloud computing trends"
    assert len(q1) >= 30
    assert is_deep_research_query(q1) is True

    q2 = "I need a detailed analysis of the semiconductor supply chain issues"
    assert len(q2) >= 30
    assert is_deep_research_query(q2) is True

    q3 = "Give me an industry overview of the electric vehicle market in 2024"
    assert len(q3) >= 30
    assert is_deep_research_query(q3) is True


def test_boundary_30_chars() -> None:
    """Exactly 30 chars WITH keyword → deep research; 29 chars → not."""
    # 30-char query with keyword (研究 = 2 chars, need 28 more)
    base_28 = "a" * 28
    q_30 = base_28 + "研究"
    assert len(q_30) == 30
    assert is_deep_research_query(q_30) is True

    # 29-char query with keyword → too short
    base_27 = "a" * 27
    q_29 = base_27 + "研究"
    assert len(q_29) == 29
    assert is_deep_research_query(q_29) is False


def test_empty_query() -> None:
    """Empty string is not deep research."""
    assert is_deep_research_query("") is False
