"""Provider client abstraction for chat / multimodal calls.

The default ``MockProviderClient`` does not contact any external service and
returns deterministic responses, making it safe to use in tests without
incurring cost.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from typing import List, Protocol

from app.chat.schemas import MultimodalImage


@dataclass
class MultimodalRequest:
    provider: str
    model_code: str
    text: str
    images: List[MultimodalImage] = field(default_factory=list)
    temperature: float = 0.7
    max_tokens: int = 1024
    system_prompt: str | None = None


@dataclass
class MultimodalResponse:
    id: str
    content: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int


class ProviderClient(Protocol):
    """Pluggable interface for talking to model providers."""

    def chat_multimodal(self, request: MultimodalRequest) -> MultimodalResponse: ...

    def raise_if_unknown(self, provider: str) -> None: ...


class MockProviderClient:
    """Deterministic provider client used in tests and Phase 2.

    The response is derived from a hash of the input so repeated calls with
    the same inputs return stable tokens / text snippets.
    """

    _RESPONSE_PREFIX = "Mock response"

    def __init__(self, *, latency_ms: int = 120) -> None:
        self._latency_ms = latency_ms
        self.calls: list[MultimodalRequest] = []

    # ----------------------------------------------------- multimodal chat

    def chat_multimodal(self, request: MultimodalRequest) -> MultimodalResponse:
        self.calls.append(request)
        digest = hashlib.sha256(
            f"{request.provider}|{request.model_code}|{request.text}".encode()
        ).hexdigest()
        completion = (
            f"{self._RESPONSE_PREFIX} from {request.provider}/{request.model_code} "
            f"digest={digest[:10]} images={len(request.images)}"
        )
        prompt_tokens = max(
            1,
            (len(request.text) + sum(len(i.url or i.base64 or "") for i in request.images))
            // 4,
        )
        completion_tokens = min(request.max_tokens, max(8, len(completion) // 4))
        return MultimodalResponse(
            id=f"chatcmpl-mock-{digest[:12]}",
            content=completion,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=self._latency_ms,
        )

    def raise_if_unknown(self, provider: str) -> None:
        from app.common.errors import ProviderNotFoundError

        if not provider:
            raise ProviderNotFoundError("provider is required")
        # In Phase 2 the mock accepts any non-empty provider; future SDK
        # implementations should validate against a registered list.

    def reset(self) -> None:
        self.calls.clear()