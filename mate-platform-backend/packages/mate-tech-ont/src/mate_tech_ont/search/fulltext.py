"""全文检索 (ST-5.4.10).

实例 / 类名支持中文 + 英文模糊搜索（PG tsvector 占位）。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class SearchHit:
    """检索命中."""

    id: str
    score: float
    snippet: str
    source: str


_CH_NGRAM_RE = re.compile(r"[\u4e00-\u9fff]+")


def _tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for w in re.findall(r"\b[a-zA-Z]+\b", text):
        tokens.append(w.lower())
    for match in _CH_NGRAM_RE.findall(text):
        for n in (2, 3):
            for i in range(len(match) - n + 1):
                tokens.append(match[i:i + n])
    return tokens


def fuzzy_match(query: str, candidates: list[tuple[str, str, str]]) -> list[SearchHit]:
    query_tokens = set(_tokenize(query))
    if not query_tokens:
        return []
    hits: list[SearchHit] = []
    for cid, source, text in candidates:
        text_tokens = set(_tokenize(text))
        if not text_tokens:
            continue
        intersection = query_tokens & text_tokens
        if not intersection:
            continue
        score = len(intersection) / len(query_tokens | text_tokens)
        snippet = text[:80] + ("..." if len(text) > 80 else "")
        hits.append(SearchHit(id=cid, score=score, snippet=snippet, source=source))
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits
