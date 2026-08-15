"""ChatProvider Protocol (ST-5.5.2.2).

Unified LLM chat interface across providers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class ChatMessage:
    """聊天消息 - payload + role."""

    role: str
    content: str
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ChatResponse:
    """聊天响应 - content + tool_calls + usage."""

    content: str
    model: str
    reasoning_content: str = ""
    finish_reason: str | None = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)


@runtime_checkable
class ChatProvider(Protocol):
    """统一的 Chat Provider 接口 - 所有 provider 必须实现."""

    model: str

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> ChatResponse:
        """异步 chat 调用."""
        ...

    @property
    def dim(self) -> int:
        """provider 支持的 embedding 维度(如适用)."""
        ...