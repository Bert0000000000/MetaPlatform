"""mate_app_copilot.llm.stub_provider — deterministic stub LLM.

P2-W2 ships deterministic, hash-based stubs so the copilot endpoints
are exercised without a real model gateway. P2-W3 swaps these for
real LLM Gateway calls (mate_tech_llmgw).

TD-6 (v3.1) adds the ``StubProvider`` class implementing the new
``LLMProvider`` protocol (chat / stream / embed) so the same factory
selection logic works for stub / OpenAI / Anthropic. The legacy
module-level functions are preserved for backward compat with
``AsyncCopilotClient`` + ``LlmgwProvider``.
"""
from __future__ import annotations

import hashlib
import struct
from typing import Any, AsyncIterator

from .base import LLMResponse

EMBEDDING_DIM = 1536


def _hash_vector(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Build a deterministic dim-length vector from the text hash."""
    out: list[float] = []
    seed = text.encode("utf-8")
    i = 0
    while len(out) < dim:
        chunk = hashlib.sha256(seed + i.to_bytes(4, "little")).digest()
        for offset in range(0, len(chunk), 4):
            if len(out) >= dim:
                break
            (val,) = struct.unpack("<I", chunk[offset : offset + 4])
            out.append((val % 10000) / 10000.0)
        i += 1
    return out


def embeddings(texts: list[str]) -> list[list[float]]:
    """Return fixed 1536-dim deterministic vectors (one per text)."""
    return [_hash_vector(t) for t in texts]


def chat(messages: list[dict]) -> str:
    """Return a stub chat reply acknowledging the last user message."""
    last = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last = str(msg.get("content", ""))
            break
    return f"[stub-copilot] Acknowledged: {last[:80]}"


def generate_sql(nl_prompt: str, tables: list[str]) -> str:
    """Return a stub SELECT SQL referencing the requested tables."""
    cols = ", ".join(tables[:3]) if tables else "*"
    table = tables[0] if tables else "dual"
    return f"SELECT {cols} FROM {table} WHERE 1=1; -- {nl_prompt[:60]}"  # noqa: S608


# ---------------------------------------------------------------------------
# StubProvider — async LLMProvider protocol implementation (TD-6)
# ---------------------------------------------------------------------------
class StubProvider:
    """Async LLMProvider implementation backed by the stub functions.

    Wraps the legacy module-level ``chat`` / ``embeddings`` functions
    so the factory selection logic works uniformly across stub /
    OpenAI / Anthropic. Streaming is emulated by yielding the chat
    reply in whitespace-separated chunks.

    Token usage is reported as zeros — the stub performs no real
    model invocation. ``aclose`` is a no-op since there are no
    resources to release.
    """

    provider_type = "stub"
    model = "stub-copilot"

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tenant_id: str = "",
        trace_id: str = "",
        **kwargs: Any,
    ) -> LLMResponse:
        content = chat(messages)
        return LLMResponse(
            content=content,
            model=self.model,
            finish_reason="stop",
            usage={
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            },
            metadata={
                "provider_type": self.provider_type,
                "tenant_id": tenant_id,
                "trace_id": trace_id,
                "model": self.model,
            },
            lineage_hints=self._lineage(tenant_id, trace_id),
        )

    async def stream(
        self,
        messages: list[dict[str, Any]],
        *,
        tenant_id: str = "",
        trace_id: str = "",
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        content = chat(messages)
        # Yield in token-ish chunks (split on whitespace boundaries)
        # so callers can validate streaming semantics.
        for chunk in content.split():
            yield chunk + " "
        # trailing newline so consumers can detect end-of-stream
        yield "\n"

    async def embed(
        self,
        texts: list[str],
        *,
        tenant_id: str = "",
        trace_id: str = "",
    ) -> list[list[float]]:
        return embeddings(texts)

    async def aclose(self) -> None:
        # Nothing to release for the stub.
        return None

    @staticmethod
    def _lineage(tenant_id: str, trace_id: str) -> dict[str, Any]:
        """Build lineage hints (ADR-0016 §3.1 + §13 hard rule 9)."""
        return {
            "tenant_id": tenant_id,
            "correlation_id": trace_id,
            "source_system": "mate-app-copilot",
            "provider": "stub",
            "model": "stub-copilot",
        }
