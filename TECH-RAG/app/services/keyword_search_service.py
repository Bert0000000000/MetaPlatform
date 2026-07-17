"""BM25 keyword search service (P1-RAG-05).

Performs keyword-based search over document chunks using the BM25 algorithm
implemented in pure Python/numpy (no external BM25 library required).
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any

from app.models.repository import (
    DocumentChunkRepository,
    DocumentRepository,
)

logger = logging.getLogger("techrag")

# Maximum number of documents to scan per KB for retrieval.
_MAX_DOC_SCAN = 10000

# BM25 parameters.
_K1 = 1.5
_B = 0.75


def _tokenize(text: str) -> list[str]:
    """Tokenize text by whitespace and punctuation, lowercase."""
    return [t for t in re.split(r"[\s\W_]+", text.lower()) if t]


class KeywordSearchService:
    """BM25 keyword search over document chunks."""

    def __init__(
        self,
        chunk_repository: DocumentChunkRepository,
        doc_repository: DocumentRepository,
    ) -> None:
        self._chunk_repo = chunk_repository
        self._doc_repo = doc_repository

    async def search(
        self,
        query: str,
        kb_id: str,
        tenant_id: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Search for chunks matching *query* using BM25.

        Returns a list of dicts sorted by descending BM25 score,
        each containing ``chunkId``, ``content``, ``score``,
        ``documentId`` and ``documentName``.
        """

        docs, _ = await self._doc_repo.list(
            tenant_id, kb_id, page=1, page_size=_MAX_DOC_SCAN
        )
        if not docs:
            return []

        doc_ids = [d.id for d in docs]
        doc_map = {d.id: d for d in docs}

        chunks = await self._chunk_repo.list_by_documents(doc_ids, tenant_id)
        if not chunks:
            return []

        results = self._rank_by_bm25(query, chunks, doc_map)
        return results[:top_k]

    # ------------------------------------------------------- BM25 ranking

    @staticmethod
    def _rank_by_bm25(
        query: str,
        chunks: list[Any],
        doc_map: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Compute BM25 scores and return sorted results."""

        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        # Build corpus: list of token lists per chunk.
        corpus = [_tokenize(c.content) for c in chunks]
        n = len(corpus)

        # Document lengths and average length.
        doc_lengths = [len(tokens) for tokens in corpus]
        avg_dl = sum(doc_lengths) / n if n > 0 else 0.0

        # Document frequency: how many documents contain each term.
        df: dict[str, int] = {}
        for tokens in corpus:
            for term in set(tokens):
                df[term] = df.get(term, 0) + 1

        # Term frequency per document.
        tf_per_doc: list[dict[str, int]] = []
        for tokens in corpus:
            tf: dict[str, int] = {}
            for term in tokens:
                tf[term] = tf.get(term, 0) + 1
            tf_per_doc.append(tf)

        results: list[dict[str, Any]] = []
        for i, chunk in enumerate(chunks):
            score = 0.0
            tf = tf_per_doc[i]
            dl = doc_lengths[i]

            for term in query_tokens:
                if term not in tf:
                    continue
                f = tf[term]
                d = df.get(term, 0)
                # IDF (BM25 variant, always non-negative).
                idf = math.log(1 + (n - d + 0.5) / (d + 0.5))
                # BM25 term score.
                denom = f + _K1 * (1 - _B + _B * (dl / avg_dl if avg_dl > 0 else 0))
                score += idf * (f * (_K1 + 1)) / denom if denom > 0 else 0.0

            if score <= 0:
                continue

            doc = doc_map.get(chunk.document_id)
            results.append(
                {
                    "chunkId": chunk.id,
                    "content": chunk.content,
                    "score": float(score),
                    "documentId": chunk.document_id,
                    "documentName": doc.filename if doc else "",
                }
            )

        results.sort(key=lambda r: r["score"], reverse=True)
        return results
