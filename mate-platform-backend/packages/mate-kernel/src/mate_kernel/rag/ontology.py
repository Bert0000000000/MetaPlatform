"""RAG-ONT-01: RAG-on-Ontology —— 本体感知的检索增强生成。

传统 RAG：把文档切片 → 向量索引 → top-k → 喂 LLM。
RAG-on-Ontology：把"对象/属性/链接"作为检索单位 —— 不只是 chunk 文本。
- 索引单元 = (ObjectType, Property, Value) 三元组 + 链接
- 检索 = 先 ObjectSet 过滤（精确）→ 再向量近邻（模糊）
- 喂 LLM 时附带 rid + Property schema，避免幻觉

M2 范围：
- 数据结构：RagIndex / RagChunk / RagHit
- 索引器：add_object → chunk
- 检索器：query(ObjectSet + text) → top-k
- 重排：基于 Property 类型权重（PropertyFormat.STRING > BOOLEAN）

不接外部向量库；M2 用内存 dict（精确相似度 = 1 if token overlap else 0）。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.property_ import PropertyFormat
from mate_kernel.ontology.query.object_set import ObjectSet


# ─────────────────── 数据结构 ───────────────────


@dataclass(frozen=True, slots=True)
class RagChunk:
    """RAG 索引单元 —— 一个属性值（带类型 + 上下文）。"""
    chunk_id: str
    individual_rid: str
    class_rid: str
    property_rid: str
    value_text: str
    property_format: PropertyFormat
    weight: float
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True, slots=True)
class RagHit:
    chunk: RagChunk
    score: float
    matched_terms: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class RagQuery:
    """RAG 查询：ObjectSet 过滤 + 自然语言。"""
    object_set: ObjectSet
    text: str
    top_k: int = 5
    format_weights: dict[PropertyFormat, float] | None = None


# ─────────────────── 索引器 ───────────────────


_FORMAT_BASE_WEIGHT: dict[PropertyFormat, float] = {
    PropertyFormat.STRING: 1.0,
    PropertyFormat.INTEGER: 0.8,
    PropertyFormat.DOUBLE: 0.8,
    PropertyFormat.DATE: 0.6,
    PropertyFormat.TIMESTAMP: 0.6,
    PropertyFormat.BOOLEAN: 0.3,
    PropertyFormat.MARKING: 0.4,
}


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[\w一-鿿]+", text.lower()))


class RagIndex:
    """RAG 索引 —— 内存版。"""

    def __init__(self) -> None:
        self._chunks: dict[str, RagChunk] = {}

    def add_individual(self, ind: Individual) -> tuple[str, ...]:
        """把 Individual 的每个 prop 加为 chunk。返回 chunk_ids。"""
        ids: list[str] = []
        for k, v in ind.props:
            chunk_id = f"{ind.rid}#{k.rid}"
            weight = _FORMAT_BASE_WEIGHT.get(self._guess_format(v), 1.0)
            chunk = RagChunk(
                chunk_id=chunk_id,
                individual_rid=ind.rid,
                class_rid=ind.class_rid.rid,
                property_rid=k.rid,
                value_text=str(v),
                property_format=self._guess_format(v),
                weight=weight,
            )
            self._chunks[chunk_id] = chunk
            ids.append(chunk_id)
        return tuple(ids)

    def size(self) -> int:
        return len(self._chunks)

    @staticmethod
    def _guess_format(value: object) -> PropertyFormat:
        if isinstance(value, bool):
            return PropertyFormat.BOOLEAN
        if isinstance(value, int):
            return PropertyFormat.INTEGER
        if isinstance(value, float):
            return PropertyFormat.DOUBLE
        return PropertyFormat.STRING


# ─────────────────── 检索器 ───────────────────


class RagRetriever:
    """基于 token overlap 的检索（M2 简化）。"""

    def __init__(self, index: RagIndex) -> None:
        self.index = index

    def retrieve(self, query: RagQuery) -> list[RagHit]:
        tokens = _tokenize(query.text)
        if not tokens:
            return []
        # 按 ObjectSet 过滤 class_rid
        allowed_classes = {query.object_set.class_rid.rid}
        hits: list[RagHit] = []
        for chunk in self.index._chunks.values():
            if chunk.class_rid not in allowed_classes:
                continue
            chunk_tokens = _tokenize(chunk.value_text)
            overlap = tokens & chunk_tokens
            if not overlap:
                continue
            base = len(overlap) / len(tokens)
            score = base * chunk.weight
            hits.append(
                RagHit(
                    chunk=chunk,
                    score=score,
                    matched_terms=tuple(sorted(overlap)),
                )
            )
        hits.sort(key=lambda h: h.score, reverse=True)
        return hits[: query.top_k]


__all__ = [
    "RagChunk",
    "RagHit",
    "RagIndex",
    "RagQuery",
    "RagRetriever",
]
