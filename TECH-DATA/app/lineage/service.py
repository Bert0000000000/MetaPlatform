"""Lineage service (V11-02).

提供数据血缘图查询与影响分析能力。当前实现使用内建的示例血缘图
（覆盖「数据源 → 表 → 字段 → 映射 → 概念/属性 → 实体 → 关系 → Action → 输出」
完整链路），与前端 buildDefaultLineage 默认图保持一致，确保 V1.1
联调阶段前后端可对接。后续 V2.0+ 将接入真实的元数据与血缘采集数据。
"""

from __future__ import annotations

from collections import deque
from typing import Dict, List, Optional, Set

from app.lineage.schemas import (
    DataLineage,
    LineageEdge,
    LineageEdgeKind,
    LineageImpactResult,
    LineageNode,
    LineageNodeMetadata,
    LineageNodeType,
)


def _node(
    nid: str,
    label: str,
    ntype: LineageNodeType,
    *,
    parent_id: Optional[str] = None,
    metadata: Optional[LineageNodeMetadata] = None,
) -> LineageNode:
    return LineageNode(
        id=nid,
        label=label,
        type=ntype,
        parentId=parent_id,
        metadata=metadata,
    )


def _edge(
    eid: str,
    source: str,
    target: str,
    *,
    kind: LineageEdgeKind = LineageEdgeKind.FLOW,
    label: Optional[str] = None,
) -> LineageEdge:
    return LineageEdge(id=eid, source=source, target=target, kind=kind, label=label)


def _build_default_graph() -> DataLineage:
    """构建与前端 buildDefaultLineage 一致的默认血缘图。"""
    nodes: List[LineageNode] = [
        # 数据源层
        _node("ds-crm", "CRM 数据库", LineageNodeType.DATASOURCE,
              metadata=LineageNodeMetadata(sourceType="mysql", status="active")),
        _node("ds-erp", "ERP 数据库", LineageNodeType.DATASOURCE,
              metadata=LineageNodeMetadata(sourceType="postgresql", status="active")),
        _node("ds-api", "外部客户 API", LineageNodeType.DATASOURCE,
              metadata=LineageNodeMetadata(sourceType="api", status="active")),
        # 表层
        _node("tbl-crm-cust", "crm.customer", LineageNodeType.TABLE, parent_id="ds-crm"),
        _node("tbl-crm-cont", "crm.contract", LineageNodeType.TABLE, parent_id="ds-crm"),
        _node("tbl-erp-order", "erp.sales_order", LineageNodeType.TABLE, parent_id="ds-erp"),
        _node("tbl-erp-pay", "erp.payment", LineageNodeType.TABLE, parent_id="ds-erp"),
        # 字段层
        _node("fld-cust-id", "customer_id", LineageNodeType.FIELD, parent_id="tbl-crm-cust"),
        _node("fld-cust-name", "name", LineageNodeType.FIELD, parent_id="tbl-crm-cust"),
        _node("fld-cust-level", "level", LineageNodeType.FIELD, parent_id="tbl-crm-cust"),
        _node("fld-cont-amount", "amount", LineageNodeType.FIELD, parent_id="tbl-crm-cont"),
        _node("fld-order-amt", "total_amount", LineageNodeType.FIELD, parent_id="tbl-erp-order"),
        # 映射层
        _node("map-cust", "客户映射", LineageNodeType.MAPPING,
              metadata=LineageNodeMetadata(schedule="0 */5 * * *", status="active")),
        _node("map-cont", "合同映射", LineageNodeType.MAPPING,
              metadata=LineageNodeMetadata(schedule="0 */10 * * *", status="active")),
        _node("map-order", "订单映射", LineageNodeType.MAPPING,
              metadata=LineageNodeMetadata(schedule="0 */5 * * *", status="active")),
        # 概念层
        _node("concept-customer", "客户", LineageNodeType.CONCEPT),
        _node("concept-contract", "合同", LineageNodeType.CONCEPT),
        _node("concept-order", "订单", LineageNodeType.CONCEPT),
        _node("concept-payment", "回款", LineageNodeType.CONCEPT),
        # 属性层
        _node("attr-cust-id", "customerId", LineageNodeType.ATTRIBUTE, parent_id="concept-customer"),
        _node("attr-cust-name", "name", LineageNodeType.ATTRIBUTE, parent_id="concept-customer"),
        _node("attr-cust-level", "level", LineageNodeType.ATTRIBUTE, parent_id="concept-customer"),
        _node("attr-cont-amt", "amount", LineageNodeType.ATTRIBUTE, parent_id="concept-contract"),
        _node("attr-order-amt", "totalAmount", LineageNodeType.ATTRIBUTE, parent_id="concept-order"),
        # 实体层
        _node("ent-c-001", "北京华夏科技", LineageNodeType.ENTITY),
        _node("ent-ct-001", "2026年度技术服务合同", LineageNodeType.ENTITY),
        _node("ent-o-001", "PO-20260718-001", LineageNodeType.ENTITY),
        # 关系层
        _node("rel-ct-c", "签订方", LineageNodeType.RELATION),
        _node("rel-o-ct", "关联合同", LineageNodeType.RELATION),
        # Action 层
        _node("action-renew-remind", "续签提醒 Action", LineageNodeType.ACTION),
        _node("action-overdue-report", "逾期回款报表 Action", LineageNodeType.ACTION),
        # 输出层
        _node("out-email", "邮件通知", LineageNodeType.OUTPUT),
        _node("out-report", "财务周报", LineageNodeType.OUTPUT),
    ]

    edges: List[LineageEdge] = [
        # 数据源 → 表
        _edge("e1", "ds-crm", "tbl-crm-cust"),
        _edge("e2", "ds-crm", "tbl-crm-cont"),
        _edge("e3", "ds-erp", "tbl-erp-order"),
        _edge("e4", "ds-erp", "tbl-erp-pay"),
        # 表 → 字段
        _edge("e5", "tbl-crm-cust", "fld-cust-id"),
        _edge("e6", "tbl-crm-cust", "fld-cust-name"),
        _edge("e7", "tbl-crm-cust", "fld-cust-level"),
        _edge("e8", "tbl-crm-cont", "fld-cont-amount"),
        _edge("e9", "tbl-erp-order", "fld-order-amt"),
        # 字段 → 映射
        _edge("e10", "fld-cust-id", "map-cust", kind=LineageEdgeKind.MAPPING, label="直接映射"),
        _edge("e11", "fld-cust-name", "map-cust", kind=LineageEdgeKind.MAPPING, label="trim + uppercase"),
        _edge("e12", "fld-cust-level", "map-cust", kind=LineageEdgeKind.MAPPING, label="A/B/C → 优/良/一般"),
        _edge("e13", "fld-cont-amount", "map-cont", kind=LineageEdgeKind.MAPPING, label="数值校验"),
        _edge("e14", "fld-order-amt", "map-order", kind=LineageEdgeKind.MAPPING, label="汇总求和"),
        # 映射 → 概念属性
        _edge("e15", "map-cust", "attr-cust-id"),
        _edge("e16", "map-cust", "attr-cust-name"),
        _edge("e17", "map-cust", "attr-cust-level"),
        _edge("e18", "map-cont", "attr-cont-amt"),
        _edge("e19", "map-order", "attr-order-amt"),
        # 属性 → 实体
        _edge("e20", "attr-cust-id", "ent-c-001", kind=LineageEdgeKind.REFERENCE),
        _edge("e21", "attr-cont-amt", "ent-ct-001", kind=LineageEdgeKind.REFERENCE),
        _edge("e22", "attr-order-amt", "ent-o-001", kind=LineageEdgeKind.REFERENCE),
        # 实体 → 关系
        _edge("e23", "ent-ct-001", "rel-ct-c", kind=LineageEdgeKind.REFERENCE),
        _edge("e24", "ent-c-001", "rel-ct-c", kind=LineageEdgeKind.REFERENCE),
        _edge("e25", "ent-o-001", "rel-o-ct", kind=LineageEdgeKind.REFERENCE),
        _edge("e26", "ent-ct-001", "rel-o-ct", kind=LineageEdgeKind.REFERENCE),
        # 关系/概念 → Action
        _edge("e27", "concept-contract", "action-renew-remind",
              kind=LineageEdgeKind.TRIGGER, label="合同到期前 30 天触发"),
        _edge("e28", "concept-payment", "action-overdue-report",
              kind=LineageEdgeKind.TRIGGER, label="回款逾期 7 天触发"),
        # Action → 输出
        _edge("e29", "action-renew-remind", "out-email"),
        _edge("e30", "action-overdue-report", "out-report"),
    ]

    return DataLineage(nodes=nodes, edges=edges, rootId="ds-crm")


class LineageService:
    """血缘图服务（V1.1 内存实现，V2.0+ 将接入真实元数据）。"""

    def __init__(self) -> None:
        self._graph: DataLineage = _build_default_graph()

    def get_full_graph(self) -> DataLineage:
        """返回完整血缘图。"""
        return self._graph

    def get_lineage(self, scope: str = "all") -> DataLineage:
        """按 scope 过滤血缘图。

        - scope 为空 / "all" / "full" 时返回全图
        - 否则按 label / id / metadata.conceptId 模糊匹配，并 BFS 找出所有上下游关联节点
        """
        graph = self._graph
        lower = (scope or "").lower().strip()
        if not lower or lower in ("all", "full"):
            return graph

        matched = [
            n for n in graph.nodes
            if lower in n.label.lower()
            or lower in n.id.lower()
            or (n.metadata and n.metadata.conceptId and lower in n.metadata.conceptId.lower())
        ]
        if not matched:
            return graph

        matched_ids: Set[str] = {n.id for n in matched}
        related: Set[str] = set(matched_ids)

        # 反向 BFS 找上游
        frontier = list(matched_ids)
        while frontier:
            nxt: List[str] = []
            for nid in frontier:
                for e in graph.edges:
                    if e.target == nid and e.source not in related:
                        related.add(e.source)
                        nxt.append(e.source)
            if not nxt:
                break
            frontier = nxt

        # 正向 BFS 找下游
        frontier = list(matched_ids)
        while frontier:
            nxt = []
            for nid in frontier:
                for e in graph.edges:
                    if e.source == nid and e.target not in related:
                        related.add(e.target)
                        nxt.append(e.target)
            if not nxt:
                break
            frontier = nxt

        nodes = [n for n in graph.nodes if n.id in related]
        edges = [e for e in graph.edges if e.source in related and e.target in related]
        return DataLineage(
            nodes=nodes,
            edges=edges,
            rootId=matched[0].id,
        )

    def get_lineage_by_node(self, node_id: str) -> DataLineage:
        """返回以指定节点为根的子树（含其所有下游节点）。"""
        graph = self._graph
        # 校验节点存在
        if not any(n.id == node_id for n in graph.nodes):
            return DataLineage(nodes=[], edges=[], rootId=None)

        related: Set[str] = {node_id}
        frontier = [node_id]
        while frontier:
            nxt: List[str] = []
            for nid in frontier:
                for e in graph.edges:
                    if e.source == nid and e.target not in related:
                        related.add(e.target)
                        nxt.append(e.target)
            if not nxt:
                break
            frontier = nxt

        nodes = [n for n in graph.nodes if n.id in related]
        edges = [e for e in graph.edges if e.source in related and e.target in related]
        return DataLineage(nodes=nodes, edges=edges, rootId=node_id)

    def analyze_impact(self, node_id: str) -> LineageImpactResult:
        """影响分析：修改某节点后受影响的上下游节点。

        - downstream: 从 node_id 出发正向 BFS 找到的所有节点
        - upstream: 从 node_id 出发反向 BFS 找到的所有节点（不包含 downstream）
        - impactPath: [node_id, ...upstream 前 3 个]
        """
        graph = self._graph
        if not any(n.id == node_id for n in graph.nodes):
            return LineageImpactResult(
                impactedNodes=[node_id],
                upstreamCount=0,
                downstreamCount=0,
                impactPath=[node_id],
            )

        # 正向 BFS 找下游
        downstream: Set[str] = set()
        frontier = [node_id]
        while frontier:
            nxt: List[str] = []
            for nid in frontier:
                for e in graph.edges:
                    if e.source == nid and e.target not in downstream and e.target != node_id:
                        downstream.add(e.target)
                        nxt.append(e.target)
            if not nxt:
                break
            frontier = nxt

        # 反向 BFS 找上游
        upstream: Set[str] = set()
        frontier = [node_id]
        while frontier:
            nxt = []
            for nid in frontier:
                for e in graph.edges:
                    if e.target == nid and e.source not in upstream and e.source not in downstream and e.source != node_id:
                        upstream.add(e.source)
                        nxt.append(e.source)
            if not nxt:
                break
            frontier = nxt

        impacted = [node_id, *downstream]
        impact_path = [node_id, *list(upstream)[:3]]
        return LineageImpactResult(
            impactedNodes=impacted,
            upstreamCount=len(upstream),
            downstreamCount=len(downstream),
            impactPath=impact_path,
        )
