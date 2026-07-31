"""Cross-domain query audit (DATA-D0-D8 D8).

Per ADR-0016 D8: data federation queries that span tenants
(designated as `cross-domain` in the manifest) must emit a
structured audit event. The audit includes the actor, the
target tenants, the query shape (without row-level data), and
the lineage trace.

In v3.1 this is a small surface: a Protocol that the data
federation service implements, plus a default StdoutSink for
the platform's OBS channel. The data federation query path
itself is implemented in the DATA-D8 schema migration (D8
schema work in the next batch).
"""
from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

logger = logging.getLogger("metaplatform.federation")


@dataclass(frozen=True, slots=True)
class CrossDomainQuery:
    """Audit record for one cross-domain federation query.

    Per ADR-0012 + SEC-TENANT-01: every cross-domain query
    names its actor + the target tenants + the query shape so
    the security team can audit per-tenant data exposure.
    """

    actor_user_id: str
    actor_tenant_id: str
    target_tenants: tuple[str, ...]
    query: str
    trace_id: str
    occurred_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    query_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict[str, Any]:
        return {
            "query_id": self.query_id,
            "actor_user_id": self.actor_user_id,
            "actor_tenant_id": self.actor_tenant_id,
            "target_tenants": list(self.target_tenants),
            "query": self.query,
            "trace_id": self.trace_id,
            "occurred_at": self.occurred_at,
        }


class CrossDomainAuditSink(Protocol):
    def emit(self, event: CrossDomainQuery) -> None: ...


class StdoutCrossDomainSink:
    def emit(self, event: CrossDomainQuery) -> None:
        logger.info(
            "audit.cross_domain_query",
            extra=event.to_dict(),
        )


class InMemoryCrossDomainSink:
    def __init__(self) -> None:
        self._events: list[CrossDomainQuery] = []
        self._lock = threading.Lock()

    def emit(self, event: CrossDomainQuery) -> None:
        with self._lock:
            self._events.append(event)

    def all(self) -> list[CrossDomainQuery]:
        with self._lock:
            return list(self._events)


def emit_cross_domain_query(
    *,
    actor_user_id: str,
    actor_tenant_id: str,
    target_tenants: list[str] | tuple[str, ...],
    query: str,
    trace_id: str,
    sink: CrossDomainAuditSink | None = None,
) -> None:
    """Emit a cross-domain query audit event.

    No-op for single-tenant queries (the per-request traces in
    OBS already cover them). The actual federation engine is
    out of scope for this D8 audit helper; only the audit shape
    is provided.
    """
    if len(target_tenants) <= 1:
        return
    event = CrossDomainQuery(
        actor_user_id=actor_user_id,
        actor_tenant_id=actor_tenant_id,
        target_tenants=tuple(target_tenants),
        query=query,
        trace_id=trace_id,
    )
    if sink is None:
        StdoutCrossDomainSink().emit(event)
    else:
        sink.emit(event)
