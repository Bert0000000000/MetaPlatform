"""LangChain LLM integration with streaming support (TC-5.7.9 + TC-5.7.10).

LLM_PROVIDER env: "openai" | "noop" | "echo" (default).
"""
from __future__ import annotations

import logging
import os
from collections.abc import Iterator

_log = logging.getLogger(__name__)


class NoOpLLM:
    def invoke(self, prompt):
        return f"[NoOpLLM echo] You said: {prompt[:200]}"

    def stream(self, prompt):
        text = f"[NoOpLLM echo] You said: {prompt[:200]}"
        for word in text.split(" "):
            yield word + " "


class EchoLLM:
    def invoke(self, prompt):
        return f"[EchoLLM] {prompt[:500]}"

    def stream(self, prompt):
        text = f"[EchoLLM] {prompt[:500]}"
        for word in text.split(" "):
            yield word + " "


def get_llm():
    provider = os.environ.get("LLM_PROVIDER", "echo").lower()
    if provider == "openai":
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise RuntimeError("langchain_openai not installed") from exc
        model = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        return ChatOpenAI(model=model, temperature=0.0)
    if provider == "noop":
        return NoOpLLM()
    return EchoLLM()


def _build_prompt(query, chunks):
    if not chunks:
        return f"Question: {query}\n\nNo context available. Answer briefly:"
    context_lines = []
    for i, c in enumerate(chunks[:5], 1):
        text = (c.get("text") or "").strip().replace("\n", " ")[:300]
        score = c.get("score", 0.0)
        context_lines.append(f"[{i}] (score={score:.2f}) {text}")
    context = "\n".join(context_lines)
    return (
        f"Use the following context to answer the question. "
        f"Be concise and cite sources by [number].\n\nContext:\n{context}\n\nQuestion: {query}\n\nAnswer:"
    )


def synthesize_answer(llm, query, chunks):
    prompt = _build_prompt(query, chunks)
    if hasattr(llm, "stream"):
        try:
            chunks_out = list(llm.stream(prompt))
            text = "".join(chunks_out)
            if hasattr(llm, "invoke"):
                try:
                    result = llm.invoke(prompt)
                    if hasattr(result, "content"):
                        return str(result.content)
                    return str(result)
                except Exception:
                    return text
            return text
        except Exception as exc:
            _log.warning("LLM stream failed, falling back to extractive: %s", exc)

    try:
        result = llm.invoke(prompt)
        if hasattr(result, "content"):
            return str(result.content)
        return str(result)
    except Exception as exc:
        _log.warning("LLM invoke failed: %s", exc)
        if not chunks:
            return f"I could not find relevant information for: {query!r}"
        snippets = [c.get("text", "")[:150] for c in chunks[:3] if c.get("text")]
        return "Based on " + str(len(chunks)) + " chunks: " + " | ".join(snippets)


def stream_answer(llm, query, chunks) -> Iterator[str]:
    """Yield LLM tokens one at a time (TC-5.7.9 SSE).

    Falls back to word-level chunking for non-streaming LLMs.
    """
    prompt = _build_prompt(query, chunks)
    if hasattr(llm, "stream"):
        try:
            yield from llm.stream(prompt)
            return
        except Exception as exc:
            _log.warning("LLM stream failed, falling back: %s", exc)

    full = synthesize_answer(llm, query, chunks)
    for word in full.split(" "):
        yield word + " "
