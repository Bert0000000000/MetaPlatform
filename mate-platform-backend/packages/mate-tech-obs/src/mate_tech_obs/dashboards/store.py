"""Custom dashboard configuration store — tenant-scoped in-memory repository.

Each tenant can save named dashboard layouts (widget arrangement,
filters, time-range preferences) via the write endpoints in
``routes.py``. The store follows the same tenant-isolation pattern
as ``alerts.management.AlertRuleStore``: every method takes
``tenant_id`` from the request context and refuses cross-tenant
access.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class DashboardConfig:
    """A tenant-scoped custom dashboard configuration."""

    id: str
    tenant_id: str
    name: str
    config: dict[str, Any]
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class DashboardConfigStore:
    """In-memory tenant-scoped dashboard configuration repository."""

    def __init__(self) -> None:
        self._configs: dict[str, dict[str, DashboardConfig]] = {}
        self._counter: int = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"dash-{self._counter:08d}"

    def _bucket(self, tenant_id: str) -> dict[str, DashboardConfig]:
        bucket = self._configs.get(tenant_id)
        if bucket is None:
            bucket = {}
            self._configs[tenant_id] = bucket
        return bucket

    # ----- reads -----
    def get_dashboard_configs(self, *, tenant_id: str) -> list[DashboardConfig]:
        """Return all dashboard configs for the calling tenant."""
        bucket = self._bucket(tenant_id)
        return sorted(bucket.values(), key=lambda c: c.created_at)

    def get_dashboard_config(self, *, tenant_id: str, config_id: str) -> DashboardConfig | None:
        bucket = self._bucket(tenant_id)
        return bucket.get(config_id)

    # ----- writes -----
    def create_dashboard_config(
        self,
        *,
        tenant_id: str,
        name: str,
        config: dict[str, Any],
    ) -> DashboardConfig:
        if not tenant_id:
            raise ValueError("tenant_id required")
        if not name or not name.strip():
            raise ValueError("name required")
        bucket = self._bucket(tenant_id)
        config_id = self._next_id()
        entry = DashboardConfig(
            id=config_id,
            tenant_id=tenant_id,
            name=name.strip(),
            config=dict(config) if config else {},
        )
        bucket[config_id] = entry
        logger.info(
            "dashboard_config.created",
            config_id=config_id,
            tenant_id=tenant_id,
            name=name,
        )
        return entry

    def update_dashboard_config(
        self,
        *,
        tenant_id: str,
        config_id: str,
        name: str | None = None,
        config: dict[str, Any] | None = None,
    ) -> DashboardConfig:
        bucket = self._bucket(tenant_id)
        existing = bucket.get(config_id)
        if existing is None:
            raise KeyError(config_id)
        new_name = name.strip() if name is not None else existing.name
        if not new_name:
            raise ValueError("name must not be empty")
        new_config = dict(config) if config is not None else dict(existing.config)
        updated = DashboardConfig(
            id=existing.id,
            tenant_id=existing.tenant_id,
            name=new_name,
            config=new_config,
            created_at=existing.created_at,
        )
        bucket[config_id] = updated
        logger.info(
            "dashboard_config.updated",
            config_id=config_id,
            tenant_id=tenant_id,
        )
        return updated

    def reset(self) -> None:
        """Drop all data. Used by tests."""
        self._configs.clear()
        self._counter = 0


__all__ = ["DashboardConfig", "DashboardConfigStore"]
