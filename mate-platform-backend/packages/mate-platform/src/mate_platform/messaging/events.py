"""Event envelope shared by all domains.

The envelope is what gets serialized to Kafka. It is designed to be
forward-compatible: every event has a stable JSON shape regardless of
the underlying domain.

Fields:
  - id: UUID v4 generated at the call site (the business transaction).
  - type: namespaced type, e.g. `iam.user.created` or `order.placed`.
  - tenant_id: enforced by SEC-TENANT-01 isolation.
  - aggregate_id: domain-specific stable id.
  - occurred_at: ISO-8601 timestamp.
  - trace_id: from OTel (so the event links back to the business
    span that produced it; satisfies hard rule 9).
  - payload: the actual business data.

The schema is registered in Confluent Schema Registry under
`metaplatform.<domain>.<event>.v1` so producers cannot publish
without registering a schema first.
"""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any


def new_event_id() -> str:
    """Return a fresh event id (UUID v4)."""
    return str(uuid.uuid4())


@dataclass(frozen=True, slots=True)
class Event:
    id: str
    type: str
    tenant_id: str
    aggregate_id: str
    occurred_at: str
    trace_id: str
    payload: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        *,
        type: str,
        tenant_id: str,
        aggregate_id: str,
        payload: dict[str, Any],
        trace_id: str = "",
        event_id: str | None = None,
        occurred_at: str | None = None,
    ) -> Event:
        """Build an Event with auto-generated id / timestamp.

        `type` should follow the convention `<domain>.<aggregate>.<action>`,
        e.g. `order.placed` or `iam.user.created`.
        """
        if not type or "." not in type:
            raise ValueError(
                f"event type {type!r} must follow '<domain>.<aggregate>.<action>'"
            )
        return cls(
            id=event_id or new_event_id(),
            type=type,
            tenant_id=tenant_id,
            aggregate_id=aggregate_id,
            occurred_at=occurred_at or datetime.now(UTC).isoformat(),
            trace_id=trace_id,
            payload=dict(payload),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Event:
        return cls(
            id=str(data["id"]),
            type=str(data["type"]),
            tenant_id=str(data["tenant_id"]),
            aggregate_id=str(data["aggregate_id"]),
            occurred_at=str(data["occurred_at"]),
            trace_id=str(data.get("trace_id", "")),
            payload=dict(data.get("payload") or {}),
        )
