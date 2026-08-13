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
import logging
import math
import os
import re
from typing import Protocol

import httpx

_log = logging.getLogger(__name__)


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
# LlmgwEmbedder: route through mate-tech-llmgw gateway (doubao / openai)
# ============================================================
class LlmgwEmbedder:
    """Embedder that delegates to the mate-tech-llmgw gateway.

    POST {LLMGW_URL}/api/v1/llmgw/embeddings with provider="doubao"
    (火山方舟 ARK, OpenAI-compatible). The gateway owns the ARK_API_KEY,
    routing, deterministic hash fallback, cost/lineage -- so this class
    stays a thin HTTP client. ``dim`` defaults to the configured model's
    dimension (overridable via LLMGW_EMBED_DIM) and self-corrects on the
    first real response.
    """

    DEFAULT_MODEL = "doubao-embedding-text-240715"
    DEFAULT_DIM = 2048  # doubao-embedding-text-240715

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        provider: str = "doubao",
        timeout: float = 30.0,
    ) -> None:
        self._base_url = (
            base_url or os.environ.get("LLMGW_URL", "http://localhost:8100")
        ).rstrip("/")
        self._model = model or os.environ.get("LLMGW_EMBED_MODEL", self.DEFAULT_MODEL)
        self._provider = provider
        self._client = httpx.Client(timeout=timeout)
        self._url = f"{self._base_url}/api/v1/llmgw/embeddings"
        configured = int(os.environ.get("LLMGW_EMBED_DIM", "0") or "0")
        self._dim = configured or self.DEFAULT_DIM

    @property
    def dim(self) -> int:
        return self._dim

    @property
    def model(self) -> str:
        return self._model

    def embed(self, text: str) -> list[float]:
        if not text.strip():
            return [0.0] * self._dim
        resp = self._client.post(
            self._url,
            json={
                "input": [text],
                "model": self._model,
                "provider": self._provider,
                "tenant_id": "default",
            },
        )
        resp.raise_for_status()
        body = resp.json()
        vec = [float(x) for x in body["data"][0]["embedding"]]
        # Self-correct dim if the live model disagrees with the configured default.
        if len(vec) != self._dim:
            _log.warning(
                "LlmgwEmbedder dim override: configured %d, live %d", self._dim, len(vec)
            )
            self._dim = len(vec)
        return vec

    def close(self) -> None:
        self._client.close()


# ============================================================
# Factory
# ============================================================
def create_embedder(provider: str | None = None) -> Embedder:
    """Create embedder by provider name.

    Args:
        provider: "openai" | "llmgw" | "local" | "hash" | None (use EMBEDDER_PROVIDER env, default "local")
    """
    name = (provider or os.environ.get("EMBEDDER_PROVIDER", "local")).lower()
    if name == "openai":
        return OpenAIEmbedder()
    if name == "llmgw":
        return LlmgwEmbedder()
    if name == "local":
        return LocalTinyEmbedder()
    if name == "hash":
        return HashEmbedder()
    raise ValueError(f"Unknown embedder provider: {name}")
