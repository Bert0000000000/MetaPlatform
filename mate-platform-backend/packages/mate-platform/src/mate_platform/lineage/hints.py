"""Lineage hints: the side-car payload that flows with every event.

Per ADR-0016 §3.1 + §3.2 + production-readiness §13 hard rule 9:
every event carries ``tenant_id`` and ``trace_id`` (we rename
``trace_id`` to ``correlation_id`` here so it reads the same way
the OBS layer names it).

A ``LineageHints`` instance is what gets attached to a domain
event when it crosses a domain boundary (e.g. ``msg`` →
``obs`` → ``dw``). The hints survive all the way to the consumer
side, so the lineage server can stitch the cross-domain chain
together with one stable correlation id.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from mate_platform.messaging.events import Event


@dataclass(frozen=True, slots=True)
class LineageHints:
    """Side-car payload carried by an event for lineage tracing.

    Attributes:
        tenant_id:      The tenant boundary the chain lives in.
                        **Required**, never None (SEC-TENANT-01).
        correlation_id: Stable id that links every node in a single
                        business transaction across domains. Defaults
                        to a fresh UUID v4 if not provided.
        source_system:  The upstream system that emitted the event.
        target_system:  The downstream system that consumes the event.
                        Optional: an event that does not yet know its
                        consumer can leave this empty.
        job_name:       The OpenLineage job name (== event type, e.g.
                        ``iam.user.created``).
        emitted_at:     ISO-8601 timestamp of the hints creation.
    """

    tenant_id: str
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_system: str = ""
    target_system: str = ""
    job_name: str = ""
    emitted_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def __post_init__(self) -> None:
        # Hard rule 3: tenant_id must never be empty.
        if not self.tenant_id:
            raise ValueError(
                "LineageHints.tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        if not self.correlation_id:
            raise ValueError("LineageHints.correlation_id must not be empty")


def build_hints_from_event(
    event: Event,
    *,
    source_system: str,
    target_system: str = "",
) -> LineageHints:
    """Derive a ``LineageHints`` from an outbox ``Event``.

    The correlation id defaults to the event's ``trace_id`` so the
    lineage chain ties back to the OTel trace that produced the
    event. Falls back to a fresh UUID only when trace_id is empty
    (e.g. legacy or non-OTel producers; in v3.0+ every event has
    one).
    """
    correlation = event.trace_id or str(uuid.uuid4())
    return LineageHints(
        tenant_id=event.tenant_id,
        correlation_id=correlation,
        source_system=source_system,
        target_system=target_system,
        job_name=event.type,
        emitted_at=event.occurred_at or datetime.now(UTC).isoformat(),
    )


def default_hints(*, tenant_id: str, job_name: str) -> LineageHints:
    """Return a hints object with the required tenant_id and job_name.

    Useful for tests and for code paths that have not yet received a
    real ``Event`` (e.g. CDC events flowing in from Debezium where the
    correlation id is taken from the Debezium envelope).
    """
    return LineageHints(
        tenant_id=tenant_id,
        job_name=job_name,
    )


def merge_hints(base: LineageHints, **overrides: Any) -> LineageHints:
    """Return a new ``LineageHints`` with the given fields overridden.

    Only fields that are part of ``LineageHints`` are honored; any
    other keyword argument raises ``TypeError`` so callers get an
    early failure instead of silent data loss.
    """
    valid_fields = set(LineageHints.__dataclass_fields__)  # type: ignore[attr-defined]
    for key in overrides:
        if key not in valid_fields:
            raise TypeError(
                f"merge_hints: unknown field {key!r}; "
                f"valid fields are {sorted(valid_fields)}"
            )
    return replace(base, **overrides)
