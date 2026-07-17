"""Cost report service: aggregates UsageRepository data into reports."""

from __future__ import annotations

import csv
import io
import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.cost.repository import UsageRepository
from app.cost.schemas import (
    CostByCategory,
    CostSummary,
    ExportFormat,
    TimeInterval,
    TimeSeriesPoint,
    TimeSeriesResponse,
    UsageRecord,
)


class CostReportService:
    def __init__(self, repository: UsageRepository) -> None:
        self._repo = repository

    # ------------------------------------------------------- ingestion

    def record(self, record: UsageRecord) -> UsageRecord:
        return self._repo.insert(record)

    def seed(self, records: List[UsageRecord]) -> int:
        """Bulk insert records (for tests / dev seeding)."""
        return self._repo.insert_many(records)

    # ------------------------------------------------------- summary

    def get_summary(
        self,
        tenant_id: str,
        start_time: Optional[datetime],
        end_time: Optional[datetime],
    ) -> CostSummary:
        records = self._repo.list(tenant_id, start_time=start_time, end_time=end_time)
        total_cost = sum(r.cost for r in records)
        total_tokens = sum(r.total_tokens for r in records)
        breakdown = self._aggregate_by(records, lambda r: r.model_id)
        return CostSummary(
            tenantId=tenant_id,
            startTime=start_time or (min((r.timestamp for r in records), default=datetime.min)),
            endTime=end_time or (max((r.timestamp for r in records), default=datetime.max)),
            totalCost=round(total_cost, 4),
            totalTokens=total_tokens,
            requestCount=len(records),
            breakdown=breakdown,
        )

    # ------------------------------------------------------- dimensions

    def get_by_user(
        self,
        tenant_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CostByCategory]:
        records = self._repo.list(tenant_id, start_time=start_time, end_time=end_time)
        return self._aggregate_by(records, lambda r: r.user_id)

    def get_by_application(
        self,
        tenant_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CostByCategory]:
        records = self._repo.list(tenant_id, start_time=start_time, end_time=end_time)
        return self._aggregate_by(records, lambda r: r.application_id or "unassigned")

    def get_by_model(
        self,
        tenant_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CostByCategory]:
        records = self._repo.list(tenant_id, start_time=start_time, end_time=end_time)
        return self._aggregate_by(records, lambda r: r.model_id)

    def get_by_provider(
        self,
        tenant_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CostByCategory]:
        records = self._repo.list(tenant_id, start_time=start_time, end_time=end_time)
        return self._aggregate_by(records, lambda r: r.provider_id)

    # ------------------------------------------------------- time series

    def get_time_series(
        self,
        tenant_id: str,
        start_time: Optional[datetime],
        end_time: Optional[datetime],
        interval: TimeInterval = TimeInterval.DAY,
    ) -> TimeSeriesResponse:
        records = self._repo.list(tenant_id, start_time=start_time, end_time=end_time)
        buckets: Dict[str, List[UsageRecord]] = defaultdict(list)
        for r in records:
            key = self._bucket_key(r.timestamp, interval)
            buckets[key].append(r)

        points: List[TimeSeriesPoint] = []
        for key in sorted(buckets.keys()):
            items = buckets[key]
            cost = sum(r.cost for r in items)
            tokens = sum(r.total_tokens for r in items)
            points.append(
                TimeSeriesPoint(
                    bucket=key,
                    cost=round(cost, 4),
                    tokens=tokens,
                    requestCount=len(items),
                )
            )

        return TimeSeriesResponse(
            tenantId=tenant_id,
            interval=interval.value,
            startTime=start_time or (records[0].timestamp if records else datetime.min),
            endTime=end_time or (records[-1].timestamp if records else datetime.max),
            points=points,
        )

    # ------------------------------------------------------- export

    def export_report(
        self,
        tenant_id: str,
        *,
        format: ExportFormat = ExportFormat.CSV,
        dimension: str = "model",
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        key_fn = {
            "user": lambda r: r.user_id,
            "application": lambda r: r.application_id or "unassigned",
            "model": lambda r: r.model_id,
            "provider": lambda r: r.provider_id,
        }.get(dimension)
        if key_fn is None:
            raise ValueError(f"unsupported dimension: {dimension}")

        records = self._repo.list(tenant_id, start_time=start_time, end_time=end_time)
        breakdown = self._aggregate_by(records, key_fn)

        if format == ExportFormat.JSON:
            content = json.dumps(
                {
                    "tenantId": tenant_id,
                    "dimension": dimension,
                    "items": [b.model_dump() for b in breakdown],
                },
                ensure_ascii=False,
                default=str,
            )
            return {
                "format": "json",
                "filename": f"cost-{dimension}-{tenant_id}.json",
                "contentType": "application/json",
                "content": content,
            }

        # CSV
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["key", "cost", "totalTokens", "requestCount"])
        for item in breakdown:
            writer.writerow([item.key, item.cost, item.totalTokens, item.requestCount])
        return {
            "format": "csv",
            "filename": f"cost-{dimension}-{tenant_id}.csv",
            "contentType": "text/csv",
            "content": buf.getvalue(),
        }

    # ------------------------------------------------------- helpers

    def _aggregate_by(self, records: List[UsageRecord], key_fn) -> List[CostByCategory]:
        buckets: Dict[str, List[UsageRecord]] = defaultdict(list)
        for r in records:
            buckets[key_fn(r)].append(r)
        results: List[CostByCategory] = []
        for key, items in buckets.items():
            results.append(
                CostByCategory(
                    key=key,
                    cost=round(sum(r.cost for r in items), 4),
                    totalTokens=sum(r.total_tokens for r in items),
                    requestCount=len(items),
                )
            )
        results.sort(key=lambda x: x.cost, reverse=True)
        return results

    @staticmethod
    def _bucket_key(ts: datetime, interval: TimeInterval) -> str:
        if interval == TimeInterval.HOUR:
            return ts.strftime("%Y-%m-%dT%H:00:00")
        if interval == TimeInterval.MONTH:
            return ts.strftime("%Y-%m")
        return ts.strftime("%Y-%m-%d")