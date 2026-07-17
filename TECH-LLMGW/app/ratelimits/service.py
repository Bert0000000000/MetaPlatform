"""Rate limit configuration service: simplified CRUD + stats + reset."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.common.errors import InvalidParamError, RateLimitNotFoundError
from app.ratelimits.repository import RateLimitRepository
from app.ratelimits.schemas import (
    RateLimitCreateRequest,
    RateLimitRecord,
    RateLimitStatus,
    RateLimitUpdateRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_rate_limit_id() -> str:
    return f"rl-{uuid.uuid4().hex[:12]}"


class RateLimitService:
    def __init__(self, repository: RateLimitRepository) -> None:
        self._repo = repository

    def create(
        self,
        tenant_id: str,
        request: RateLimitCreateRequest,
        *,
        created_by: str = "system",
    ) -> RateLimitRecord:
        if self._repo.exists(
            tenant_id,
            request.scope.value,
            request.targetId,
            request.type.value,
        ):
            raise InvalidParamError(
                "限流规则已存在",
                data={
                    "scope": request.scope.value,
                    "targetId": request.targetId,
                    "type": request.type.value,
                },
            )

        record = RateLimitRecord(
            rate_limit_id=_make_rate_limit_id(),
            tenant_id=tenant_id,
            name=request.name,
            scope=request.scope,
            target_id=request.targetId,
            type=request.type,
            limit_value=request.limitValue,
            window_seconds=request.windowSeconds,
            enabled=request.enabled,
            created_by=created_by,
            updated_by=created_by,
            created_at=_now(),
            updated_at=_now(),
        )
        return self._repo.insert(record)

    def find_enabled_rule(
        self,
        tenant_id: str,
        scope: "RateLimitScope",
        target_id: str,
        type_: "RateLimitType",
    ) -> Optional[RateLimitRecord]:
        """Pick the first enabled rule for ``(scope, target, type)``."""

        from app.ratelimits.schemas import RateLimitScope, RateLimitType

        records = self._repo.list(tenant_id)
        for record in records:
            if (
                record.enabled
                and record.scope == scope
                and record.target_id == target_id
                and record.type == type_
            ):
                return record
        return None

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
            "items": [self._to_list_item(r) for r in page_items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
        }

    def detail(self, tenant_id: str, rate_limit_id: str) -> RateLimitRecord:
        record = self._repo.get(rate_limit_id)
        if record is None or record.tenant_id != tenant_id:
            raise RateLimitNotFoundError(
                f"限流规则不存在: rateLimitId={rate_limit_id}",
                data={"rateLimitId": rate_limit_id},
            )
        return record

    def update(
        self,
        tenant_id: str,
        rate_limit_id: str,
        request: RateLimitUpdateRequest,
        *,
        updated_by: str = "system",
    ) -> RateLimitRecord:
        record = self.detail(tenant_id, rate_limit_id)

        if request.name is not None:
            record.name = request.name
        if request.limitValue is not None:
            record.limit_value = request.limitValue
        if request.windowSeconds is not None:
            record.window_seconds = request.windowSeconds
        if request.enabled is not None:
            record.enabled = request.enabled

        record.updated_by = updated_by
        return self._repo.update(record)

    def delete(self, tenant_id: str, rate_limit_id: str) -> Dict[str, Any]:
        record = self.detail(tenant_id, rate_limit_id)
        self._repo.remove(rate_limit_id)
        return {
            "rateLimitId": rate_limit_id,
            "deleted": True,
        }

    def reset(self, tenant_id: str, rate_limit_id: str) -> Dict[str, Any]:
        record = self.detail(tenant_id, rate_limit_id)
        # In-memory stats reset: record reset timestamp only.
        record.updated_at = _now()
        self._repo.update(record)
        # Clear any in-memory counter held by an associated RateLimitGuard.
        guard = getattr(self, "_guard", None)
        if guard is not None:
            guard.reset()
        return {
            "rateLimitId": rate_limit_id,
            "resetAt": record.updated_at,
            "resetMetrics": ["requests", "tokens"],
        }

    def stats(
        self,
        tenant_id: str,
        rate_limit_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return hit statistics. With in-memory store, returns zeroed placeholders."""
        if rate_limit_id is not None:
            record = self.detail(tenant_id, rate_limit_id)
            return {
                "rateLimitId": record.rate_limit_id,
                "name": record.name,
                "scope": record.scope.value,
                "scopeId": record.target_id,
                "type": record.type.value,
                "limit": record.limit_value,
                "windowSeconds": record.window_seconds,
                "current": 0,
                "remaining": record.limit_value,
                "hitCount": 0,
                "blockedCount": 0,
                "status": RateLimitStatus.ENABLED.value if record.enabled else RateLimitStatus.DISABLED.value,
                "resetAt": None,
            }

        all_items = self._repo.list(tenant_id)
        return {
            "totalRules": len(all_items),
            "activeRules": sum(1 for r in all_items if r.enabled),
            "totalHits": 0,
            "totalBlocked": 0,
            "items": [self._to_list_item(r) for r in all_items],
        }

    def _to_list_item(self, record: RateLimitRecord) -> Dict[str, Any]:
        return {
            "rateLimitId": record.rate_limit_id,
            "name": record.name,
            "scope": record.scope.value,
            "scopeId": record.target_id,
            "type": record.type.value,
            "limit": record.limit_value,
            "windowSeconds": record.window_seconds,
            "current": 0,
            "remaining": record.limit_value,
            "status": RateLimitStatus.ENABLED.value if record.enabled else RateLimitStatus.DISABLED.value,
            "createdAt": record.created_at,
            "updatedAt": record.updated_at,
        }

    def to_detail(self, record: RateLimitRecord) -> Dict[str, Any]:
        detail = self._to_list_item(record)
        detail["createdBy"] = record.created_by
        detail["updatedBy"] = record.updated_by
        return detail
