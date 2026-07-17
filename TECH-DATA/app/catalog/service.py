"""Catalog service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.catalog.schemas import (
    AssetMetadata,
    AssetType,
    ClassificationLevel,
    ColumnProfile,
    DataAsset,
    LineageEdge,
    LineageInfo,
    LineageNode,
    ProfileInfo,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


_SEED_ASSETS: List[DataAsset] = [
    DataAsset(
        id="asset-orders",
        tenantId="tenant-default",
        name="Orders",
        code="orders",
        assetType=AssetType.TABLE,
        layer="dwd",
        classification=ClassificationLevel.CONFIDENTIAL,
        owner="data-team",
        tags=["core", "ecommerce"],
        createdAt=_now(),
        updatedAt=_now(),
    ),
    DataAsset(
        id="asset-customers",
        tenantId="tenant-default",
        name="Customers",
        code="customers",
        assetType=AssetType.TABLE,
        layer="dwd",
        classification=ClassificationLevel.CONFIDENTIAL,
        owner="data-team",
        tags=["core", "crm"],
        createdAt=_now(),
        updatedAt=_now(),
    ),
    DataAsset(
        id="asset-daily-sales",
        tenantId="tenant-default",
        name="Daily Sales Summary",
        code="daily_sales_summary",
        assetType=AssetType.VIEW,
        layer="dws",
        classification=ClassificationLevel.INTERNAL,
        owner="bi-team",
        tags=["kpi"],
        createdAt=_now(),
        updatedAt=_now(),
    ),
]


class CatalogService:
    def __init__(self) -> None:
        self._assets: Dict[str, DataAsset] = {a.id: a for a in _SEED_ASSETS}

    async def list(
        self,
        tenant_id: str,
        *,
        asset_type: Optional[AssetType] = None,
        layer: Optional[str] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        items = [
            a for a in self._assets.values() if a.tenantId == tenant_id
        ]
        if asset_type is not None:
            items = [a for a in items if a.assetType == asset_type]
        if layer is not None:
            items = [a for a in items if a.layer == layer]
        if keyword:
            kw = keyword.lower()
            items = [
                a
                for a in items
                if kw in a.name.lower() or kw in a.code.lower()
                or any(kw in t.lower() for t in a.tags)
            ]
        items.sort(key=lambda a: a.name)
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": [a.model_dump() for a in items[start:end]],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def detail(
        self, tenant_id: str, asset_id: str
    ) -> DataAsset:
        a = self._assets.get(asset_id)
        if a is None or a.tenantId != tenant_id:
            raise LookupError(f"asset not found: {asset_id}")
        return a

    async def metadata(
        self, tenant_id: str, asset_id: str
    ) -> AssetMetadata:
        asset = await self.detail(tenant_id, asset_id)
        return AssetMetadata(
            schema=[
                {"name": "id", "type": "BIGINT", "nullable": False},
                {"name": "name", "type": "VARCHAR", "nullable": True},
                {"name": "created_at", "type": "TIMESTAMP", "nullable": False},
            ],
            partitions=["ds"],
            storageLocation=f"s3://lake/{asset.layer}/{asset.code}/",
            sizeBytes=1024 * 1024 * 12,
            rowCount=10_000,
            format="PARQUET",
            properties={"owner": asset.owner} if asset.owner else {},
        )

    async def lineage(
        self, tenant_id: str, asset_id: str
    ) -> LineageInfo:
        asset = await self.detail(tenant_id, asset_id)
        # Build a tiny mock lineage graph: 1 upstream + 1 downstream
        upstream = [
            LineageNode(id="asset-source-a", name="raw_orders", type="TABLE"),
        ]
        downstream = [
            LineageNode(id="asset-daily-sales", name="daily_sales_summary", type="VIEW"),
        ]
        edges = [
            LineageEdge(source="asset-source-a", target=asset.id, transformation="CLEAN"),
            LineageEdge(source=asset.id, target="asset-daily-sales", transformation="AGG"),
        ]
        return LineageInfo(
            assetId=asset.id,
            upstream=upstream,
            downstream=downstream,
            edges=edges,
        )

    async def profile(
        self, tenant_id: str, asset_id: str
    ) -> ProfileInfo:
        await self.detail(tenant_id, asset_id)
        return ProfileInfo(
            assetId=asset_id,
            rowCount=10_000,
            columnCount=3,
            profiledAt=_now(),
            columns=[
                ColumnProfile(name="id", type="BIGINT", nullCount=0, distinctCount=10_000),
                ColumnProfile(name="name", type="VARCHAR", nullCount=120, distinctCount=8500),
                ColumnProfile(name="created_at", type="TIMESTAMP", nullCount=0, distinctCount=10_000),
            ],
        )

    async def search(
        self,
        tenant_id: str,
        keyword: str,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        return await self.list(
            tenant_id, keyword=keyword, page=page, page_size=page_size
        )