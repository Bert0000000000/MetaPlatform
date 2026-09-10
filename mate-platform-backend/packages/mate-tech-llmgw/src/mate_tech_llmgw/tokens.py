"""Token estimation helpers (P6 dedup).

4 chars ≈ 1 token heuristic — the single source of truth for every
estimated-token site (quota, budgets, api-key limits). One day this can
grow a tiktoken-backed mode; the call sites won't change.
"""

from __future__ import annotations

from typing import Any


def estimate_tokens(text: str) -> int:
    """4 chars ≈ 1 token, minimum 1 for non-empty text."""
    if not text:
        return 0
    return max(len(text) // 4, 1)


def estimate_messages_tokens(messages: list[Any]) -> int:
    """Sum the estimate over ChatMessage-like objects (or dicts)."""
    total = 0
    for msg in messages or []:
        if isinstance(msg, dict):
            content = msg.get("content", "") or ""
        else:
            content = getattr(msg, "content", "") or ""
        total += estimate_tokens(str(content))
    return total
