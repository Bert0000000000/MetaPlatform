"""Kafka consumer with idempotency + retry + DLQ.

IdempotentConsumer wraps a raw Kafka consumer + a Redis dedup store
(SET NX with 24h TTL). For each delivered message:
  1. Parse the event envelope.
  2. Check Redis dedup key. If it exists, skip (already processed).
  3. Otherwise, call the user-supplied handler. If the handler
     raises, schedule a retry. After max_retries, write to DLQ.
  4. On success or DLQ, set the dedup key so the message is never
     processed again (within the TTL).

The handler runs in the consumer's tenant context (via
`assert_message_tenant` from SEC-TENANT-01).
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Callable, Protocol

from mate_platform.messaging.events import Event
from mate_clients.redis import k
from mate_platform.tenancy.context import RequestContext
from mate_platform.tenancy.guards import require_tenant
from mate_platform.messaging.kafka_tenant import assert_message_tenant, topic_name


logger = logging.getLogger(__name__)


class ConsumerError(Exception):
    """Raised when a consumer cannot proceed."""


class DlqEntry:
    """An entry written to the DLQ topic after max retries."""

    def __init__(self, original_topic: str, key: str, value: bytes, headers: dict[str, str], error: str) -> None:
        self.original_topic = original_topic
        self.key = key
        self.value = value
        self.headers = dict(headers)
        self.error = error

    def dlq_topic(self) -> str:
        return f"{self.original_topic}.dlq"


Handler = Callable[[Event, RequestContext], None]


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_attempts: int = 5
    """Total attempts before the event goes to the DLQ."""
    base_delay_seconds: float = 1.0
    """Base for exponential backoff (1s, 5s, 30s, 2min, 10min)."""
    backoff_factor: float = 5.0


DEFAULT_RETRY = RetryPolicy()


class UnderlyingConsumer(Protocol):
    """The actual Kafka consumer client."""

    def poll(self, timeout_seconds: float) -> list[Message]: ...
    def commit(self, offsets: dict[tuple[str, int], int]) -> None: ...


@dataclass(frozen=True, slots=True)
class Message:
    topic: str
    partition: int
    offset: int
    key: bytes
    value: bytes
    headers: dict[str, str]


class DedupStore(Protocol):
    """A tiny store interface for the idempotency dedup key."""

    def is_processed(self, key: str) -> bool: ...
    def mark_processed(self, key: str, ttl_seconds: int = 86400) -> None: ...


class RedisDedupStore:
    """Dedup store backed by Redis SET NX with TTL (reuses the
    tenant-prefixed key builder from SEC-TENANT-01).
    """

    def __init__(self, client: "Any") -> None:
        self._client = client

    def is_processed(self, key: str) -> bool:
        return self._client.exists(key) > 0

    def mark_processed(self, key: str, ttl_seconds: int = 86400) -> None:
        self._client.set(key, "1", ex=ttl_seconds, nx=True)


class InMemoryDedupStore:
    """Tiny in-memory dedup for tests."""

    def __init__(self) -> None:
        self._seen: set[str] = set()

    def is_processed(self, key: str) -> bool:
        return key in self._seen

    def mark_processed(self, key: str, ttl_seconds: int = 86400) -> None:
        self._seen.add(key)


class DlqPublisher(Protocol):
    """Publishes a failed event to the DLQ topic."""

    def publish(self, entry: DlqEntry) -> None: ...


class InMemoryDlq:
    """In-memory DLQ for tests."""

    def __init__(self) -> None:
        self.entries: list[DlqEntry] = []

    def publish(self, entry: DlqEntry) -> None:
        self.entries.append(entry)


class IdempotentConsumer:
    """High-level consumer with idempotency + retry + DLQ.

    The handler is called once per unique (tenant_id, event_id) pair.
    Repeated deliveries of the same event within the dedup TTL are
    silently skipped. Failures are retried with exponential backoff
    up to `retry.max_attempts`; the next attempt reaches the DLQ.
    """

    def __init__(
        self,
        *,
        dedup: DedupStore,
        dlq: DlqPublisher,
        ctx: RequestContext,
        retry: RetryPolicy = DEFAULT_RETRY,
    ) -> None:
        self._dedup = dedup
        self._dlq = dlq
        self._ctx = ctx
        self._retry = retry
        # In-memory retry counter keyed by event_id (process-local).
        # Production equivalent is an SQL outbox column or a separate
        # retry topic per attempt.
        self._attempts: dict[str, int] = {}

    def dedup_key(self, event: Event) -> str:
        require_tenant(self._ctx)
        return k(self._ctx, "dedup", event.id)

    def process(self, message: Message) -> ProcessOutcome:
        """Process a single message; return the outcome."""
        event = _deserialize_event(message)
        # SEC-TENANT-01: refuse cross-tenant messages in non-admin mode.
        assert_message_tenant(expected_tenant=event.tenant_id, ctx=self._ctx)

        dk = self.dedup_key(event)
        if self._dedup.is_processed(dk):
            return ProcessOutcome.DEDUPED

        try:
            handler(event, self._ctx)
        except Exception as exc:  # noqa: BLE001
            attempts = self._attempts.get(event.id, 0) + 1
            self._attempts[event.id] = attempts
            if attempts >= self._retry.max_attempts:
                self._dlq.publish(
                    DlqEntry(
                        original_topic=message.topic,
                        key=message.key.decode("utf-8", errors="replace"),
                        value=message.value,
                        headers=message.headers,
                        error=str(exc),
                    )
                )
                self._dedup.mark_processed(dk)
                return ProcessOutcome.DLQ
            return ProcessOutcome.RETRY

        self._dedup.mark_processed(dk)
        return ProcessOutcome.OK


class ProcessOutcome:
    OK = "ok"
    DEDUPED = "deduped"
    RETRY = "retry"
    DLQ = "dlq"


# Module-level handler slot; we register the actual handler in `bind`.
_handler: Handler | None = None


def bind(handler: Handler) -> None:
    """Set the user-supplied business handler for messages.

    Pattern: `bind(my_handler)` then `IdempotentConsumer.process(msg)`.
    In a more sophisticated design the handler would be a method
    on the consumer; the module-level slot is enough for the
    PLATFORM-EVENT-01 surface and keeps the contract testable.
    """
    global _handler
    _handler = handler


def handler(event: Event, ctx: RequestContext) -> None:
    if _handler is None:
        raise ConsumerError("no handler bound; call bind(handler) first")
    _handler(event, ctx)


def _deserialize_event(message: Message) -> Event:
    try:
        data = json.loads(message.value)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ConsumerError(f"message body is not valid JSON: {exc}") from exc
    try:
        return Event.from_dict(data)
    except (KeyError, TypeError) as exc:
        raise ConsumerError(f"event envelope is malformed: {exc}") from exc