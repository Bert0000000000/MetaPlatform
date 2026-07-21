"""Deliverable service (in-memory implementation aligned with other DATA modules)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from threading import RLock
from typing import Optional

from app.common.errors import InvalidParamError
from app.deliverables.schemas import (
    DeliverableDownloadResponse,
    DeliverableFormat,
    DeliverableInfo,
    DeliverableListItem,
    DeliverableStatus,
    DeliverableType,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"dlv-{uuid.uuid4().hex[:12]}"


class DeliverableService:
    """Service for managing deliverables per tenant."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[str, DeliverableInfo] = {}

    def seed_defaults(self, tenant_id: str) -> None:
        """Populate a few sample deliverables for demo/empty-state."""

        samples = [
            {
                "type": DeliverableType.REPORT,
                "title": "2026 Q2 销售分析报告",
                "source": "数据仓库 / sales_warehouse",
                "description": "按区域、产品线汇总 Q2 销售额与环比增长率。",
                "format": DeliverableFormat.PDF,
                "status": DeliverableStatus.READY,
                "size": 1024 * 128,
                "created_by": "system",
            },
            {
                "type": DeliverableType.ANALYSIS,
                "title": "客户流失风险模型结果",
                "source": "AI Agent / customer_churn_agent",
                "description": "基于近 90 天行为数据预测的高风险客户列表。",
                "format": DeliverableFormat.JSON,
                "status": DeliverableStatus.READY,
                "size": 1024 * 32,
                "created_by": "system",
            },
            {
                "type": DeliverableType.TASK_OUTPUT,
                "title": "每日订单对账任务产出",
                "source": "ETL / daily_order_reconcile",
                "description": "昨日订单与支付渠道对账差异明细。",
                "format": DeliverableFormat.MARKDOWN,
                "status": DeliverableStatus.GENERATING,
                "size": 1024 * 16,
                "created_by": "system",
            },
        ]
        for fields in samples:
            item = DeliverableInfo(
                id=_new_id(),
                tenant_id=tenant_id,
                type=fields["type"],
                title=fields["title"],
                source=fields["source"],
                description=fields["description"],
                format=fields["format"],
                status=fields["status"],
                size=fields["size"],
                created_by=fields["created_by"],
                created_at=_now(),
                updated_at=_now(),
                download_url=None,
            )
            self._store[item.id] = item

    async def create(
        self,
        tenant_id: str,
        *,
        type: DeliverableType,
        title: str,
        source: str,
        description: Optional[str] = None,
        format: DeliverableFormat,
        status: DeliverableStatus = DeliverableStatus.READY,
        size: int = 0,
        created_by: str,
        download_url: Optional[str] = None,
    ) -> DeliverableInfo:
        if not title:
            raise InvalidParamError("title 不能为空", data={"field": "title"})
        now = _now()
        item = DeliverableInfo(
            id=_new_id(),
            tenant_id=tenant_id,
            type=type,
            title=title,
            source=source,
            description=description,
            format=format,
            status=status,
            size=size,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            download_url=download_url,
        )
        with self._lock:
            self._store[item.id] = item
        return item

    async def get(self, tenant_id: str, deliverable_id: str) -> DeliverableInfo:
        with self._lock:
            item = self._store.get(deliverable_id)
        if item is None or item.tenant_id != tenant_id:
            raise InvalidParamError(f"交付物不存在: id={deliverable_id}")
        return item

    async def list(
        self,
        tenant_id: str,
        *,
        keyword: Optional[str] = None,
        type: Optional[DeliverableType] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DeliverableInfo], int]:
        with self._lock:
            items = [
                item
                for item in self._store.values()
                if item.tenant_id == tenant_id
                and (type is None or item.type == type)
                and (
                    not keyword
                    or keyword.lower() in item.title.lower()
                    or (item.description and keyword.lower() in item.description.lower())
                    or keyword.lower() in item.source.lower()
                )
            ]
        items.sort(key=lambda i: i.created_at, reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    async def delete(self, tenant_id: str, deliverable_id: str) -> bool:
        with self._lock:
            item = self._store.get(deliverable_id)
            if item is None or item.tenant_id != tenant_id:
                return False
            del self._store[deliverable_id]
            return True

    async def download(
        self,
        tenant_id: str,
        deliverable_id: str,
        format: DeliverableFormat,
    ) -> DeliverableDownloadResponse:
        item = await self.get(tenant_id, deliverable_id)
        if item.status != DeliverableStatus.READY:
            raise InvalidParamError(
                "交付物未就绪，无法下载",
                data={"id": deliverable_id, "status": item.status.value},
            )
        url = item.download_url or f"/api/v1/data/deliverables/{deliverable_id}/content?format={format.value}"
        return DeliverableDownloadResponse(
            download_url=url,
            message=f"已生成 {format.value.upper()} 下载链接",
        )


def _to_list_item(item: DeliverableInfo) -> DeliverableListItem:
    return DeliverableListItem(
        id=item.id,
        type=item.type,
        title=item.title,
        source=item.source,
        description=item.description,
        format=item.format,
        status=item.status,
        size=item.size,
        createdBy=item.created_by,
        createdAt=item.created_at,
        downloadUrl=item.download_url,
    )
