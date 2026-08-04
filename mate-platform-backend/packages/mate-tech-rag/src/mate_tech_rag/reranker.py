"""Reranker for RAG retrieval results.

对检索结果做二次排序,提高相关性。

Strategies:
1. IdentityReranker — 不重排(透传)
2. KeywordReranker — 关键词匹配加分(query 关键词在 chunk 中的命中频率)
3. LengthReranker — 长度归一化(避免过短/过长 chunk 排名过高)
4. CrossEncoderReranker — cross-encoder 模型(预留,需 sentence-transformers)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class RerankCandidate:
    chunk_id: str
    text: str
    score: float
    metadata: dict[str, str] | None = None


class Reranker(Protocol):
    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]: ...


class IdentityReranker:
    """不重排,仅按原始 score 降序截断 top_k。"""

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]


class KeywordReranker:
    """关键词匹配加分:query 中的关键词在 chunk text 中出现则加分。"""

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        query_terms = set(query.lower().split())
        for c in candidates:
            text_terms = set(c.text.lower().split())
            overlap = len(query_terms & text_terms)
            c.score = c.score * 0.7 + (overlap / max(len(query_terms), 1)) * 0.3
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]


class LengthReranker:
    """长度归一化:chunk 过短(<50字)或过长(>2000字)降分。"""

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        for c in candidates:
            length = len(c.text)
            if length < 50:
                c.score *= 0.8
            elif length > 2000:
                c.score *= 0.9
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]


def create_reranker(strategy: str = "identity") -> Reranker:
    if strategy == "keyword":
        return KeywordReranker()
    if strategy == "length":
        return LengthReranker()
    return IdentityReranker()
