"""Qwen Provider (ST-5.5.3.2).

Alibaba DashScope Qwen 系列，OpenAI 兼容 API。
"""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

from ..chat import ChatMessage, ChatResponse

logger = structlog.get_logger(__name__)

QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


class QwenChatProvider:
    """Qwen Chat Provider（OpenAI 兼容协议）."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "qwen-turbo",
        base_url: str = QWEN_BASE_URL,
        timeout: float = 30.0,
    ) -> None:
        self.model = model
        self._api_key = api_key or os.getenv("DASHSCOPE_API_KEY", "")
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={"Authorization": f"Bearer {self._api_key}"},
        )

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> ChatResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if tools:
            payload["tools"] = tools

        resp = await self._client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        choice = data["choices"][0]
        message = choice["message"]
        usage = data.get("usage", {})

        return ChatResponse(
            content=message.get("content", "") or "",
            model=data["model"],
            finish_reason=choice.get("finish_reason"),
            tool_calls=message.get("tool_calls", []) or [],
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
        )

    @property
    def dim(self) -> int:
        return 0

    async def aclose(self) -> None:
        await self._client.aclose()