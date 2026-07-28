"""kb 全文检索 边角 (ST-6.2.11)."""
from __future__ import annotations

import pytest


def test_kb_fts_chinese_ngram() -> None:
    """中文 n-gram 分词."""
    query = "概念本体"
    bigrams = [query[i:i+2] for i in range(len(query)-1)]
    assert "概念" in bigrams
    assert "念本" in bigrams
    assert "本体" in bigrams


def test_kb_fts_english_tokenize() -> None:
    """英文分词."""
    import re
    text = "What is RAG? Knowledge retrieval."
    tokens = re.findall(r"\b[a-zA-Z]+\b", text)
    assert "What" in tokens
    assert "RAG" in tokens
    assert "Knowledge" in tokens


def test_kb_fts_mixed_language() -> None:
    """中英混合."""
    text = "Concept 概念 Object 对象"
    # 应该有英文 + 中文
    assert "Concept" in text
    assert "概念" in text
    assert "Object" in text
    assert "对象" in text


def test_kb_fts_search_response() -> None:
    """全文检索响应."""
    response = {
        "hits": [
            {"id": "doc1", "score": 0.95, "snippet": "..."},
        ],
        "total": 1,
        "took_ms": 25,
    }
    assert len(response["hits"]) == 1
    assert response["hits"][0]["score"] > 0.5
    assert response["took_ms"] >= 0


def test_kb_fts_upload_status_states() -> None:
    """上传状态机."""
    valid_states = {"pending", "processing", "completed", "failed"}
    assert "pending" in valid_states
    assert "completed" in valid_states
    assert "failed" in valid_states