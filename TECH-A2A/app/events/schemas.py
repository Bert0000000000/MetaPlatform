"""Event schemas for Kafka A2A protocol events (Outbox pattern)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    AGENT_REGISTERED = "AGENT_REGISTERED"
    AGENT_DEREGISTERED = "AGENT_DEREGISTERED"
    AGENT_DELEGATED = "AGENT_DELEGATED"
    TASK_RECEIVED = "TASK_RECEIVED"
    AGENT_COMPLETED = "AGENT_COMPLETED"
    AGENT_FAILED = "AGENT_FAILED"
    TASK_CANCELLED = "TASK_CANCELLED"


class OutboxEvent(BaseModel):
    """An event stored in the outbox pending relay to Kafka."""

    event_id: str
    event_type: EventType
    payload: Dict[str, Any]
    trace_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    relayed: bool = False
    relayed_at: Optional[datetime] = None


def event_to_dict(event: OutboxEvent) -> dict:
    return {
        "eventId": event.event_id,
        "eventType": event.event_type.value,
        "payload": event.payload,
        "traceId": event.trace_id,
        "createdAt": event.created_at,
        "relayed": event.relayed,
        "relayedAt": event.relayed_at,
    }
