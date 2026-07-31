"""Cross-tenant data access audit (DATA-D0-D8 D5).

Per ADR-0016 D5: every cross-tenant data access emits a structured
audit event so the security team can review the cross-tenant
traffic. This module is the API surface for that; the actual
ingestion is via the existing OBS channel (PLATFORM-K8S-01 OTel
collector + Loki + Tempo).

Pattern: a normal tenant access (e.g. user in tenant-a reading
their own data) does NOT emit a cross-tenant event. Only the
explicit cross-tenant access paths (admin, ETL, scheduler)
trigger audit.cross_tenant_data_access.
"""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

logger = logging.getLogger("metaplatform.audit")


@dataclass(frozen=True, slots=True)
class CrossTenantDataAccess:
    """Audit event for one cross-tenant data access."""

    actor_user_id: str
    actor_tenant_id: str
    target_tenant_id: str
    operation: str
    dataset: str
    trace_id: str
    occurred_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "actor_user_id": self.actor_user_id,
            "actor_tenant_id": self.actor_tenant_id,
            "target_tenant_id": self.target_tenant_id,
            "operation": self.operation,
            "dataset": self.dataset,
            "trace_id": self.trace_id,
            "occurred_at": self.occurred_at,
        }


class CrossTenantAuditSink(Protocol):
    def emit(self, event: CrossTenantDataAccess) -> None: ...


class StdoutAuditSink:
    """Default audit sink: writes to logger + stdout."""

    def emit(self, event: CrossTenantDataAccess) -> None:
        logger.info("audit.cross_tenant_data_access", extra=event.to_dict())


class InMemoryAuditSink:
    def __init__(self) -> None:
        self._events: list = []
        self._lock = threading.Lock()

    def emit(self, event: CrossTenantDataAccess) -> None:
        with self._lock:
            self._events.append(event)

    def all(self) -> list:
        with self._lock:
            return list(self._events)


def emit_cross_tenant_data_access(
    *,
    actor_user_id: str,
    actor_tenant_id: str,
    target_tenant_id: str,
    operation: str,
    dataset: str,
    trace_id: str,
    sink: CrossTenantAuditSink | None = None,
) -> None:
    """Emit a cross-tenant data access audit event.

    No-op when actor_tenant_id == target_tenant_id (in-tenant
    access is the default path; per-request traces cover it).
    """
    if actor_tenant_id == target_tenant_id:
        return
    event = CrossTenantDataAccess(
        actor_user_id=actor_user_id,
        actor_tenant_id=actor_tenant_id,
        target_tenant_id=target_tenant_id,
        operation=operation,
        dataset=dataset,
        trace_id=trace_id,
    )
    if sink is None:
        StdoutAuditSink().emit(event)
    else:
        sink.emit(event)
