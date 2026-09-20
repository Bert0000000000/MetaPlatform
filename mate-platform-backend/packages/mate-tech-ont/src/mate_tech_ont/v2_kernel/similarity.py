"""MP-DEDUP-01: ObjectType 相似扫描 — precheck 用。

策略：
- 首选：Embedder 算候选向量 + 与同租户现有 ObjectType（display_name + slug）
  实时嵌入算 cosine 相似度。轻量、按需算（不强求预建索引表 —— ObjectType
  数量远小于 Individual，加表代价大于每次扫描）。
- Fallback（embedder 未配置）：slug 归一化（去 ``-`` / ``_``，lowercase）+ 子串
  / 前缀匹配打分。覆盖中文 slug 场景（"客户" / "Customer" 的字符级 cosine 难
  命中，归一化也难；靠 domain / 子串兜底）。

返回结构与 API 对齐::

    [{rid, display_name, slug, similarity, suggested_action}]
    suggested_action ∈ {"merge", "rename", "cancel"}
"""

from __future__ import annotations

import os
import re
import time
from typing import Any

from .object_search import Embedder, cosine

__all__ = ["normalize_slug", "search_similar_object_types", "suggest_action"]


def _embed_budget_s() -> float:
    """precheck 的 embedding 总预算（秒）。超时 → 剩余条目走归一化兜底。

    实测（2026-09-20，doubao-embedding-vision 经 llmgw）：单条 ≈1.6s 且**批量
    不省时**（32 条 50.8s）。全租户 ObjectType 数百个时全量 embed 一次要十来
    分钟——网关 proxy.timeout 直接 502/504，前端 await 永挂。预算制保证
    precheck 响应时间有界；TypeName+slug 稳定，embedder 的文本缓存会把名单
    逐步焐热，跨过冷启动后语义覆盖率自然补全。默认 10s（网关代理超时安全垫）。
    """
    raw = os.environ.get("ONT_PRECHECK_EMBED_BUDGET_S", "10")
    try:
        v = float(raw)
    except ValueError:
        return 10.0
    return v if v > 0 else 10.0


def normalize_slug(slug: str) -> str:
    """归一化 slug：去 ``-`` / ``_`` / 空白，lowercase。

    >>> normalize_slug("customer-order")
    'customerorder'
    >>> normalize_slug("Customer_Order")
    'customerorder'
    """
    return re.sub(r"[\s\-_]+", "", slug).lower()


def suggest_action(similarity: float) -> str:
    """similarity → suggested_action。

    - ≥ 0.9 → ``merge``（高置信度同义，建议直接合并）
    - 0.7~0.9 → ``rename``（相似但可能不同，建议改名）
    - < 0.7 → ``cancel``（不太相关，可忽略）
    """
    if similarity >= 0.9:
        return "merge"
    if similarity >= 0.7:
        return "rename"
    return "cancel"


def _fallback_score(candidate_norm: str, existing_norm: str) -> float:
    """无 embedder 时的相似度估算（基于归一化 slug 子串 / 前缀）。"""
    if not candidate_norm or not existing_norm:
        return 0.0
    if candidate_norm == existing_norm:
        return 1.0
    # 子串包含：候选是已存在的子集 / 超集
    if candidate_norm in existing_norm or existing_norm in candidate_norm:
        return 0.85
    # 前 4 字符相同且长度 ≥ 4 → 拼写相似
    if len(candidate_norm) >= 4 and candidate_norm[:4] == existing_norm[:4]:
        return 0.6
    return 0.0


def search_similar_object_types(
    repo: Any,
    tenant_id: str,
    candidate_name: str,
    candidate_slug: str,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """在 tenant 内找与候选 (name, slug) 相似的现有 ObjectType。

    Args:
        repo: ``PgOntologyRepository`` 或 ``InMemoryOntologyRepository`` 实例。
            需要 ``list_object_types(limit, offset, tenant_id)`` 与可选
            ``_embedder``（实现 ``embed(text) -> list[float]``）。
        tenant_id: 限定到本租户。
        candidate_name: 用户填的 display_name（中文 / 英文皆可）。
        candidate_slug: 用户填的 slug（4 段 rid 第 4 段）。
        top_k: 最多返回 top_k 个候选。

    Returns:
        排序后的 list of {rid, display_name, slug, similarity, suggested_action}。
        列表可能为空（无相似候选）。
    """
    embedder: Embedder | None = getattr(repo, "_embedder", None)
    candidates: list[dict[str, Any]] = []

    # 同租户所有 active ObjectType（archived = FALSE 不直接查，list 已过滤）。
    # 不传 archived 过滤 —— archived 行通常不会再被 precheck 命中（除非用户
    # 故意复用 slug），由 UNIQUE INDEX 兜底。
    existing = repo.list_object_types(limit=10000, offset=0, tenant_id=tenant_id)

    def _slug_of(rid: str) -> str:
        parts = rid.split(".")
        # rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，
        # parts[4] 是 slug，parts[3] 是 domain。
        return parts[4] if len(parts) >= 6 else (parts[3] if len(parts) >= 4 else "")

    existing_texts = [f"{ot.display_name} {_slug_of(ot.rid.rid)}".strip() for ot in existing]
    existing_vecs: list[list[float] | None] = [None] * len(existing)

    if embedder is not None:
        # MP-DEDUP-01 修复（2026-09-20）：曾对每个现有 ObjectType 逐个 embed
        # （N 次串行 llmgw HTTP，实测单条 ≈1.6s），类型数百个时单次 precheck
        # 拖到网关 proxy.timeout（502/504），前端 await 永挂。现在：
        #   1. 有 embed_many 就**分块批量**（缓存命中零网络）；
        #   2. 整个 embed 阶段有**总预算**（ONT_PRECHECK_EMBED_BUDGET_S，默认 25s），
        #      预算尽/异常 → 剩余条目留给归一化兜底（见下方 fallback 合并），
        #      precheck 响应时间有界；
        #   3. embedder 文本级缓存把名单逐步焐热（TypeName+slug 稳定）。
        deadline = time.monotonic() + _embed_budget_s()
        embed_many = getattr(embedder, "embed_many", None)
        candidate_text = f"{candidate_name} {candidate_slug}".strip()
        candidate_vec: list[float] | None = None
        try:
            candidate_vec = embedder.embed(candidate_text)
            if callable(embed_many):
                chunk = 8
                for start in range(0, len(existing_texts), chunk):
                    if time.monotonic() > deadline:
                        break
                    batch = existing_texts[start : start + chunk]
                    vecs = embed_many(batch)
                    for i, v in zip(range(start, start + len(batch)), vecs, strict=True):
                        existing_vecs[i] = v
            else:
                for i, t in enumerate(existing_texts):
                    if time.monotonic() > deadline:
                        break
                    existing_vecs[i] = embedder.embed(t)
        except Exception:  # noqa: BLE001 —— embed 任何失败都不阻塞 precheck
            candidate_vec = None

        if candidate_vec is not None:
            for ot, vec in zip(existing, existing_vecs, strict=True):
                if vec is None:
                    continue
                score = cosine(candidate_vec, vec)
                if score <= 0.0:
                    continue
                candidates.append(
                    {
                        "rid": ot.rid.rid,
                        "display_name": ot.display_name,
                        "slug": _slug_of(ot.rid.rid),
                        "similarity": round(score, 4),
                        "suggested_action": suggest_action(score),
                    }
                )

    # 归一化兜底：无 embedder、embed 预算尽或异常时未覆盖的条目都由它补位
    # （slug 归一化 + 子串 / 前缀打分，零网络成本）。与 embed 候选**合并去重**，
    # 同一 rid 取较高相似度——两路证据互补而不是互斥。
    if candidates:
        covered = {c["rid"] for c in candidates}
    else:
        covered = set()
    norm_candidate = normalize_slug(candidate_slug)
    for idx, ot in enumerate(existing):
        if existing_vecs[idx] is not None:
            continue  # embed 已覆盖
        norm_existing = normalize_slug(_slug_of(ot.rid.rid))
        score = _fallback_score(norm_candidate, norm_existing)
        if score <= 0.0 or ot.rid.rid in covered:
            continue
        candidates.append(
            {
                "rid": ot.rid.rid,
                "display_name": ot.display_name,
                "slug": _slug_of(ot.rid.rid),
                "similarity": round(score, 4),
                "suggested_action": suggest_action(score),
            }
        )

    candidates.sort(key=lambda c: c["similarity"], reverse=True)
    return candidates[:top_k]
