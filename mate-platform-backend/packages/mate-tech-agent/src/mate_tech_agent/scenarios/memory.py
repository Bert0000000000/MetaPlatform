"""Memory & context (ST-5.7.10).

短期（thread 内）+ 长期（向量库）记忆。
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class ShortTermMemory:
    """单 thread 内的短期记忆（最近 N 轮对话）."""

    thread_id: str
    max_turns: int = 20
    history: list[dict[str, Any]] = field(default_factory=list)

    def append(self, role: str, content: str) -> None:
        self.history.append({
            "role": role,
            "content": content,
            "ts": time.time(),
        })
        # 滑动窗口
        if len(self.history) > self.max_turns:
            self.history = self.history[-self.max_turns:]

    def recall(self, k: int = 5) -> list[dict[str, Any]]:
        return self.history[-k:]

    def clear(self) -> None:
        self.history.clear()


@dataclass
class LongTermMemory:
    """长期记忆（向量库索引 + 摘要）."""

    vector_store: Any | None = None  # 实际应注入 Milvus client
    summaries: dict[str, str] = field(default_factory=dict)

    async def remember(self, key: str, value: str) -> None:
        self.summaries[key] = value
        logger.info("memory.long.remembered", key=key)

    async def recall(self, query: str, *, top_k: int = 3) -> list[dict[str, Any]]:
        """向量库检索 + 摘要召回."""
        if self.vector_store is None:
            return []
        # 实际应调 vector_store.similarity_search(query, top_k)
        return []

    def get_summary(self, key: str) -> str | None:
        return self.summaries.get(key)
