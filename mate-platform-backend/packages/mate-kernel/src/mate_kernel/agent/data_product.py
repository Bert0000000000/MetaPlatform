"""AGENT-DATA-01: Data Product 数字员工。

7+1 中的「Data Product 员工」—— 把 data.* 命名空间下的产物（lineage / catalog / quality 摘要）
与 Ontology ObjectType 双向链接。
- DataProduct：可订阅的"数据产品"（湖仓表 / 物化视图 / 报告）
- LinkedObjectType：双向 link 到 ObjectType
- QualitySummary：质量指标（completeness / freshness / row_count）

M3 范围：内存版索引 + 双向 link 校验；真实 CDC / catalog 在 DATA-D0-D8 Batch 落。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef


class DataProductKind(str, Enum):
    TABLE = "table"
    VIEW = "view"
    MATERIALIZED_VIEW = "materialized_view"
    REPORT = "report"
    STREAM = "stream"


class QualityDimension(str, Enum):
    COMPLETENESS = "completeness"  # 0..1
    FRESHNESS_SECONDS = "freshness_seconds"
    ROW_COUNT = "row_count"
    UNIQUENESS = "uniqueness"      # 0..1


@dataclass(frozen=True, slots=True)
class QualitySummary:
    dimension: QualityDimension
    value: float
    measured_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True, slots=True)
class DataProduct:
    """data.<tenant>.product.<slug>.v<n>"""
    product_rid: str
    name: str
    kind: DataProductKind
    bound_class_rid: ClassRef | None  # 关联 ObjectType（双向 link）
    source_uri: str  # PG / Iceberg / Kafka 等
    quality: tuple[QualitySummary, ...] = ()
    schema_version: str = "v1"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def quality_of(self, dim: QualityDimension) -> QualitySummary | None:
        for q in self.quality:
            if q.dimension == dim:
                return q
        return None


@dataclass(frozen=True, slots=True)
class LineageEdge:
    """上游 → 下游 DataProduct 的依赖边。"""
    upstream_rid: str
    downstream_rid: str
    transform: str  # SQL / pipeline 名


class DataProductAgent:
    """Data Product 数字员工 = 索引 + link 校验 + 质量告警阈值。"""

    def __init__(self) -> None:
        self._products: dict[str, DataProduct] = {}
        self._edges: list[LineageEdge] = []
        # 反向索引：ObjectType → DataProducts
        self._by_class: dict[str, list[str]] = {}

    def register(self, product: DataProduct, manager: Manager) -> None:
        if product.product_rid in self._products:
            raise ValueError(f"data product already registered: {product.product_rid}")
        self._products[product.product_rid] = product
        if product.bound_class_rid is not None:
            self._by_class.setdefault(product.bound_class_rid.rid, []).append(
                product.product_rid
            )
        manager.track(
            kind=__import__("mate_kernel.manager.protocol", fromlist=["ChangeKind"]).ChangeKind.REGISTER_CLASS,
            target_rid=product.product_rid,
            payload={"class": product.bound_class_rid.rid if product.bound_class_rid else None},
        )

    def get(self, product_rid: str) -> DataProduct:
        p = self._products.get(product_rid)
        if p is None:
            raise KeyError(f"data product not found: {product_rid}")
        return p

    def for_class(self, class_rid: ClassRef) -> tuple[DataProduct, ...]:
        rids = self._by_class.get(class_rid.rid, [])
        return tuple(self._products[r] for r in rids)

    def add_lineage(self, edge: LineageEdge) -> None:
        # 校验两端都已注册
        if edge.upstream_rid not in self._products:
            raise KeyError(f"upstream not registered: {edge.upstream_rid}")
        if edge.downstream_rid not in self._products:
            raise KeyError(f"downstream not registered: {edge.downstream_rid}")
        self._edges.append(edge)

    def lineage_upstream(self, product_rid: str) -> tuple[LineageEdge, ...]:
        return tuple(e for e in self._edges if e.downstream_rid == product_rid)

    def lineage_downstream(self, product_rid: str) -> tuple[LineageEdge, ...]:
        return tuple(e for e in self._edges if e.upstream_rid == product_rid)

    def quality_alerts(
        self,
        completeness_min: float = 0.95,
        freshness_max_seconds: float = 3600.0,
    ) -> tuple[DataProduct, ...]:
        """返回质量低于阈值的产品。"""
        alerts: list[DataProduct] = []
        for p in self._products.values():
            ok = True
            comp = p.quality_of(QualityDimension.COMPLETENESS)
            if comp is not None and comp.value < completeness_min:
                ok = False
            fresh = p.quality_of(QualityDimension.FRESHNESS_SECONDS)
            if fresh is not None and fresh.value > freshness_max_seconds:
                ok = False
            if not ok:
                alerts.append(p)
        return tuple(alerts)


__all__ = [
    "DataProduct",
    "DataProductAgent",
    "DataProductKind",
    "LineageEdge",
    "QualityDimension",
    "QualitySummary",
]
