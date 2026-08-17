"""MP-SAL-02: 对象语义检索（OAG）—— embedder 与相似度基元。

对象实例级检索通道（spec §4.2 SAL-02）：Individual 属性值 → embedding →
cosine 召回 → 对象卡片（带 rid 可追溯）注入 agent prompt。
检索器复用平台 PG 设施（embedding JSONB + 进程内 cosine，dev 形态；
pgvector halfvec+HNSW 升级路径同 tech-rag kb_chunks v3）。
"""

from __future__ import annotations

import hashlib
import math
import os
import re
from typing import Any, Protocol

__all__ = ["Embedder", "HashEmbedder", "build_card", "build_env_embedder", "cosine"]


class Embedder(Protocol):
    def embed(self, text: str) -> list[float]: ...


class HashEmbedder:
    """确定性离线 embedder（token-bag + hashed projection，L2 归一）。

    dev / 测试用：无外部依赖、可复现；质量低于真实模型（同 tech-rag
    LocalTinyEmbedder 的取舍）。
    """

    DIM = 384
    _TOKEN_RE = re.compile(r"[\w一-鿿]+", re.UNICODE)

    def __init__(self, dim: int = DIM) -> None:
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self._dim
        tokens = [t.lower() for t in self._TOKEN_RE.findall(text) if t]
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


def build_env_embedder() -> Embedder | None:
    """OPENAI_API_KEY 存在时返回 OpenAI 兼容 embedder，否则 None（索引跳过）。"""
    if not os.environ.get("OPENAI_API_KEY"):
        return None
    if os.environ.get("ONT_EMBEDDER", "").lower() == "hash":
        return HashEmbedder()
    return _OpenAICompatEmbedder()


class _OpenAICompatEmbedder:
    """OpenAI /v1/embeddings 兼容客户端（env: OPENAI_BASE_URL / OPENAI_EMBED_MODEL）。"""

    DEFAULT_MODEL = "text-embedding-3-small"

    def __init__(self, timeout: float = 30.0) -> None:
        import httpx

        self._model = os.environ.get("OPENAI_EMBED_MODEL", self.DEFAULT_MODEL)
        base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com").rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        self._url = f"{base}/v1/embeddings"
        self._key = os.environ["OPENAI_API_KEY"]

    @property
    def dim(self) -> int:
        return int(os.environ.get("OPENAI_EMBED_DIM", "1536"))

    def embed(self, text: str) -> list[float]:
        if not text.strip():
            return [0.0] * self.dim
        resp = self._client.post(
            self._url,
            headers={"Authorization": f"Bearer {self._key}"},
            json={"input": text, "model": self._model},
        )
        resp.raise_for_status()
        body: dict[str, Any] = resp.json()
        return [float(x) for x in body["data"][0]["embedding"]]

    def close(self) -> None:
        self._client.close()


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def build_card(
    individual_rid: str,
    class_rid: str,
    matched: list[dict[str, Any]],
) -> dict[str, Any]:
    """matched 属性 → 对象卡片（card_text 带 rid 可追溯）。"""
    score = max((m["score"] for m in matched), default=0.0)
    parts = [f"- {m['value_text']} ({m['property_rid'].rsplit('.', 2)[0].split('.')[-1]})"
             for m in matched]
    card_text = f"{individual_rid}:\n" + "\n".join(parts)
    return {
        "individual_rid": individual_rid,
        "class_rid": class_rid,
        "score": score,
        "matched": matched,
        "card_text": card_text,
    }
