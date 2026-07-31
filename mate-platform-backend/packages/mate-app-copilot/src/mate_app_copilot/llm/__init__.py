"""mate_app_copilot.llm — LLM provider layer.

Exports the in-process deterministic ``stub_provider`` and the
HTTP-based ``llmgw_provider`` that calls mate-tech-llmgw.
"""
from . import llmgw_provider, stub_provider

__all__ = ["llmgw_provider", "stub_provider"]
