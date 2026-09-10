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

__all__ = ["Embedder", "HashEmbedder", "LlmgwServiceEmbedder",
           "build_card", "build_env_embedder", "cosine"]


class Embedder(Protocol):
    def embed(self, text: str) -> list[float]: ...


class HashEmbedder:
    """确定性离线 embedder（token-bag + hashed projection，L2 归一）。

    dev / 测试用：无外部依赖、可复现；质量低于真实模型（同 tech-rag
    LocalTinyEmbedder 的取舍）。中文按字符 bigram 切分（否则整句单 token，
    与任何 chunk 零重叠）。
    """

    DIM = 384
    _WORD_RE = re.compile(r"[0-9A-Za-z]+", re.UNICODE)
    _CJK_RE = re.compile(r"[㐀-䶿一-鿿豈-﫿]+", re.UNICODE)

    def __init__(self, dim: int = DIM) -> None:
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    @classmethod
    def _tokenize(cls, text: str) -> list[str]:
        tokens = [w.lower() for w in cls._WORD_RE.findall(text)]
        for run in cls._CJK_RE.findall(text):
            if len(run) == 1:
                tokens.append(run)
            else:
                tokens.extend(run[i : i + 2] for i in range(len(run) - 1))
        return tokens

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self._dim
        tokens = self._tokenize(text)
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


class LlmgwServiceEmbedder:
    """B1：llmgw 服务级 embedder（平台 LLM Gateway 唯一通道，D5 决策）。

    认证：Keycloak client_credentials（SERVICE_CLIENT_ID/SECRET）→ Bearer；
    token 缓存并在过期前 60s 自动刷新。请求体 input 为**数组**（llmgw 契约
    与 OpenAI 兼容客户端的差异点），携带 tenant_id。
    维度：首响应后缓存（.dim），需与 ONT_VECTOR_DIM 对齐（建列用）。
    """

    def __init__(self) -> None:
        import httpx

        self._url = os.environ.get(
            "LLMGW_EMBED_URL",
            "http://mate-tech-llmgw:8008/api/v1/llmgw/embeddings")
        self._model = os.environ.get("LLMGW_EMBED_MODEL",
                                     "text-embedding-3-small")
        self._tenant = os.environ.get("LLMGW_EMBED_TENANT", "tenant-default")
        kc = os.environ.get("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
        self._token_url = (
            kc + "/realms/metaplatform/protocol/openid-connect/token")
        self._client_id = os.environ.get("SERVICE_CLIENT_ID",
                                         "metaplatform-backend")
        self._secret = os.environ.get("SERVICE_CLIENT_SECRET", "")
        self._client = httpx.Client(timeout=30.0)
        self._token: str | None = None
        self._token_exp: float = 0.0
        self._dim_value: int | None = None

    @property
    def dim(self) -> int:
        return self._dim_value or int(os.environ.get("OPENAI_EMBED_DIM", "384"))

    def _bearer(self) -> str:
        import time

        if self._token and time.time() < self._token_exp:
            return self._token
        resp = self._client.post(
            self._token_url,
            data={"grant_type": "client_credentials",
                  "client_id": self._client_id,
                  "client_secret": self._secret})
        resp.raise_for_status()
        body = resp.json()
        import time as _t

        self._token = body["access_token"]
        self._token_exp = _t.time() + float(body.get("expires_in", 300)) - 60.0
        return self._token

    def embed(self, text: str) -> list[float]:
        resp = self._client.post(
            self._url,
            headers={"Authorization": f"Bearer {self._bearer()}"},
            json={"input": [text or " "], "model": self._model,
                  "tenant_id": self._tenant})
        resp.raise_for_status()
        body = resp.json()
        dims = body.get("dimensions")
        if isinstance(dims, int):
            self._dim_value = dims
        vec = [float(x) for x in body["data"][0]["embedding"]]
        self._dim_value = len(vec)
        return vec

    def close(self) -> None:
        self._client.close()


def build_env_embedder() -> Embedder | None:
    """优先级：ONT_EMBEDDER=llmgw（平台通道，D5）> hash（离线确定性）> OPENAI_API_KEY 兼容客户端 > None。"""
    mode = os.environ.get("ONT_EMBEDDER", "").lower()
    if mode == "llmgw":
        if not os.environ.get("SERVICE_CLIENT_SECRET"):
            return None
        return LlmgwServiceEmbedder()
    if mode == "hash":
        return HashEmbedder()
    if not os.environ.get("OPENAI_API_KEY"):
        return None
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
