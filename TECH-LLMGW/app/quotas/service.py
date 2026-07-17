"""Quota configuration service: simplified CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.common.errors import InvalidParamError, QuotaNotFoundError
from app.quotas.repository import QuotaRepository
from app.quotas.schemas import QuotaCreateRequest, QuotaRecord, QuotaStatus, QuotaUpdateRequest


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_quota_id() -> str:
    return f"qta-{uuid.uuid4().hex[:12]}"


class QuotaService:
    def __init__(self, repository: QuotaRepository) -> None:
        self._repo = repository

    def create(
        self,
        tenant_id: str,
        request: QuotaCreateRequest,
        *,
        created_by: str = "system",
    ) -> QuotaRecord:
        if self._repo.exists(
            tenant_id,
            request.scope.value,
            request.targetId,
            request.type.value,
        ):
            raise InvalidParamError(
                "配额配置已存在",
                data={
                    "scope": request.scope.value,
                    "targetId": request.targetId,
                    "type": request.type.value,
                },
            )

        record = QuotaRecord(
            quota_id=_make_quota_id(),
            tenant_id=tenant_id,
            name=request.name,
            scope=request.scope,
            target_id=request.targetId,
            type=request.type,
            limit_value=request.limitValue,
            used_value=0,
            alert_threshold=request.alertThreshold,
            enabled=request.enabled,
            reset_window=request.resetWindow,
            created_by=created_by,
            updated_by=created_by,
            created_at=_now(),
            updated_at=_now(),
        )
        return self._repo.insert(record)

    def list(
        self,
        tenant_id: str,
        *,
        scope: Optional[str] = None,
        type_: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        all_items = self._repo.list(tenant_id, scope=scope, type_=type_)
        total = len(all_items)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = all_items[start:end]
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return {
            "items": [self._to_list_item(q) for q in page_items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
        }

    def detail(self, tenant_id: str, quota_id: str) -> QuotaRecord:
        record = self._repo.get(quota_id)
        if record is None or record.tenant_id != tenant_id:
            raise QuotaNotFoundError(
                f"配额配置不存在: quotaId={quota_id}",
                data={"quotaId": quota_id},
            )
        return record

    def update(
        self,
        tenant_id: str,
        quota_id: str,
        request: QuotaUpdateRequest,
        *,
        updated_by: str = "system",
    ) -> QuotaRecord:
        record = self.detail(tenant_id, quota_id)

        if request.name is not None:
            record.name = request.name
        if request.limitValue is not None:
            record.limit_value = request.limitValue
        if request.usedValue is not None:
            record.used_value = request.usedValue
        if request.alertThreshold is not None:
            record.alert_threshold = request.alertThreshold
        if request.enabled is not None:
            record.enabled = request.enabled
        if request.resetWindow is not None:
            record.reset_window = request.resetWindow

        record.updated_by = updated_by
        return self._repo.update(record)

    def delete(self, tenant_id: str, quota_id: str) -> Dict[str, Any]:
        record = self.detail(tenant_id, quota_id)
        self._repo.remove(quota_id)
        return {
            "quotaId": quota_id,
            "deleted": True,
        }

    def _to_list_item(self, record: QuotaRecord) -> Dict[str, Any]:
        remaining = max(0, record.limit_value - record.used_value)
        usage_percent = (
            round(record.used_value * 100 / record.limit_value, 1)
            if record.limit_value > 0
            else 0.0
        )
        return {
            "quotaId": record.quota_id,
            "name": record.name,
            "scope": record.scope.value,
            "scopeId": record.target_id,
            "quotaType": record.type.value,
            "limit": record.limit_value,
            "used": record.used_value,
            "remaining": remaining,
            "usagePercent": usage_percent,
            "resetAt": self._next_reset_at(record),
            "status": QuotaStatus.ACTIVE.value if record.enabled else QuotaStatus.INACTIVE.value,
            "alertThreshold": record.alert_threshold,
            "alertEnabled": record.enabled,
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }

    def to_detail(self, record: QuotaRecord) -> Dict[str, Any]:
        detail = self._to_list_item(record)
        detail["lastAlertAt"] = None
        return detail

    def _next_reset_at(self, record: QuotaRecord) -> Optional[datetime]:
        # Simplified reset window: daily/monthly based on quota type.
        now = _now()
        if "DAILY" in record.type.value:
            from datetime import timedelta
            return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        if "MONTHLY" in record.type.value:
            from datetime import timedelta
            if now.month == 12:
                next_month = now.replace(year=now.year + 1, month=1, day=1)
            else:
                next_month = now.replace(month=now.month + 1, day=1)
            return next_month.replace(hour=0, minute=0, second=0, microsecond=0)
        return None
