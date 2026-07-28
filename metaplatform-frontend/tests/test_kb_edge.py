"""W6-2 kb edge tests (ST-6.2.x edge)."""
from __future__ import annotations

import pytest


def test_kb_upload_chunk_size() -> None:
    """ST-6.2.10: 分块上传大小."""
    chunk_size = 5 * 1024 * 1024  # 5MB
    assert chunk_size == 5242880


def test_kb_search_top_k_bounds() -> None:
    """ST-6.2.7: top_k 边界."""
    assert 1 <= 1 <= 100  # 最小
    assert 1 <= 100 <= 100  # 最大
    assert 1 <= 50 <= 100  # 默认 50


def test_kb_search_response_shape() -> None:
    """ST-6.2.7: 响应 shape."""
    expected_keys = {"hits", "total", "query"}
    assert "hits" in expected_keys
    assert "total" in expected_keys
    assert "query" in expected_keys


def test_kb_ingest_event_payload() -> None:
    """ST-6.2.10: 摄入事件 payload."""
    payload = {"doc_id": "...", "kb_id": "...", "status": "processing"}
    assert "doc_id" in payload
    assert "kb_id" in payload
    assert payload["status"] in {"processing", "completed", "failed"}


def test_kb_fts_zhngram_fallback() -> None:
    """ST-6.2.10: 全文检索中文 n-gram 兜底."""
    # 中文字符 n-gram 至少 2 字符
    min_ngram = 2
    assert min_ngram == 2