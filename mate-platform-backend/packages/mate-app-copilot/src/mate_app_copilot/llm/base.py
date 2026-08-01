"""mate_app_copilot.llm.base — LLMProvider protocol + LLMResponse (TD-6).

The protocol is async because real providers (OpenAI / Anthropic) are
bound by ``httpx.AsyncClient``. The default ``StubProvider``
implements the same async surface but with deterministic, in-process
replies so tests can exercise the contract without external
dependencies.

The legacy module-level functions in ``stub_provider`` (chat /
embeddings / generate_sql) remain for backward compat with
``AsyncCopilotClient`` and ``LlmgwProvider`` — they are NOT going
through the new protocol. The new providers route via
``get_provider()`` and are surfaced in v3.1+ handlers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class LLMResponse:
    """Unified chat response across providers.

    Attributes:
        content:        The text reply (may be empty when streaming).
        model:          The model id that produced the reply
                        (e.g. ``gpt-4o-mini``, ``claude-3-5-sonnet-...``).
        finish_reason:  Provider-specific stop reason
                        (``stop`` / ``length`` / ``tool_calls`` / ...).
        usage:          Token accounting (``prompt_tokens``,
                        ``completion_tokens``, ``total_tokens``).
                        Stub provider reports zeros.
        metadata:       Provider / request metadata
                        (``provider_type``, ``tenant_id``,
                        ``trace_id``, ``model``, ``endpoint``, ...).
        lineage_hints:  Cross-service correlation payload; the caller
                        attaches it to the outbox event so the lineage
                        server can stitch the chain together
                        (ADR-0016 §3.1 + §13 hard rule 9).
    """

    content: str
    model: str
    finish_reason: str | None = None
    usage: dict[str, int] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    lineage_hints: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class LLMProvider(Protocol):
    """Async LLM provider protocol (chat / stream / embed).

    Implementations:
        - ``StubProvider``      (default, deterministic, no external deps)
        - ``OpenAIProvider``    (env: ``OPENAI_API_KEY`` / ``OPENAI_BASE_URL`` /
                                 ``OPENAI_MODEL``)
        - ``AnthropicProvider`` (env: ``ANTHROPIC_API_KEY`` / ``ANTHROPIC_BASE_URL`` /
                                 ``ANTHROPIC_MODEL``)

    Selection is centralized in ``factory.get_provider()``.
    """

    @property
    def provider_type(self) -> str:
        """Stable identifier (``stub`` | ``openai`` | ``anthropic``)."""
        ...

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tenant_id: str = "",
        trace_id: str = "",
        **kwargs: Any,
    ) -> LLMResponse:
        """Run a chat completion and return a structured response."""
        ...

    def stream(
        self,
        messages: list[dict[str, Any]],
        *,
        tenant_id: str = "",
        trace_id: str = "",
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Yield streaming chat chunks.

        Declared as a synchronous function returning an async iterator
        so callers can ``async for chunk in provider.stream(...)``
        without an extra ``await``. Implementations use ``async def``
        with ``yield`` (i.e. async generators), which satisfies the
        ``AsyncIterator[str]`` return type.
        """
        ...

    async def embed(
        self,
        texts: list[str],
        *,
        tenant_id: str = "",
        trace_id: str = "",
    ) -> list[list[float]]:
        """Return embedding vectors (one per input text)."""
        ...

    async def aclose(self) -> None:
        """Release any underlying httpx / aiohttp resources."""
        ...
