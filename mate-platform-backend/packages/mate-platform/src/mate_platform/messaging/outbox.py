"""Outbox writer + relay.

The Outbox pattern guarantees:
  - The business transaction and the outbox insert are atomic
    (same DB transaction).
  - A relay process picks up unpublished events and ships them to
    Kafka with at-least-once + idempotency key.

In production the outbox table lives in the same database as the
business table; the relay is a separate k8s Deployment with >= 2
replicas and FOR UPDATE SKIP LOCKED to avoid double-ship.

This module defines:
  - OutboxRecord: the row shape (the SQL DDL lives in PLATFORM-EVENT-01
    DDL migration in the same commit).
  - OutboxWriter: a Protocol that any DB backend can implement.
  - InMemoryOutboxWriter: tiny in-memory implementation for tests
    and unit tests that do not exercise real SQL.
  - OutboxRelay: the relay logic that drains the outbox to a
    Producer with at-least-once + tenant assertion.

All paths carry tenant_id (SEC-TENANT-01 hard rule 3).
"""
from __future__ import annotations

import abc
import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

from .events import Event


logger = logging.getLogger(__name__)


class OutboxError(Exception):
    """Raised when an outbox operation cannot complete."""


@dataclass(frozen=True, slots=True)
class OutboxRecord:
    event: Event
    published: bool
    attempts: int
    last_error: str

    @classmethod
    def pending(cls, event: Event) -> "OutboxRecord":
        return cls(event=event, published=False, attempts=0, last_error="")

    def with_attempt(self, error: str) -> "OutboxRecord":
        return type(self)(
            event=self.event,
            published=self.published,
            attempts=self.attempts + 1,
            last_error=error,
        )

    def with_published(self) -> "OutboxRecord":
        return type(self)(
            event=self.event,
            published=True,
            attempts=self.attempts,
            last_error="",
        )


class OutboxWriter(Protocol):
    """A write path for outbox events.

    Implementations must insert the event in the SAME database
    transaction as the business mutation; the in-memory fake here
    is for unit tests only.
    """

    def append(self, event: Event) -> None:
        """Append a new event to the outbox (must be transactional)."""
        ...

    def fetch_pending(self, *, limit: int = 100) -> list[OutboxRecord]:
        """Fetch the oldest pending records."""
        ...

    def mark_published(self, event_id: str) -> None:
        """Mark an event as published (after Kafka ack)."""
        ...

    def mark_attempt_failed(self, event_id: str, error: str) -> None:
        """Record a failed attempt; increments attempts counter."""
        ...


class InMemoryOutboxWriter:
    """Tiny in-memory outbox for tests.

    NOT thread-safe; only for single-threaded unit tests.
    """

    def __init__(self) -> None:
        self._records: dict[str, OutboxRecord] = {}

    def append(self, event: Event) -> None:
        if not event.tenant_id:
            raise OutboxError(
                "event has no tenant_id; refusing (SEC-TENANT-01 hard rule 3)"
            )
        self._records[event.id] = OutboxRecord.pending(event)

    def fetch_pending(self, *, limit: int = 100) -> list[OutboxRecord]:
        pending = [r for r in self._records.values() if not r.published]
        pending.sort(key=lambda r: r.event.occurred_at)
        return pending[:limit]

    def mark_published(self, event_id: str) -> None:
        if event_id not in self._records:
            raise OutboxError(f"event {event_id!r} not in outbox")
        self._records[event_id] = self._records[event_id].with_published()

    def mark_attempt_failed(self, event_id: str, error: str) -> None:
        if event_id not in self._records:
            raise OutboxError(f"event {event_id!r} not in outbox")
        self._records[event_id] = self._records[event_id].with_attempt(error)

    def all_records(self) -> list[OutboxRecord]:
        return list(self._records.values())


class Producer(Protocol):
    """Minimal Producer Protocol that the relay uses."""

    def send(self, *, topic: str, key: str, value: bytes, headers: dict[str, str]) -> None:
        ...


class OutboxRelay:
    """Drain the outbox to a Producer with at-least-once semantics.

    Each pending record is sent; the Producer is responsible for
    returning success/failure. On success, the outbox row is marked
    published. On failure, the attempt counter is incremented; the
    event stays in the outbox for the next relay cycle.

    This implementation is intentionally simple (no concurrency
    control); the production relay uses a worker pool with
    `FOR UPDATE SKIP LOCKED` in SQL.
    """

    def __init__(
        self,
        *,
        outbox: OutboxWriter,
        producer: Producer,
        topic_resolver: "TopicResolver",
        max_attempts: int = 5,
        batch_size: int = 100,
    ) -> None:
        self._outbox = outbox
        self._producer = producer
        self._topics = topic_resolver
        self._max_attempts = max_attempts
        self._batch_size = batch_size

    def drain_once(self) -> int:
        """Send one batch of pending events. Returns the number sent."""
        records = self._outbox.fetch_pending(limit=self._batch_size)
        sent = 0
        for rec in records:
            if rec.attempts >= self._max_attempts:
                # Too many failures; skip (operator should pull DLQ).
                logger.warning(
                    "outbox.relay.skip",
                    extra={"event_id": rec.event.id, "attempts": rec.attempts},
                )
                continue
            topic = self._topics.topic_for(rec.event)
            try:
                self._producer.send(
                    topic=topic,
                    key=rec.event.aggregate_id,
                    value=_serialize_event(rec.event),
                    headers={
                        "tenant_id": rec.event.tenant_id,
                        "event_id": rec.event.id,
                        "event_type": rec.event.type,
                        "trace_id": rec.event.trace_id,
                    },
                )
                self._outbox.mark_published(rec.event.id)
                sent += 1
            except Exception as exc:  # pragma: no cover - exercised in tests
                self._outbox.mark_attempt_failed(rec.event.id, str(exc))
        return sent


class TopicResolver(Protocol):
    """Map an event to its Kafka topic, honouring SEC-TENANT-01 conventions."""

    def topic_for(self, event: Event) -> str:
        ...


class EventTypeTopicResolver:
    """Default resolver: derive domain + event from event.type.

    Format: metaplatform.<domain>.<tenant>.<event>
    """

    def topic_for(self, event: Event) -> str:
        domain, _aggregate, _action = event.type.split(".", 2)
        return f"metaplatform.{domain}.{event.tenant_id}.{event.type}"


def _serialize_event(event: Event) -> bytes:
    """Serialize an event to JSON bytes.

    Production uses Avro with Confluent Schema Registry; this
    implementation emits JSON for simplicity and the in-memory
    producer / tests. The schema-registry round-trip is the
    Producer's responsibility.
    """
    import json

    return json.dumps(event.to_dict(), separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )