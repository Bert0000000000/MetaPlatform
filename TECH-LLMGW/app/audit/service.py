"""Audit log service."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.audit.repository import AuditLogRepository
from app.audit.schemas import (
    AuditLogEntry,
    AuditLogStatus,
    ExportFormat,
    LatencyByModel,
    LatencyStats,
)


class AuditLogService:
    def __init__(self, repository: AuditLogRepository) -> None:
        self._repo = repository

    # ------------------------------------------------------- recording

    def record(self, entry: AuditLogEntry) -> AuditLogEntry:
        return self._repo.insert(entry)

    def seed(self, entries: List[AuditLogEntry]) -> int:
        return self._repo.insert_many(entries)

    # ------------------------------------------------------- query

    def query(
        self,
        tenant_id: str,
        *,
        user_id: Optional[str] = None,
        model_id: Optional[str] = None,
        status: Optional[AuditLogStatus] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        all_items = self._repo.list(
            tenant_id,
            user_id=user_id,
            model_id=model_id,
            status=status,
            start_time=start_time,
            end_time=end_time,
            keyword=keyword,
        )
        total = len(all_items)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = all_items[start:end]
        return {
            "items": [self._to_list_item(e) for e in page_items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if page_size else 0,
        }

    def get_detail(self, tenant_id: str, log_id: str) -> Dict[str, Any]:
        entry = self._repo.get(log_id)
        if entry is None or entry.tenant_id != tenant_id:
            raise LookupError(f"audit log not found: {log_id}")
        return self._to_detail(entry)

    def get_errors(
        self,
        tenant_id: str,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        return self.query(
            tenant_id,
            status=AuditLogStatus.ERROR,
            start_time=start_time,
            end_time=end_time,
            page=page,
            page_size=page_size,
        )

    # ------------------------------------------------------- latency

    def get_latency_stats(
        self,
        tenant_id: str,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> LatencyStats:
        items = self._repo.list(
            tenant_id,
            start_time=start_time,
            end_time=end_time,
        )
        latencies = sorted(e.latency_ms for e in items)
        if not latencies:
            return LatencyStats(count=0, p50=0, p95=0, p99=0, min=0, max=0, avg=0)

        return LatencyStats(
            count=len(latencies),
            p50=self._percentile(latencies, 50),
            p95=self._percentile(latencies, 95),
            p99=self._percentile(latencies, 99),
            min=latencies[0],
            max=latencies[-1],
            avg=round(sum(latencies) / len(latencies), 2),
        )

    def get_latency_by_model(
        self,
        tenant_id: str,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[LatencyByModel]:
        items = self._repo.list(
            tenant_id,
            start_time=start_time,
            end_time=end_time,
        )
        buckets: Dict[str, List[int]] = {}
        for entry in items:
            buckets.setdefault(entry.model_id, []).append(entry.latency_ms)
        results: List[LatencyByModel] = []
        for model_id, latencies in buckets.items():
            sorted_lat = sorted(latencies)
            results.append(
                LatencyByModel(
                    modelId=model_id,
                    stats=LatencyStats(
                        count=len(sorted_lat),
                        p50=self._percentile(sorted_lat, 50),
                        p95=self._percentile(sorted_lat, 95),
                        p99=self._percentile(sorted_lat, 99),
                        min=sorted_lat[0],
                        max=sorted_lat[-1],
                        avg=round(sum(sorted_lat) / len(sorted_lat), 2),
                    ),
                )
            )
        results.sort(key=lambda x: x.stats.avg, reverse=True)
        return results

    # ------------------------------------------------------- export

    def export(
        self,
        tenant_id: str,
        *,
        format: ExportFormat = ExportFormat.CSV,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        items = self._repo.list(
            tenant_id, start_time=start_time, end_time=end_time
        )

        if format == ExportFormat.JSON:
            content = json.dumps(
                {
                    "tenantId": tenant_id,
                    "items": [self._to_detail(e) for e in items],
                },
                ensure_ascii=False,
                default=str,
            )
            return {
                "format": "json",
                "filename": f"audit-{tenant_id}.json",
                "contentType": "application/json",
                "content": content,
            }

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "logId",
                "userId",
                "modelId",
                "providerId",
                "status",
                "errorCode",
                "latencyMs",
                "inputTokens",
                "outputTokens",
                "cost",
                "timestamp",
            ]
        )
        for e in items:
            writer.writerow(
                [
                    e.log_id,
                    e.user_id,
                    e.model_id,
                    e.provider_id,
                    e.status.value,
                    e.error_code or "",
                    e.latency_ms,
                    e.input_tokens,
                    e.output_tokens,
                    e.cost,
                    e.timestamp.isoformat(),
                ]
            )
        return {
            "format": "csv",
            "filename": f"audit-{tenant_id}.csv",
            "contentType": "text/csv",
            "content": buf.getvalue(),
        }

    # ------------------------------------------------------- helpers

    @staticmethod
    def _percentile(sorted_values: List[float], percent: float) -> float:
        if not sorted_values:
            return 0.0
        if len(sorted_values) == 1:
            return float(sorted_values[0])
        idx = (percent / 100.0) * (len(sorted_values) - 1)
        lower = int(idx)
        upper = min(lower + 1, len(sorted_values) - 1)
        fraction = idx - lower
        return round(sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * fraction, 2)

    @staticmethod
    def _to_list_item(entry: AuditLogEntry) -> Dict[str, Any]:
        return {
            "logId": entry.log_id,
            "userId": entry.user_id,
            "applicationId": entry.application_id,
            "modelId": entry.model_id,
            "providerId": entry.provider_id,
            "status": entry.status.value,
            "errorCode": entry.error_code,
            "latencyMs": entry.latency_ms,
            "inputTokens": entry.input_tokens,
            "outputTokens": entry.output_tokens,
            "cost": entry.cost,
            "timestamp": entry.timestamp,
        }

    @staticmethod
    def _to_detail(entry: AuditLogEntry) -> Dict[str, Any]:
        item = AuditLogService._to_list_item(entry)
        item["errorMessage"] = entry.error_message
        item["traceId"] = entry.trace_id
        return item