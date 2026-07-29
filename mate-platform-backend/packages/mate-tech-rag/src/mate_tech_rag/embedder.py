"""Embedder abstraction + multiple implementations.

Implements TC-5.6.2 (real embedding model integration):
- OpenAIEmbedder: real httpx HTTP call to OpenAI /v1/embeddings (text-embedding-3-small, dim=1536)
- LocalTinyEmbedder: offline, deterministic 384-dim hash-based (demo + tests)
- HashEmbedder: 16-dim legacy (kept for unit tests)

Selection via EMBEDDER_PROVIDER env:
- "openai" -> OpenAIEmbedder (needs OPENAI_API_KEY)
- "local"  -> LocalTinyEmbedder (default, no deps)
- "hash"   -> HashEmbedder (legacy, 16-dim)
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from typing import Protocol

import httpx


class Embedder(Protocol):
    def embed(self, text: str) -> list[float]: ...
    @property
    def dim(self) -> int: ...


# ============================================================
# OpenAIEmbedder: real HTTP integration
# ============================================================
class OpenAIEmbedder:
    """OpenAI /v1/embeddings client (text-embedding-3-small, 1536 dim by default).

    Env: OPENAI_API_KEY, OPENAI_BASE_URL (default https://api.openai.com),
         OPENAI_EMBED_MODEL (default text-embedding-3-small).
    """

    DEFAULT_MODEL = "text-embedding-3-small"
    DEFAULT_DIM = 1536
    ENDPOINT = "/v1/embeddings"

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.openai.com",
        model: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        if not self._api_key:
            raise ValueError(
                "OpenAIEmbedder requires OPENAI_API_KEY (env or constructor)"
            )
        self._base_url = base_url.rstrip("/") or "https://api.openai.com"
        self._model = model or os.environ.get("OPENAI_EMBED_MODEL", self.DEFAULT_MODEL)
        self._dim = self.DEFAULT_DIM
        self._client = httpx.Client(timeout=timeout)
        self._url = f"{self._base_url}{self.ENDPOINT}"

    @property
    def dim(self) -> int:
        return self._dim

    def embed(self, text: str) -> list[float]:
        if not text.strip():
            return [0.0] * self.dim
        resp = self._client.post(
            self._url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={"input": text, "model": self._model},
        )
        resp.raise_for_status()
        body = resp.json()
        return [float(x) for x in body["data"][0]["embedding"]]

    def close(self) -> None:
        self._client.close()


# ============================================================
# LocalTinyEmbedder: offline deterministic 384-dim
# ============================================================
class LocalTinyEmbedder:
    """Deterministic 384-dim embedder using token-bag + hashed projection.

    Algorithm: tokenize -> hash each token to 4 random dims -> sum -> L2 normalize.
    Quality: lower than real models but stable and reproducible for demos + tests.
    """

    DIM = 384
    _TOKEN_RE = re.compile(r"[\w]+", re.UNICODE)

    def __init__(self, dim: int = DIM) -> None:
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return [t.lower() for t in LocalTinyEmbedder._TOKEN_RE.findall(text) if t]

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self._dim
        tokens = self._tokenize(text)
        if not tokens:
            return vec
        for tok in tokens:
            h = hashlib.sha512(tok.encode("utf-8")).digest()
            for i in range(min(8, len(h) // 4)):
                chunk = h[i * 4 : i * 4 + 4]
                idx = int.from_bytes(chunk, "big") % self._dim
                vec[idx] += 1.0 if (h[i] & 0x80) else -1.0
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec


# ============================================================
# HashEmbedder: legacy 16-dim
# ============================================================
DIM = 16


class HashEmbedder:
    """Legacy 16-dim hash-based embedder (kept for backward compat + unit tests)."""

    dim: int = DIM
    _TOKEN_RE = re.compile(r"[\w]+", re.UNICODE)

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return [t.lower() for t in HashEmbedder._TOKEN_RE.findall(text) if t]

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        tokens = self._tokenize(text)
        if not tokens:
            return vec
        for tok in tokens:
            h = hashlib.sha256(tok.encode("utf-8")).digest()
            for i in range(4):
                byte = h[i]
                idx = byte % self.dim
                vec[idx] += 1.0 if (byte & 0x80) else -1.0
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec


# ============================================================
# Factory
# ============================================================
def create_embedder(provider: str | None = None) -> Embedder:
    """Create embedder by provider name.

    Args:
        provider: "openai" | "local" | "hash" | None (use EMBEDDER_PROVIDER env, default "local")
    """
    name = (provider or os.environ.get("EMBEDDER_PROVIDER", "local")).lower()
    if name == "openai":
        return OpenAIEmbedder()
    if name == "local":
        return LocalTinyEmbedder()
    if name == "hash":
        return HashEmbedder()
    raise ValueError(f"Unknown embedder provider: {name}")
