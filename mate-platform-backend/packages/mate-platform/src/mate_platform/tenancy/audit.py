"""Cross-tenant access audit log.

The audit channel is a structured event stream (typically shipped to
Loki via the OTel collector; see PLATFORM-K8S-01). Every cross-tenant
operation must emit exactly one event; the test suite verifies this.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger("metaplatform.audit")


@dataclass(frozen=True, slots=True)
class CrossTenantAccess:
    actor_user_id: str
    actor_client_id: str
    operation: str
    target_tenants: tuple[str, ...]
    statement_summary: str
    timestamp: str


def emit_cross_tenant_access(
    *,
    actor_user_id: str,
    actor_client_id: str,
    operation: str,
    target_tenants: list[str] | tuple[str, ...],
    statement_summary: str = "",
) -> None:
    event = CrossTenantAccess(
        actor_user_id=actor_user_id,
        actor_client_id=actor_client_id,
        operation=operation,
        target_tenants=tuple(target_tenants),
        statement_summary=statement_summary,
        timestamp=datetime.now(UTC).isoformat(),
    )
    logger.info(
        "audit.cross_tenant_access",
        extra={
            "actor_user_id": event.actor_user_id,
            "actor_client_id": event.actor_client_id,
            "operation": event.operation,
            "target_tenants": list(event.target_tenants),
            "statement_summary": event.statement_summary,
            "timestamp": event.timestamp,
        },
    )


def make_target_tenants(*tenants: str) -> tuple[str, ...]:
    return tuple(sorted(set(tenants)))