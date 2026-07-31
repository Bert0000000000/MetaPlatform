"""mate_app_copilot.llm.stub_provider — deterministic stub LLM.

P2-W2 ships deterministic, hash-based stubs so the copilot endpoints
are exercised without a real model gateway. P2-W3 swaps these for
real LLM Gateway calls (mate_tech_llmgw).
"""
from __future__ import annotations

import hashlib
import struct

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
