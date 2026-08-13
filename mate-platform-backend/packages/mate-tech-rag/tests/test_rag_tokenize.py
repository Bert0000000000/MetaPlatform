"""Tests for CJK-aware tokenization (tokenize_for_match).

Verifies that Chinese text is broken into character bigrams so overlap-based
scoring (KeywordReranker) and similarity-based splitting (SemanticChunker)
work on Chinese, while Latin text tokenizes exactly as before.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-tech-rag",):
    sys.path.insert(0, str(PKG / sub / "src"))

from mate_tech_rag.tokenize import tokenize_for_match  # noqa: E402


class TestTokenizeForMatch:
    def test_latin_words_lowercased(self) -> None:
        """Latin/digit runs become lowercased whole-word tokens."""
        assert tokenize_for_match("Machine Learning 101") == {"machine", "learning", "101"}

    def test_empty_string(self) -> None:
        assert tokenize_for_match("") == set()

    def test_cjk_bigrams(self) -> None:
        """A 4-char CJK run produces 3 overlapping bigrams."""
        # 订单管理 -> 订单, 单管, 管理
        assert tokenize_for_match("订单管理") == {"订单", "单管", "管理"}

    def test_cjk_lone_char_is_unigram(self) -> None:
        """A single CJK character yields a unigram, not nothing."""
        assert tokenize_for_match("单") == {"单"}

    def test_mixed_cjk_and_latin(self) -> None:
        """Chinese bigrams and Latin words coexist."""
        tokens = tokenize_for_match("订单管理 RAG system")
        assert "订单" in tokens and "管理" in tokens
        assert "rag" in tokens and "system" in tokens

    def test_shared_term_produces_overlap(self) -> None:
        """Two Chinese strings sharing a term have non-empty token overlap.

        This is the property KeywordReranker relies on; with naive whitespace
        splitting the overlap would be empty (Chinese has no spaces).
        """
        a = tokenize_for_match("订单审批流程")
        b = tokenize_for_match("订单审批流程结束")
        assert a & b == {"订单", "单审", "审批", "批流", "流程"}

    def test_unrelated_chinese_has_no_overlap(self) -> None:
        a = tokenize_for_match("订单审批流程")
        b = tokenize_for_match("天气预报大雨")
        assert a & b == set()
