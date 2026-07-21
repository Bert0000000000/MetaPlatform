"""Global search service (MVP: in-memory static catalog + deliverables)."""

from __future__ import annotations

from typing import Optional

from app.deliverables.service import DeliverableService
from app.search.schemas import SearchCategory, SearchResult


# Static catalog of platform applications and common ontology/tasks for demo/MVP.
_STATIC_CATALOG: list[SearchResult] = [
    # Applications
    SearchResult(
        category=SearchCategory.APP,
        id="app-dashboard",
        title="工作台",
        description="个人工作台、待办、指标与通知中心",
        link="http://localhost:9001/dashboard",
    ),
    SearchResult(
        category=SearchCategory.APP,
        id="app-superai",
        title="超级 AI",
        description="统一 AI 对话、多模态理解与推理入口",
        link="http://localhost:9301",
    ),
    SearchResult(
        category=SearchCategory.APP,
        id="app-dw",
        title="数字员工",
        description="AI 员工编排、任务委托与执行监控",
        link="http://localhost:9401",
    ),
    SearchResult(
        category=SearchCategory.APP,
        id="app-apphub",
        title="应用中心",
        description="低代码应用构建、审批流与 Agent 编排",
        link="http://localhost:9201",
    ),
    SearchResult(
        category=SearchCategory.APP,
        id="app-ontstudio",
        title="本体论引擎",
        description="Ontology 建模、数据中心与 Action 编排",
        link="http://localhost:9101",
    ),
    SearchResult(
        category=SearchCategory.APP,
        id="app-arch",
        title="架构中心",
        description="企业架构资产、EA 模型与架构治理",
        link="http://localhost:9206",
    ),
    SearchResult(
        category=SearchCategory.APP,
        id="app-mcphub",
        title="MCP 服务中心",
        description="MCP Server/Client 注册、调试与调用",
        link="http://localhost:9501",
    ),
    # Ontology samples
    SearchResult(
        category=SearchCategory.ONTOLOGY,
        id="ont-customer",
        title="客户 (Customer)",
        description="核心实体：客户主数据、画像与关系",
        link="http://localhost:9101/ontology/concepts/ont-customer",
    ),
    SearchResult(
        category=SearchCategory.ONTOLOGY,
        id="ont-order",
        title="订单 (Order)",
        description="核心实体：销售订单、订单行与状态机",
        link="http://localhost:9101/ontology/concepts/ont-order",
    ),
    SearchResult(
        category=SearchCategory.ONTOLOGY,
        id="ont-product",
        title="产品 (Product)",
        description="核心实体：产品主数据、SKU 与分类",
        link="http://localhost:9101/ontology/concepts/ont-product",
    ),
    # Task samples
    SearchResult(
        category=SearchCategory.TASK,
        id="task-reconcile",
        title="每日订单对账",
        description="自动化核对订单与支付渠道差异",
        link="http://localhost:9001/deliverables",
    ),
    SearchResult(
        category=SearchCategory.TASK,
        id="task-churn",
        title="客户流失预测",
        description="基于行为数据预测高风险客户",
        link="http://localhost:9001/deliverables",
    ),
    SearchResult(
        category=SearchCategory.TASK,
        id="task-report",
        title="季度销售报告生成",
        description="汇总多维度销售指标并生成 PDF",
        link="http://localhost:9001/deliverables",
    ),
]


class SearchService:
    """Aggregates search results across static catalog and deliverables."""

    def __init__(self, deliverable_service: Optional[DeliverableService] = None) -> None:
        self._deliverable_service = deliverable_service

    async def search(
        self,
        tenant_id: str,
        keyword: str,
        categories: Optional[list[SearchCategory]] = None,
        limit: int = 20,
    ) -> list[SearchResult]:
        kw = keyword.strip().lower()
        allowed = set(categories) if categories else set(SearchCategory)
        results: list[SearchResult] = []

        # Static catalog search.
        for item in _STATIC_CATALOG:
            if item.category not in allowed:
                continue
            if kw in item.title.lower() or kw in item.description.lower():
                results.append(item)

        # Deliverables as knowledge results.
        if SearchCategory.KNOWLEDGE in allowed and self._deliverable_service is not None:
            items, _ = await self._deliverable_service.list(
                tenant_id, keyword=keyword, page=1, page_size=20
            )
            for d in items:
                if kw in d.title.lower() or (
                    d.description and kw in d.description.lower()
                ):
                    results.append(
                        SearchResult(
                            category=SearchCategory.KNOWLEDGE,
                            id=d.id,
                            title=d.title,
                            description=d.description or f"来自 {d.source}",
                            link="http://localhost:9001/deliverables",
                        )
                    )

        # Simple relevance sort: title match first, then description match.
        def _score(item: SearchResult) -> int:
            title = item.title.lower()
            desc = item.description.lower()
            if kw in title:
                return 2
            if kw in desc:
                return 1
            return 0

        results.sort(key=_score, reverse=True)
        return results[:limit]
