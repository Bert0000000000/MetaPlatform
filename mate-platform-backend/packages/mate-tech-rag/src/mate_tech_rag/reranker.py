"""Reranker for RAG retrieval results.

对检索结果做二次排序,提高相关性。

Strategies:
1. IdentityReranker — 不重排(透传)
2. KeywordReranker — 关键词匹配加分(query 关键词在 chunk 中的命中频率)
3. LengthReranker — 长度归一化(避免过短/过长 chunk 排名过高)
4. HeuristicCrossEncoderReranker — 启发式 cross-encoder,纯本地零依赖:
     - token 重叠比(CJK bigram friendly)
     - 长度归一(避免噪声 / 刷分)
     - 位置衰减(query token 在 chunk 前 1/3 命中加权更大)
     - BM25-style IDF 近似(候选词在 corpus 里越稀有,权重越高)
   公式:
     score(q,c) = base_sim * pos_factor * length_factor * idf_factor
     base_sim   = |q_tokens ∩ c_tokens| / max(|q_tokens|,1)
     pos_factor = 1 + ALPHA * first_hit_in_first_third
                   (ALPHA = 0.5, first_hit = 命中位置 < len/3)
     length_factor = max(0.6, 1 - 0.5 * abs(len_ratio - 1))
                   (期望 chunk 长度 ≈ query 长度的 1-3x)
     idf_factor = 1 + BETA * avg_idf_in_chunk
                   (BETA = 0.4; 高 IDF 词命中提分)
   取值范围 ≈ [0, ~2.4],与下游 IdentityReranker 兼容。
   当 sentence-transformers 可用且 ``ST_CROSS_ENCODER_MODEL`` 已设置,
   自动切换 ``RealCrossEncoderReranker``(基于 Cross-Encoder 模型打分),
   否则 fallback 到 HeuristicCrossEncoderReranker,实现优雅降级。

环境变量:
  RERANK_BATCH_SIZE         int, 批量重排大小(默认 32)。仅对真实模型生效;
                            HeuristicCrossEncoderReranker 走纯 Python 无此约束。
  ST_CROSS_ENCODER_MODEL    str, 启用真 sentence-transformers cross-encoder 的模型名;
                            未设置或加载失败 → fallback heuristic。
"""
from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass
from typing import Protocol

from mate_tech_rag.tokenize import tokenize_for_match


def _get_rerank_batch_size(default: int = 32) -> int:
    """Resolve RERANK_BATCH_SIZE from env (int; fallback default)."""
    raw = os.environ.get("RERANK_BATCH_SIZE", str(default)).strip()
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return default
    return n if n > 0 else default


@dataclass
class RerankCandidate:
    chunk_id: str
    text: str
    score: float
    metadata: dict[str, str] | None = None


class Reranker(Protocol):
    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]: ...


class IdentityReranker:
    """不重排,仅按原始 score 降序截断 top_k。"""

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]


class KeywordReranker:
    """关键词匹配加分:query 中的关键词在 chunk text 中出现则加分。

    Tokenization is CJK-aware (see ``mate_tech_rag.tokenize``): Chinese runs
    are matched via character bigrams, so this reranker actually boosts
    Chinese chunks that share terms with the query instead of degrading to a
    constant scale (which is what naive whitespace splitting produces).
    """

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        query_terms = tokenize_for_match(query)
        for c in candidates:
            text_terms = tokenize_for_match(c.text)
            overlap = len(query_terms & text_terms)
            c.score = c.score * 0.7 + (overlap / max(len(query_terms), 1)) * 0.3
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]


class LengthReranker:
    """长度归一化:chunk 过短(<50字)或过长(>2000字)降分。"""

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        for c in candidates:
            length = len(c.text)
            if length < 50:
                c.score *= 0.8
            elif length > 2000:
                c.score *= 0.9
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]


class HeuristicCrossEncoderReranker:
    """启发式 cross-encoder: 纯本地零依赖的"近似 cross-encoder"。

    综合四个信号打分(全部走 ``tokenize_for_match`` → CJK 大小写安全):

    1. **base_sim** — token 重叠比: ``|q ∩ c| / max(|q|, 1)``
       度量 query 中多少 token 命中 chunk,是最直接的语义重合信号。

    2. **pos_factor** — 位置衰减: 命中越靠前权重越大(用户 query 的核心
       实体多在 chunk 前 1/3)。命中位置 = 第一个 query token 出现在 chunk
       的字符索引 / chunk 长度。

    3. **length_factor** — 长度归一: 期望 chunk 长度 ≈ query 长度的 1-3x。
       极短噪声(<1x) 与 极长(>3x) 都降分,避免过短刷分 / 过长稀释命中。

    4. **idf_factor** — BM25-style IDF 近似: 候选 token 在 corpus 中越稀有,
       命中时权重越高(避免 "的/是/了" 这类停用词撑高分)。
       ``idf(t) = log((N + 1) / (df(t) + 0.5)) + 1``;N = 候选总数。

    最终: ``score = base_sim * pos_factor * length_factor * idf_factor``,
    范围约 ``[0, ~2.4]``。与上游 ``IdentityReranker`` 的 ``c.score`` 接口兼容
    —— 我们**覆写** ``c.score`` 为新值(标准 reranker 契约)。
    """

    POS_ALPHA = 0.5  # 前 1/3 命中加权
    LEN_TOLERANCE = 0.5  # 长度容忍度
    IDF_BETA = 0.4  # IDF 强度

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        if not candidates:
            return []
        query_terms = tokenize_for_match(query)
        if not query_terms:
            # 空 query → 不重排,直接截断
            return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]
        # 一次性预算 IDF: 统计每个 term 在 corpus 中的 df
        df: dict[str, int] = {}
        term_sets: list[set[str]] = []
        for c in candidates:
            terms = tokenize_for_match(c.text)
            term_sets.append(terms)
            for t in terms:
                df[t] = df.get(t, 0) + 1
        n = len(candidates)
        idf_table: dict[str, float] = {
            t: math.log((n + 1) / (df_t + 0.5)) + 1.0
            for t, df_t in df.items()
        }
        query_len = max(len(query), 1)
        for c, terms in zip(candidates, term_sets):
            overlap = query_terms & terms
            base_sim = len(overlap) / max(len(query_terms), 1)
            if base_sim == 0:
                # 0 重叠 → 维持低分,不强制 0(保留原 score 一点点)
                c.score = c.score * 0.5
                continue
            # 位置衰减:第一个命中在 chunk 中的相对位置
            pos_factor = self._pos_factor(query_terms, c.text)
            # 长度归一
            length_factor = self._length_factor(len(c.text), query_len)
            # IDF 加权:命中 query token 的平均 IDF
            avg_idf = (
                sum(idf_table.get(t, 1.0) for t in overlap) / len(overlap)
            )
            idf_factor = 1.0 + self.IDF_BETA * (avg_idf - 1.0)
            cross_score = base_sim * pos_factor * length_factor * idf_factor
            # 与原始 retrieval score 融合:0.6 reranker + 0.4 原始
            c.score = c.score * 0.4 + cross_score * 0.6
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]

    @classmethod
    def _pos_factor(cls, query_terms: set[str], text: str) -> float:
        """位置衰减:首个命中在前 1/3 → 加权,否则保持 1.0。"""
        if not text:
            return 1.0
        lower = text.lower()
        first = len(text)
        for t in query_terms:
            idx = lower.find(t.lower())
            if idx >= 0 and idx < first:
                first = idx
        if first >= len(text):
            return 1.0
        third = max(len(text) // 3, 1)
        if first <= third:
            return 1.0 + cls.POS_ALPHA
        return 1.0

    @classmethod
    def _length_factor(cls, chunk_len: int, query_len: int) -> float:
        """长度归一:最优 chunk ≈ query 1-3x。"""
        if query_len == 0:
            return 1.0
        ratio = chunk_len / query_len
        if ratio < 0.1 or ratio > 30:
            return 0.6
        # 越偏离 1.0 越低;偏离 0 → 1.0,偏离 1+tol → 1-tol
        if ratio >= 1.0:
            return max(0.6, 1.0 - cls.LEN_TOLERANCE * min((ratio - 1.0) / 2.0, 1.0))
        return max(0.6, ratio)


# ---------------------------------------------------------------------------
# Opt-in: real sentence-transformers CrossEncoder
# ---------------------------------------------------------------------------
def _try_sentence_transformers(model_name: str | None) -> "RealCrossEncoderReranker | None":
    """Best-effort load a sentence-transformers Cross-Encoder.

    Returns ``None`` (silent fallback to HeuristicCrossEncoderReranker) when:
      * ``model_name`` is falsy (opt-in via ``ST_CROSS_ENCODER_MODEL`` env),
      * ``sentence_transformers`` import fails (not installed),
      * model load / inference fails (network down, bad model id, etc.).

    This is intentional: we want the reranker factory to never raise at
    request time, even in environments without sentence-transformers.
    """
    if not model_name:
        return None
    try:
        # Local import keeps the dependency soft (production may not install it).
        from sentence_transformers import CrossEncoder  # type: ignore
    except Exception:
        return None
    try:
        model = CrossEncoder(model_name)
    except Exception:
        return None
    return RealCrossEncoderReranker(model)


class RealCrossEncoderReranker:
    """Thin wrapper around ``sentence_transformers.CrossEncoder``.

    Loaded only when ``ST_CROSS_ENCODER_MODEL`` env is set AND the
    sentence-transformers package is installed AND the model loads.
    ``RERANK_BATCH_SIZE`` controls ``model.predict`` batching (default 32).
    """

    def __init__(self, model: object) -> None:
        self._model = model
        self._batch_size = _get_rerank_batch_size()

    def rerank(
        self, query: str, candidates: list[RerankCandidate], top_k: int = 10
    ) -> list[RerankCandidate]:
        if not candidates:
            return []
        pairs = [(query, c.text) for c in candidates]
        try:
            scores = self._model.predict(  # type: ignore[attr-defined]
                pairs, batch_size=self._batch_size, show_progress_bar=False,
            )
        except Exception:
            # Last-resort safety net: keep the reranker non-fatal.
            return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]
        for c, s in zip(candidates, scores):
            c.score = float(s)
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]


def create_reranker(strategy: str = "identity") -> Reranker:
    """Factory for Reranker strategies.

    Recognised strategies:
      - ``identity``                → IdentityReranker
      - ``keyword``                 → KeywordReranker
      - ``length``                  → LengthReranker
      - ``heuristic_cross``         → HeuristicCrossEncoderReranker (zero-dep)
      - ``cross_encoder``           → alias of ``heuristic_cross``
                                      (intentional: we never silently load a
                                       model the env did not opt into).
      - ``real_cross_encoder``      → RealCrossEncoderReranker if
                                      ``ST_CROSS_ENCODER_MODEL`` is set +
                                      sentence-transformers available;
                                      otherwise graceful fallback to
                                      HeuristicCrossEncoderReranker.

    Unknown / empty strings fall back to ``IdentityReranker``.
    """
    if strategy in ("keyword",):
        return KeywordReranker()
    if strategy in ("length",):
        return LengthReranker()
    if strategy in ("heuristic_cross", "cross_encoder"):
        return HeuristicCrossEncoderReranker()
    if strategy == "real_cross_encoder":
        model_name = os.environ.get("ST_CROSS_ENCODER_MODEL", "").strip() or None
        real = _try_sentence_transformers(model_name)
        if real is not None:
            return real
        # Graceful fallback: heuristic keeps the request non-fatal.
        return HeuristicCrossEncoderReranker()
    return IdentityReranker()