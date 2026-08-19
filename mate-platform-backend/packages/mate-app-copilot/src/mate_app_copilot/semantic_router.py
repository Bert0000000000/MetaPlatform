"""mate_app_copilot.semantic_router — SuperAI 角色语义路由器（任务2）。

背景
----
当前 SuperAI 路由机制是 LLM FC 单跳：``dispatch_employee`` 是唯一工具，prompt 末尾
拼 ``role`` 列表让 LLM 自选。role 列表越长，LLM 选错概率越高（prompt dilution）。

做法
----
1. 对 ``user_message`` 与每个 role 的 ``capability_tags`` + ``display_name`` + rid
   slug parts 做 embedding → cosine 排序 → ``top_k`` 候选。
2. ``capability_tags`` 与 ``user_message`` 关键词命中加 0.2 权重（substring，简单
   可解释、可观测）。
3. role embedding 启动时一次性算 + TTL 5 min 缓存（hash by role text），避免每轮
   重算。

复杂度：``O(N*D) embedding + O(N log N) sort``，N=role 数（当前 13），D=16/384/1536。
无 LLM 调用、无网络 → 可观测、可 fallback、可单元测试。
"""
from __future__ import annotations

import hashlib
import math
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Protocol


class EmbedderLike(Protocol):
    """Minimal Embedder contract.

    与 ``mate_kernel.ontology.in_memory.InMemoryOntologyRepository._embedder`` 保持
    一致：仅需提供 ``embed(text) -> list[float]``；``dim`` 属性用于调试。
    """

    def embed(self, text: str) -> list[float]: ...
    @property
    def dim(self) -> int: ...


class HashEmbedder:
    """16-dim 离线 hash embedder。

    与 ``mate_tech_rag.embedder.HashEmbedder`` 算法一致；放这里是为了
    ``semantic_router`` 零依赖、确定性、可单元测试。
    """

    DIM = 16
    _TOKEN_RE = re.compile(r"[\w]+", re.UNICODE)

    @property
    def dim(self) -> int:
        return self.DIM

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return [t.lower() for t in HashEmbedder._TOKEN_RE.findall(text) if t]

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self.DIM
        tokens = self._tokenize(text)
        if not tokens:
            return vec
        for tok in tokens:
            h = hashlib.sha256(tok.encode("utf-8")).digest()
            for i in range(4):
                byte = h[i]
                idx = byte % self.DIM
                vec[idx] += 1.0 if (byte & 0x80) else -1.0
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec


@dataclass(frozen=True, slots=True)
class CandidateRole:
    """Top-k 候选角色，供 ``build_system_prompt`` + 前端 trace 使用。"""

    role_slug: str
    role_rid: str
    display_name: str
    capability_tags: tuple[str, ...]
    similarity: float  # 0..1（embedding cosine + 可选 keyword boost）
    reason: str  # "embedding cosine + keyword hit" / "embedding cosine" / ...

    def to_dict(self) -> dict[str, Any]:
        return {
            "role_slug": self.role_slug,
            "role_rid": self.role_rid,
            "display_name": self.display_name,
            "capability_tags": list(self.capability_tags),
            "similarity": self.similarity,
            "reason": self.reason,
        }


@dataclass
class _CachedRoleEmbedding:
    """role embedding 缓存项；按 role_slug key 索引。"""

    role_slug: str
    role_rid: str
    text: str  # 用于检测 capabilities / name 是否变更（失效）
    display_name: str
    capability_tags: tuple[str, ...]
    embedding: list[float]
    timestamp: float


class SemanticRouter:
    """Role pre-screener（线程安全，lock 保护 cache）。"""

    KEYWORD_BOOST = 0.2
    DEFAULT_TOP_K = 3
    DEFAULT_TTL_SECONDS = 300.0

    def __init__(
        self,
        *,
        embedder: EmbedderLike | None = None,
        keyword_boost: float = KEYWORD_BOOST,
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
    ) -> None:
        self._embedder: EmbedderLike = embedder or HashEmbedder()
        self._keyword_boost = float(keyword_boost)
        self._ttl = float(ttl_seconds)
        self._cache: dict[str, _CachedRoleEmbedding] = {}
        self._lock = threading.Lock()

    @property
    def embedder(self) -> EmbedderLike:
        return self._embedder

    def set_embedder(self, embedder: EmbedderLike) -> None:
        """替换 embedder 并清空缓存（新维度，旧向量失效）。"""
        with self._lock:
            self._embedder = embedder
            self._cache.clear()

    def clear_cache(self) -> None:
        """手动清缓存。"""
        with self._lock:
            self._cache.clear()

    def cache_size(self) -> int:
        with self._lock:
            return len(self._cache)

    @staticmethod
    def _build_role_text(role: dict[str, Any]) -> str:
        """拼接 ``capability_tags`` + ``display_name`` + rid slug parts。"""
        parts: list[str] = []
        for cap in role.get("capabilities") or []:
            if isinstance(cap, dict):
                n = cap.get("name")
                if n:
                    parts.append(str(n))
        nm = role.get("name")
        if nm:
            parts.append(str(nm))
        slug = role.get("role")
        if slug:
            parts.append(str(slug))
        rid = str(role.get("rid") or "")
        if rid:
            # rid 形如 ont.acme.cls.employee.v1 → 拆成 token（去 version 段）
            parts.extend(
                p for p in rid.replace("/", ".").split(".")
                if p and not re.fullmatch(r"v\d+", p)
            )
        return " ".join(p for p in parts if p)

    @staticmethod
    def _extract_tags(role: dict[str, Any]) -> tuple[str, ...]:
        tags: list[str] = []
        for cap in role.get("capabilities") or []:
            if isinstance(cap, dict):
                n = cap.get("name")
                if n:
                    tags.append(str(n))
        return tuple(tags)

    def _get_role_embedding(self, role: dict[str, Any]) -> _CachedRoleEmbedding:
        slug = str(role.get("role") or "")
        rid = str(role.get("rid") or slug)
        text = self._build_role_text(role)
        tags = self._extract_tags(role)
        display = str(role.get("name") or slug)
        now = time.monotonic()

        with self._lock:
            cached = self._cache.get(slug)
            if (
                cached is not None
                and cached.text == text
                and (now - cached.timestamp) < self._ttl
            ):
                return cached
            embedding = self._embedder.embed(text) if text else []
            entry = _CachedRoleEmbedding(
                role_slug=slug,
                role_rid=rid,
                text=text,
                display_name=display,
                capability_tags=tags,
                embedding=embedding,
                timestamp=now,
            )
            self._cache[slug] = entry
            return entry

    @staticmethod
    def _cosine(a: list[float], b: list[float]) -> float:
        """Cosine similarity（同维度单位向量 = dot product）。"""
        n = min(len(a), len(b))
        if n == 0:
            return 0.0
        return sum(a[i] * b[i] for i in range(n))

    @staticmethod
    def _keyword_hit(query: str, tags: tuple[str, ...]) -> bool:
        q = query.lower()
        return any(t and t.lower() in q for t in tags)

    def route(
        self,
        user_message: str,
        available_roles: list[dict[str, Any]],
        *,
        top_k: int = DEFAULT_TOP_K,
    ) -> list[CandidateRole]:
        """对 ``user_message`` 与 ``roles`` 计算相似度 + 关键词加权，返回 top_k 候选。

        排序：按相似度降序；空输入返回 ``[]``。
        """
        if not available_roles:
            return []
        if not user_message or not user_message.strip():
            return []

        qvec = self._embedder.embed(user_message)
        candidates: list[CandidateRole] = []
        for role in available_roles:
            entry = self._get_role_embedding(role)
            sim = (
                self._cosine(qvec, entry.embedding)
                if qvec and entry.embedding
                else 0.0
            )
            hit = self._keyword_hit(user_message, entry.capability_tags)
            adjusted = sim + self._keyword_boost if hit else sim
            if hit and sim > 0:
                reason = "embedding cosine + keyword hit"
            elif hit:
                reason = "keyword hit (no cosine signal)"
            else:
                reason = "embedding cosine"
            candidates.append(CandidateRole(
                role_slug=entry.role_slug,
                role_rid=entry.role_rid,
                display_name=entry.display_name,
                capability_tags=entry.capability_tags,
                similarity=float(adjusted),
                reason=reason,
            ))

        candidates.sort(key=lambda c: c.similarity, reverse=True)
        return candidates[: max(0, top_k)]


def semantic_route(
    user_message: str,
    available_roles: list[dict[str, Any]],
    *,
    top_k: int = SemanticRouter.DEFAULT_TOP_K,
    embedder: EmbedderLike | None = None,
    keyword_boost: float = SemanticRouter.KEYWORD_BOOST,
) -> list[CandidateRole]:
    """便捷函数：每次新建 ``SemanticRouter``（适合 stateless 调用 / 一次性脚本）。

    生产路径请直接持有 ``SemanticRouter()`` 实例以享受 5 min 缓存。
    """
    router = SemanticRouter(embedder=embedder, keyword_boost=keyword_boost)
    return router.route(user_message, available_roles, top_k=top_k)


__all__ = [
    "CandidateRole",
    "EmbedderLike",
    "HashEmbedder",
    "SemanticRouter",
    "semantic_route",
]