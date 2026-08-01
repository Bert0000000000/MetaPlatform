"""mate_app_copilot.llm.factory — provider selection factory (TD-6).

Auto-selects the LLM provider based on env vars:

    1. ``OPENAI_API_KEY`` present    → ``OpenAIProvider``
    2. ``ANTHROPIC_API_KEY`` present → ``AnthropicProvider``
    3. Neither                       → ``StubProvider`` (default, no external deps)

The factory is the single point at which provider selection happens;
callers should never instantiate OpenAI / Anthropic providers
directly outside of tests.
"""
from __future__ import annotations

import os
from enum import Enum

from .anthropic_provider import AnthropicProvider
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .stub_provider import StubProvider


class ProviderType(str, Enum):
    """Stable identifiers for the supported providers."""

    STUB = "stub"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


def get_provider(
    provider_type: ProviderType | str | None = None,
) -> LLMProvider:
    """Return the configured LLMProvider.

    Selection order when ``provider_type`` is None:
        1. ``OPENAI_API_KEY`` set    → ``OpenAIProvider``
        2. ``ANTHROPIC_API_KEY`` set → ``AnthropicProvider``
        3. (default)                 → ``StubProvider``

    Pass an explicit ``provider_type`` to override the auto-detection
    (used by tests).
    """
    if provider_type is None:
        if os.getenv("OPENAI_API_KEY"):
            return OpenAIProvider()
        if os.getenv("ANTHROPIC_API_KEY"):
            return AnthropicProvider()
        return StubProvider()

    if isinstance(provider_type, str):
        provider_type = ProviderType(provider_type.lower())

    if provider_type == ProviderType.OPENAI:
        return OpenAIProvider()
    if provider_type == ProviderType.ANTHROPIC:
        return AnthropicProvider()
    return StubProvider()
