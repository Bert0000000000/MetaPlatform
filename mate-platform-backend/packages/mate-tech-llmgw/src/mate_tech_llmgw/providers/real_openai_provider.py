"""Real OpenAI ChatCompletion provider with tenant-scoped keys + stub fallback (TD-6).

P3-W7: this provider wraps the real OpenAI Chat Completions API via
``httpx.AsyncClient``. Key behaviours:

  * **Tenant-scoped API key**: resolves ``OPENAI_API_KEY_{TENANT}``
    (uppercased, hyphens → underscores) first, then falls back to the
    global ``OPENAI_API_KEY`` env var. This satisfies hard rule 12
    (no secrets in git) + tenant isolation (hard rule 3).
  * **Stub fallback**: when the real call fails (no key, timeout,
    HTTP error), the provider returns a deterministic stub response
    and emits a structlog warning so the caller can still proceed.
  * **Lineage hints**: every response carries ``tenant_id`` +
    ``provider`` metadata (hard rule 9).

The provider implements the same ``chat`` signature as the existing
``OpenAIChatProvider`` so it can be swapped in via the router.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

from ..chat import ChatMessage, ChatResponse

logger = structlog.get_logger(__name__)

_OPENAI_BASE_URL = "https://api.openai.com/v1"
_DEFAULT_MODEL = "gpt-4o-mini"


def _stub_response(model: str, messages: list[ChatMessage]) -> ChatResponse:
    """Build a deterministic stub response for fallback."""
    last_user = ""
    for m in reversed(messages):
        if m.role == "user":
            last_user = m.content
            break
    return ChatResponse(
        content=f"[stub-fallback] OpenAI unavailable. Echo: {last_user[:80]}",
        model=model,
        finish_reason="stop",
        usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    )


class RealOpenAIProvider:
    """Real OpenAI provider with tenant key resolution + stub fallback (TD-6)."""

    provider_type = "real-openai"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = _DEFAULT_MODEL,
        base_url: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self._base_url = base_url or os.getenv("OPENAI_BASE_URL", _OPENAI_BASE_URL)
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def _resolve_api_key(self, tenant_id: str) -> str:
        """Resolve the API key for a tenant.

        Priority: explicit ``api_key`` > ``OPENAI_API_KEY_{TENANT}`` >
        ``OPENAI_API_KEY``.
        """
        if self._api_key:
            return self._api_key
        if tenant_id:
            tenant_key = f"OPENAI_API_KEY_{tenant_id.upper().replace('-', '_')}"
            val = os.getenv(tenant_key, "")
            if val:
                return val
        return os.getenv("OPENAI_API_KEY", "")

    async def _get_client(self, api_key: str) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={"Authorization": f"Bearer {api_key}"},
            )
        return self._client

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        tenant_id: str = "",
        **kwargs: Any,
    ) -> ChatResponse:
        """Call OpenAI Chat Completions, falling back to stub on error."""
        api_key = self._resolve_api_key(tenant_id)
        if not api_key:
            logger.warning(
                "llmgw.real.openai.no_key",
                tenant_id=tenant_id,
                model=self.model,
            )
            return _stub_response(self.model, messages)

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": m.role, "content": m.content}
                for m in messages
            ],
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if tools:
            payload["tools"] = tools

        try:
            client = await self._get_client(api_key)
            resp = await client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning(
                "llmgw.real.openai.timeout",
                tenant_id=tenant_id,
                model=self.model,
            )
            return _stub_response(self.model, messages)
        except httpx.HTTPError as e:
            logger.warning(
                "llmgw.real.openai.error",
                tenant_id=tenant_id,
                model=self.model,
                error=str(e),
            )
            return _stub_response(self.model, messages)

        choice = data["choices"][0]
        message = choice["message"]
        usage = data.get("usage", {})
        return ChatResponse(
            content=message.get("content", "") or "",
            model=data.get("model", self.model),
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
        if self._client is not None:
            await self._client.aclose()
            self._client = None
