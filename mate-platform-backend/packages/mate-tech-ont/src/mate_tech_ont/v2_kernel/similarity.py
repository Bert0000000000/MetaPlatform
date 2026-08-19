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

import re
from typing import Any

from .object_search import Embedder, cosine

__all__ = ["search_similar_object_types", "normalize_slug", "suggest_action"]


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

    if embedder is not None:
        candidate_text = f"{candidate_name} {candidate_slug}".strip()
        candidate_vec = embedder.embed(candidate_text)
        for ot in existing:
            parts = ot.rid.rid.split(".")
            # rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，
            # parts[4] 是 slug，parts[3] 是 domain。
            existing_slug = parts[4] if len(parts) >= 6 else (parts[3] if len(parts) >= 4 else "")
            existing_text = f"{ot.display_name} {existing_slug}".strip()
            existing_vec = embedder.embed(existing_text)
            score = cosine(candidate_vec, existing_vec)
            if score <= 0.0:
                continue
            candidates.append({
                "rid": ot.rid.rid,
                "display_name": ot.display_name,
                "slug": existing_slug,
                "similarity": round(score, 4),
                "suggested_action": suggest_action(score),
            })
    else:
        # Fallback：slug 归一化 + 子串
        norm_candidate = normalize_slug(candidate_slug)
        for ot in existing:
            parts = ot.rid.rid.split(".")
            # rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，
            # parts[4] 是 slug，parts[3] 是 domain。
            existing_slug = parts[4] if len(parts) >= 6 else (parts[3] if len(parts) >= 4 else "")
            norm_existing = normalize_slug(existing_slug)
            score = _fallback_score(norm_candidate, norm_existing)
            if score > 0.0:
                candidates.append({
                    "rid": ot.rid.rid,
                    "display_name": ot.display_name,
                    "slug": existing_slug,
                    "similarity": score,
                    "suggested_action": suggest_action(score),
                })

    candidates.sort(key=lambda c: c["similarity"], reverse=True)
    return candidates[:top_k]
