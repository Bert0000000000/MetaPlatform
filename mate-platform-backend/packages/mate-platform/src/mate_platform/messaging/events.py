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
    # Lineage side-car (DATA-D0-D8 D1). Auto-populated by ``Event.create``
    # when the caller does not pass one explicitly. Holds a
    # ``LineageHints`` instance — see ``mate_platform.lineage``.
    lineage_hints: Any | None = None

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
        source_system: str = "mate-platform",
        lineage_hints: Any | None = None,
    ) -> Event:
        """Build an Event with auto-generated id / timestamp.

        `type` should follow the convention `<domain>.<aggregate>.<action>`,
        e.g. `order.placed` or `iam.user.created`.

        Lineage hints (DATA-D0-D8 D1): when ``lineage_hints`` is left as
        ``None`` the factory builds one from the event itself
        (``tenant_id`` + ``trace_id``/correlation + ``source_system``)
        so downstream consumers can chain the event into the lineage
        graph without any extra plumbing. Pass an explicit hints
        object to override (e.g. when forwarding a CDC event whose
        correlation id lives outside the OTel trace).
        """
        if not type or "." not in type:
            raise ValueError(
                f"event type {type!r} must follow '<domain>.<aggregate>.<action>'"
            )
        if not tenant_id:
            raise ValueError(
                "event tenant_id must not be empty (SEC-TENANT-01 hard rule 3)"
            )
        resolved_occurred_at = occurred_at or datetime.now(UTC).isoformat()
        resolved_id = event_id or new_event_id()
        if lineage_hints is None:
            # Lazy import to avoid a hard dependency cycle: the
            # lineage package may import back into messaging via
            # ``build_hints_from_event``.
            from mate_platform.lineage.hints import build_hints_from_event

            lineage_hints = build_hints_from_event(
                Event(
                    id=resolved_id,
                    type=type,
                    tenant_id=tenant_id,
                    aggregate_id=aggregate_id,
                    occurred_at=resolved_occurred_at,
                    trace_id=trace_id,
                    payload=dict(payload),
                ),
                source_system=source_system,
            )
        return cls(
            id=resolved_id,
            type=type,
            tenant_id=tenant_id,
            aggregate_id=aggregate_id,
            occurred_at=resolved_occurred_at,
            trace_id=trace_id,
            payload=dict(payload),
            lineage_hints=lineage_hints,
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Event:
        # lineage_hints round-trip: dict-shaped hints rebuild via the
        # public ctor; the lazy import keeps the optional dep on the
        # lineage package confined to this codepath.
        raw_hints = data.get("lineage_hints")
        rebuilt_hints: Any | None = None
        if raw_hints is not None:
            from mate_platform.lineage.hints import LineageHints

            rebuilt_hints = LineageHints(
                tenant_id=str(raw_hints.get("tenant_id", "")),
                correlation_id=str(raw_hints.get("correlation_id", "")),
                source_system=str(raw_hints.get("source_system", "")),
                target_system=str(raw_hints.get("target_system", "")),
                job_name=str(raw_hints.get("job_name", "")),
                emitted_at=str(raw_hints.get("emitted_at", "")),
            )
        return cls(
            id=str(data["id"]),
            type=str(data["type"]),
            tenant_id=str(data["tenant_id"]),
            aggregate_id=str(data["aggregate_id"]),
            occurred_at=str(data["occurred_at"]),
            trace_id=str(data.get("trace_id", "")),
            payload=dict(data.get("payload") or {}),
            lineage_hints=rebuilt_hints,
        )
