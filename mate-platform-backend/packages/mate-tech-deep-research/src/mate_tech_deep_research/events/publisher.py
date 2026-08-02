"""Outbox publisher for Deep Research events.

ADR-0014 step 3: every successful mutation emits an outbox event in
the SAME transaction as the business write. For this agent the
"business write" is the delegation to DeerFlow; the event records
what was researched and how long it took.

Event type follows the ``<domain>.<aggregate>.<action>`` convention
required by ``Event.create`` and the EventTypeTopicResolver.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from mate_platform.messaging.events import Event

if TYPE_CHECKING:
    from mate_platform.messaging.outbox import OutboxWriter
    from mate_platform.tenancy.context import RequestContext

EVENT_TYPE = "deep.research.completed"


def publish_research_completed(
    *,
    outbox: OutboxWriter | None,
    ctx: RequestContext | None,
    query: str,
    report_size: int,
    sources_count: int,
    duration_ms: int,
) -> Event | None:
    """Append a ``deep.research.completed`` event to the outbox.

    Returns the constructed Event (or ``None`` if no outbox was
    configured, e.g. in dry-run mode). Raises ``TenantAccessError`` /
    ``ValueError`` if the context lacks a tenant_id — the outbox
    pattern requires tenant binding (hard rule 3).
    """
    if outbox is None:
        return None
    if ctx is None or not ctx.tenant_id:
        # Delegate to Event.create which will raise ValueError; we
        # surface a clearer message first.
        raise ValueError(
            "publish_research_completed requires a tenant-bound context "
            "(SEC-TENANT-01 hard rule 3)"
        )

    payload: dict[str, Any] = {
        "query": query,
        "report_size": report_size,
        "sources_count": sources_count,
        "duration_ms": duration_ms,
    }
    event = Event.create(
        type=EVENT_TYPE,
        tenant_id=str(ctx.tenant_id),
        aggregate_id=f"deep-research-{ctx.tenant_id}",
        payload=payload,
        trace_id=getattr(ctx, "trace_id", "") or "",
    )
    outbox.append(event)
    return event
