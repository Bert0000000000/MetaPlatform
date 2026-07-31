"""Full-text search tests (ST-5.4.10)."""
from __future__ import annotations

from mate_tech_ont.search.fulltext import _tokenize, fuzzy_match  # pyright: ignore[reportPrivateUsage]


def test_tokenize_english() -> None:
    tokens = _tokenize("Concept and Object")
    assert "concept" in tokens
    assert "and" in tokens
    assert "object" in tokens


def test_tokenize_chinese() -> None:
    tokens = _tokenize("概念对象")
    # bigram + trigram
    assert "概念" in tokens
    assert "对象" in tokens
    assert "概念对" in tokens


def test_tokenize_mixed() -> None:
    tokens = _tokenize("Concept 概念 Object 对象")
    assert "concept" in tokens
    assert "概念" in tokens
    assert "object" in tokens
    assert "对象" in tokens


def test_fuzzy_match_exact() -> None:
    candidates = [("c1", "class", "Concept")]
    hits = fuzzy_match("Concept", candidates)
    assert len(hits) == 1
    assert hits[0].id == "c1"
    assert hits[0].score == 1.0


def test_fuzzy_match_no_match() -> None:
    candidates = [("c1", "class", "Concept")]
    hits = fuzzy_match("UnrelatedQuery", candidates)
    assert hits == []


def test_fuzzy_match_partial() -> None:
    candidates = [("c1", "class", "Concept"), ("c2", "class", "Object")]
    hits = fuzzy_match("Concept", candidates)
    assert len(hits) == 1
    assert hits[0].id == "c1"


def test_fuzzy_match_chinese() -> None:
    candidates = [("c1", "class", "概念本体")]
    hits = fuzzy_match("概念", candidates)
    assert len(hits) == 1
    assert hits[0].source == "class"
