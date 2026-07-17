"""Rerank service (P1-RAG-06).

Mock reranker that reorders documents based on Jaccard similarity between
the query tokens and document content tokens. Does not call LLMGW (M2 phase
simplification).
"""

from __future__ import annotations

import re
from typing import Any


def _tokenize(text: str) -> set[str]:
    """Tokenize text into a set of lowercase tokens."""
    return {t for t in re.split(r"[\s\W_]+", text.lower()) if t}


def _jaccard(set_a: set[str], set_b: set[str]) -> float:
    """Compute Jaccard similarity between two sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union) if union else 0.0


class RerankService:
    """Mock reranker using Jaccard similarity (P1-RAG-06)."""

    async def rerank(
        self,
        query: str,
        documents: list[dict[str, Any]],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Rerank *documents* by Jaccard overlap with *query*.

        Each document dict should contain at least a ``content`` field.
        Returns at most *top_k* documents sorted by the rerank score
        (descending). The original ``score`` is preserved as
        ``originalScore`` and the new score replaces ``score``.
        """

        if not documents:
            return []

        query_tokens = _tokenize(query)

        scored: list[dict[str, Any]] = []
        for doc in documents:
            content = doc.get("content", "")
            doc_tokens = _tokenize(content)
            jaccard = _jaccard(query_tokens, doc_tokens)

            entry = dict(doc)
            entry["originalScore"] = doc.get("score", 0.0)
            entry["score"] = float(jaccard)
            scored.append(entry)

        scored.sort(key=lambda r: r["score"], reverse=True)
        return scored[:top_k]
