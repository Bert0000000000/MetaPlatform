"""Warehouse service (mock queries + materialized views)."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.common.errors import InvalidParamError
from app.warehouse.schemas import (
    CreateMaterializedViewRequest,
    LayerInfo,
    MaterializedView,
    QueryColumn,
    QueryHistoryItem,
    QueryRequest,
    QueryResult,
    WarehouseLayer,
    WarehouseTable,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


_LAYER_DESCRIPTIONS = {
    WarehouseLayer.ODS: "Operational Data Store - raw source data",
    WarehouseLayer.DWD: "Data Warehouse Detail - cleaned & conformed",
    WarehouseLayer.DWS: "Data Warehouse Summary - aggregated daily/weekly",
    WarehouseLayer.ADS: "Application Data Service - topic-oriented for apps",
}

_MOCK_TABLES = [
    WarehouseTable(
        name="raw_orders",
        layer=WarehouseLayer.ODS,
        schema="public",
        rowCount=1_000_000,
        lastUpdated=_now(),
    ),
    WarehouseTable(
        name="orders_cleaned",
        layer=WarehouseLayer.DWD,
        schema="dwd",
        rowCount=950_000,
        lastUpdated=_now(),
    ),
    WarehouseTable(
        name="daily_sales_summary",
        layer=WarehouseLayer.DWS,
        schema="dws",
        rowCount=4000,
        lastUpdated=_now(),
    ),
    WarehouseTable(
        name="kpi_dashboard_metrics",
        layer=WarehouseLayer.ADS,
        schema="ads",
        rowCount=300,
        lastUpdated=_now(),
    ),
]


class WarehouseService:
    def __init__(self) -> None:
        self._views: Dict[str, MaterializedView] = {}
        self._history: List[QueryHistoryItem] = []

    async def execute_query(
        self, tenant_id: str, request: QueryRequest
    ) -> QueryResult:
        start = time.time()
        sql_lower = request.sql.lower().strip()
        if not sql_lower.startswith("select"):
            raise InvalidParamError(
                "仅支持 SELECT 查询", data={"sql": request.sql[:50]}
            )

        # Mock result: a single numeric column with a count
        columns = [
            QueryColumn(name="result", type="INTEGER"),
            QueryColumn(name="queried_at", type="TIMESTAMP"),
        ]
        now = _now()
        rows = [[1, now.isoformat()]] * min(request.limit, 3)
        duration = int((time.time() - start) * 1000) + 5

        # Record in history
        self._history.append(
            QueryHistoryItem(
                queryId=f"qh-{uuid.uuid4().hex[:12]}",
                sql=request.sql[:500],
                layer=request.layer,
                rowCount=len(rows),
                durationMs=duration,
                status="success",
                executedAt=_now(),
            )
        )

        return QueryResult(
            columns=columns,
            rows=rows,
            rowCount=len(rows),
            durationMs=duration,
        )

    async def list_query_history(
        self,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Return paginated query execution history."""
        total = len(self._history)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        items = self._history[start_idx:end_idx]
        return {
            "items": [item.model_dump() for item in items],
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    async def list_layers(self) -> List[LayerInfo]:
        result: List[LayerInfo] = []
        for layer in WarehouseLayer:
            count = sum(1 for t in _MOCK_TABLES if t.layer == layer)
            result.append(
                LayerInfo(
                    layer=layer,
                    tableCount=count,
                    description=_LAYER_DESCRIPTIONS[layer],
                )
            )
        return result

    async def list_tables(
        self, layer: WarehouseLayer | None = None
    ) -> List[WarehouseTable]:
        if layer is None:
            return list(_MOCK_TABLES)
        return [t for t in _MOCK_TABLES if t.layer == layer]

    async def create_materialized_view(
        self,
        tenant_id: str,
        request: CreateMaterializedViewRequest,
    ) -> MaterializedView:
        mv = MaterializedView(
            id=f"mv-{uuid.uuid4().hex[:12]}",
            name=request.name,
            layer=request.layer,
            definition=request.definition,
            refreshStrategy=request.refreshStrategy,
            createdAt=_now(),
        )
        self._views[mv.id] = mv
        return mv

    async def list_materialized_views(
        self, tenant_id: str, layer: WarehouseLayer | None = None
    ) -> List[MaterializedView]:
        items = list(self._views.values())
        if layer is not None:
            items = [m for m in items if m.layer == layer]
        return items

    async def refresh_materialized_view(
        self, tenant_id: str, mv_id: str
    ) -> MaterializedView:
        mv = self._views.get(mv_id)
        if mv is None:
            raise InvalidParamError(
                f"物化视图不存在: id={mv_id}", data={"id": mv_id}
            )
        mv = mv.model_copy(update={"lastRefreshedAt": _now()})
        self._views[mv_id] = mv
        return mv