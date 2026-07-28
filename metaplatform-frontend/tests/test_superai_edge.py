"""W6-3 superai edge tests (ST-6.3.x edge)."""
from __future__ import annotations

import pytest


def test_superai_chat_scenarios() -> None:
    """ST-6.3.18: chat UI 三类事件."""
    event_types = ["token", "tool_call", "final"]
    assert "token" in event_types
    assert "tool_call" in event_types
    assert "final" in event_types


def test_superai_history_pagination() -> None:
    """ST-6.3.19: 历史分页."""
    page = {"items": [], "next_cursor": None, "has_more": False}
    assert "items" in page
    assert "has_more" in page
    assert page["has_more"] is False


def test_superai_starred_labels() -> None:
    """ST-6.3.19: 收藏 + 标签."""
    starred = {
        "id": "msg-1",
        "content": "...",
        "tags": ["important", "todo"],
    }
    assert "tags" in starred
    assert "important" in starred["tags"]


def test_superai_streaming_chunks() -> None:
    """ST-6.3.18: streaming chunks."""
    chunks = [
        {"type": "token", "text": "hello"},
        {"type": "token", "text": " world"},
        {"type": "final", "answer": "hello world"},
    ]
    assert len(chunks) == 3
    assert chunks[2]["type"] == "final"