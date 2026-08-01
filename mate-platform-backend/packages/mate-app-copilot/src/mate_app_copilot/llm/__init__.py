"""mate_app_copilot.llm — LLM provider layer.

Exports:
    - the in-process deterministic ``stub_provider`` (legacy module-level
      functions, used by ``AsyncCopilotClient`` + ``LlmgwProvider``)
    - the HTTP-based ``llmgw_provider`` that calls mate-tech-llmgw
      (P2-W3, kept for backward compat)
    - the TD-6 ``LLMProvider`` abstraction: Protocol + ``LLMResponse`` +
      ``StubProvider`` / ``OpenAIProvider`` / ``AnthropicProvider`` +
      ``get_provider()`` factory (env-based selection)
"""
from . import llmgw_provider, stub_provider
from .anthropic_provider import AnthropicProvider
from .base import LLMProvider, LLMResponse
from .factory import ProviderType, get_provider
from .openai_provider import OpenAIProvider
from .stub_provider import StubProvider

__all__ = [
    "AnthropicProvider",
    "LLMProvider",
    "LLMResponse",
    "OpenAIProvider",
    "ProviderType",
    "StubProvider",
    "get_provider",
    "llmgw_provider",
    "stub_provider",
]
