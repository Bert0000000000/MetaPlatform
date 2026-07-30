"""Cross-domain lineage tracking (DATA-D0-D8 D1).

Every outbox event (PLATFORM-EVENT-01) and every CDC event
(Debezium) carries OpenLineage hints and is sent to the Marquez
lineage server (deployed via the marquez sub-chart, see ADR-0016
+ the D0 commit 2ee18610). The lineage graph is partitioned by
tenant_id so a tenant can only see its own data flow.

OpenLineage is the CNCF-incubating standard for data lineage.
The HTTP transport is the simplest fit for our use case: a
single POST /api/v1/lineage with the OpenLineage event JSON.

This module defines:
  - LineageEvent: the OpenLineage-shaped event for our platform
    (job / dataset / run facets with tenant_id + trace_id).
  - LineageEmitter: Protocol that the relay and the CDC consumer
    both implement.
  - InMemoryLineageEmitter: tiny in-memory implementation for tests.
  - LineageConfig: the Marquez endpoint URL + tenant partition key.

Per ADR-0012: every event carries tenant_id. Per PLATFORM-EVENT-01
section 2.4: every event carries trace_id. We extend those to feed
the OpenLineage event's job.namespace (per-tenant) and
run.facets.debugMessage (trace_id) so the Marquez graph is
naturally per-tenant.
"""
from __future__ import annotations

import logging
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol


logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class LineageConfig:
    """Marquez endpoint + tenant partition."""

    marquez_url: str
    namespace_template: str = "metaplatform.<tenant>"

    @classmethod
    def from_env(cls) -> "LineageConfig":
        return cls(
            marquez_url=os.environ.get(
                "MARQUEZ_URL", "http://marquez.metaplatform.svc.cluster.local:5000"
            ),
        )


@dataclass(frozen=True, slots=True)
class LineageEvent:
    """A minimal OpenLineage-shaped event for cross-domain tracking."""

    event_type: str
    tenant_id: str
    aggregate_id: str
    trace_id: str
    occurred_at: str
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    producer: str = "mate-platform.messaging"

    def to_openlineage_dict(self) -> dict[str, Any]:
        return {
            "eventType": "COMPLETE",
            "eventTime": self.occurred_at,
            "producer": self.producer,
            "id": self.event_id,
            "job": {
                "namespace": f"metaplatform.{self.tenant_id}",
                "name": self.event_type,
            },
            "run": {
                "runId": self.event_id,
                "facets": {
                    "debugMessage": f"trace_id={self.trace_id}",
                    "tenant_id": self.tenant_id,
                },
            },
            "inputs": [
                {
                    "namespace": f"metaplatform.{self.tenant_id}",
                    "name": self.aggregate_id,
                }
            ],
            "outputs": [
                {
                    "namespace": f"metaplatform.{self.tenant_id}",
                    "name": f"{self.aggregate_id}.processed",
                }
            ],
        }


class LineageEmitter(Protocol):
    def emit(self, event: LineageEvent) -> None: ...


class InMemoryLineageEmitter:
    def __init__(self) -> None:
        self._events: list[LineageEvent] = []
        self._lock = threading.Lock()

    def emit(self, event: LineageEvent) -> None:
        with self._lock:
            self._events.append(event)

    def all(self) -> list[LineageEvent]:
        with self._lock:
            return list(self._events)


class MarquezHttpLineageEmitter:
    """HTTP-based emitter that POSTs OpenLineage events to Marquez."""

    def __init__(self, config: LineageConfig | None = None) -> None:
        self._config = config or LineageConfig.from_env()

    def emit(self, event: Any) -> None:
        if not event.tenant_id:
            raise ValueError("LineageEvent.tenant_id is required (SEC-TENANT-01)")
        try:
            import httpx
            payload = event.to_openlineage_dict()
            r = httpx.post(
                f"{self._config.marquez_url}/api/v1/lineage",
                json=payload,
                timeout=5.0,
            )
            r.raise_for_status()
        except Exception as exc:
            logger.warning(
                "lineage.emit.failed",
                extra={
                    "marquez_url": self._config.marquez_url,
                    "event_id": getattr(event, "event_id", ""),
                    "error": str(exc),
                },
            )


def lineage_event_from_outbox(
    *,
    event_type: str,
    tenant_id: str,
    aggregate_id: str,
    trace_id: str,
) -> LineageEvent:
    return LineageEvent(
        event_type=event_type,
        tenant_id=tenant_id,
        aggregate_id=aggregate_id,
        trace_id=trace_id,
        occurred_at=datetime.now(UTC).isoformat(),
    )