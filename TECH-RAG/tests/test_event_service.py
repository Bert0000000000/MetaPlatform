"""Tests for EventService Outbox pattern (P1-RAG-07)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.models.repository import InMemorySearchEventRepository
from app.models.schemas import SearchEvent
from app.services.event_service import EventService

TENANT = "tenant-test"
TRACE_ID = "trace-evt-001"


# --------------------------------------------------------- publish_event


async def test_publish_event_creates_pending() -> None:
    """publish_event writes a PENDING event to the outbox."""

    repo = InMemorySearchEventRepository()
    service = EventService(repo)

    event = await service.publish_event(
        tenant_id=TENANT,
        event_type="RETRIEVAL_REQUESTED",
        payload={"query": "test", "kbId": "kb-1"},
        headers={"X-Trace-Id": TRACE_ID, "traceId": TRACE_ID},
    )

    assert event.id.startswith("evt-")
    assert event.tenant_id == TENANT
    assert event.event_type == "RETRIEVAL_REQUESTED"
    assert event.status == "PENDING"
    assert event.retry_count == 0

    # Verify it's persisted in the repository.
    events = await repo.list_by_tenant(TENANT)
    assert len(events) == 1
    assert events[0].id == event.id

    # Verify payload and headers are JSON strings.
    payload = json.loads(event.payload)
    assert payload["query"] == "test"
    headers = json.loads(event.headers)
    assert headers["X-Trace-Id"] == TRACE_ID


# --------------------------------------------------------- relay (no-op)


async def test_relay_noop_marks_sent() -> None:
    """Relay in no-op mode (no Kafka producer) marks events as SENT."""

    repo = InMemorySearchEventRepository()
    service = EventService(repo)  # No kafka_producer → no-op mode.

    await service.publish_event(
        tenant_id=TENANT,
        event_type="RETRIEVAL_REQUESTED",
        payload={"query": "test"},
    )
    await service.publish_event(
        tenant_id=TENANT,
        event_type="RETRIEVAL_COMPLETED",
        payload={"resultCount": 5},
    )

    relayed = await service.relay_events()

    assert relayed == 2
    events = await repo.list_by_tenant(TENANT)
    for evt in events:
        assert evt.status == "SENT"
        assert evt.sent_at is not None


# --------------------------------------------------------- relay (Kafka mock)


async def test_relay_with_kafka_producer() -> None:
    """Relay with a mock KafkaProducer sends events to the correct topic."""

    mock_producer = MagicMock()
    mock_producer.send = MagicMock()
    mock_producer.flush = MagicMock()

    repo = InMemorySearchEventRepository()
    service = EventService(repo, kafka_producer=mock_producer)

    await service.publish_event(
        tenant_id=TENANT,
        event_type="RETRIEVAL_REQUESTED",
        payload={"query": "hello", "kbId": "kb-1"},
        headers={"X-Trace-Id": TRACE_ID, "traceId": TRACE_ID},
    )

    relayed = await service.relay_events()

    assert relayed == 1
    # Verify Kafka producer was called with the correct topic.
    assert mock_producer.send.call_count == 1
    call_args = mock_producer.send.call_args
    topic = call_args.args[0]
    assert topic == "metaplatform.Retrieval.RETRIEVAL_REQUESTED"

    # Verify payload bytes.
    value = call_args.kwargs.get("value") or call_args.args[1]
    payload = json.loads(value.decode("utf-8"))
    assert payload["query"] == "hello"

    # Verify X-Trace-Id header is propagated.
    headers = call_args.kwargs.get("headers", [])
    trace_header = [h for h in headers if h[0] == "X-Trace-Id"]
    assert len(trace_header) == 1
    assert trace_header[0][1] == TRACE_ID.encode("utf-8")

    # Event should be marked as SENT.
    events = await repo.list_by_tenant(TENANT)
    assert events[0].status == "SENT"


# --------------------------------------------------------- retry & dead letter


async def test_relay_retry_and_dead_letter() -> None:
    """Events that fail to send are retried; after max_retries they go DEAD."""

    mock_producer = MagicMock()
    mock_producer.send = MagicMock(side_effect=RuntimeError("Kafka unavailable"))
    mock_producer.flush = MagicMock()

    repo = InMemorySearchEventRepository()
    service = EventService(repo, kafka_producer=mock_producer)

    # Publish an event with max_retries=3.
    event = await service.publish_event(
        tenant_id=TENANT,
        event_type="RETRIEVAL_REQUESTED",
        payload={"query": "test"},
    )
    # Manually set max_retries to 3 (default is already 3).
    stored = repo._store[event.id]
    stored.max_retries = 3

    # First relay attempt: fails, retry_count -> 1 (not dead yet, 1 < 3).
    relayed = await service.relay_events()
    assert relayed == 0
    assert repo._store[event.id].status == "PENDING"
    assert repo._store[event.id].retry_count == 1

    # Second relay attempt: fails, retry_count -> 2 (not dead yet, 2 < 3).
    relayed = await service.relay_events()
    assert relayed == 0
    assert repo._store[event.id].status == "PENDING"
    assert repo._store[event.id].retry_count == 2

    # Third relay attempt: fails, retry_count -> 3 >= max_retries -> DEAD.
    relayed = await service.relay_events()
    assert relayed == 0
    assert repo._store[event.id].status == "DEAD"
    assert repo._store[event.id].retry_count == 3


async def test_relay_tenant_scoped() -> None:
    """relay_events(tenant_id=...) only processes that tenant's events."""

    repo = InMemorySearchEventRepository()
    service = EventService(repo)

    await service.publish_event(
        tenant_id="tenant-a",
        event_type="RETRIEVAL_REQUESTED",
        payload={"q": "a"},
    )
    await service.publish_event(
        tenant_id="tenant-b",
        event_type="RETRIEVAL_REQUESTED",
        payload={"q": "b"},
    )

    relayed = await service.relay_events(tenant_id="tenant-a")
    assert relayed == 1

    # tenant-a's event should be SENT, tenant-b's still PENDING.
    events_a = await repo.list_by_tenant("tenant-a")
    events_b = await repo.list_by_tenant("tenant-b")
    assert events_a[0].status == "SENT"
    assert events_b[0].status == "PENDING"
