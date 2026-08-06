"""ObjectSet —— 12 基元之 12。

一次性查询计划（"订单中状态=open 且金额>1000"），编译到 PG/Neo4j/向量。
替代现有 mate-tech-ont/sparql/cypher.py:13-58 的玩具实现。
**一次性**：每次执行产生新 rid，可重放但不可跨请求复用。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..identity.class_ref import ClassRef


@dataclass(frozen=True, slots=True)
class ObjectSet:
    class_rid: ClassRef
    filter_expr: str  # 表达式 DSL，与 Property 类型对应
    sort: tuple[str, ...] = field(default_factory=tuple)
    paging_offset: int = 0
    paging_limit: int = 100
    view_config: str | None = None  # ObjectView rid（可选）

    def __post_init__(self) -> None:
        if self.paging_offset < 0:
            raise ValueError("ObjectSet.paging_offset must be >= 0")
        if not 1 <= self.paging_limit <= 10000:
            raise ValueError("ObjectSet.paging_limit must be in [1, 10000]")
