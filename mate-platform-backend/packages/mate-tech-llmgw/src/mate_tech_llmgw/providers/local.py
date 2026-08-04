"""Local Stub Provider.

纯离线 chat provider — 始终返回确定性 stub 响应，无网络调用。
用于本地开发 / CI / 隐私敏感场景 (``provider=local``)。

与 ``embeddings.LocalEmbeddingProvider`` 设计对齐。
"""
from __future__ import annotations

from typing import Any

from ..chat import ChatMessage, ChatResponse


class LocalStubProvider:
    """Local stub chat provider (no network, deterministic)."""

    def __init__(self, *, model: str = "local-stub", **_kwargs: Any) -> None:
        self.model = model

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> ChatResponse:
        """返回确定性 echo-style stub 响应."""
        last = messages[-1].content if messages else ""
        return ChatResponse(
            content=f"[local-stub] {last}",
            model=self.model,
            finish_reason="stop",
            usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        )

    @property
    def dim(self) -> int:
        return 0

    async def aclose(self) -> None:
        """无网络客户端，no-op."""
