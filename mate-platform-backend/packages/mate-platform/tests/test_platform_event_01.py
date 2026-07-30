"""PLATFORM-EVENT-01 test suite.

Tests cover:
  - Event envelope creation, validation, round-trip.
  - Schema registry: in-memory registration + lookup.
  - Outbox writer: tenant_id required, append / fetch_pending /
    mark_published / mark_attempt_failed.
  - Outbox relay: drain sends to producer, marks published.
  - IdempotentConsumer: dedup, retry, DLQ paths.
  - Cross-tenant negative cases.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import pytest

# Make mate_platform / mate_clients importable from the source tree.
REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_clients.kafka import (
    ConsumerError,
    DlqEntry,
    IdempotentConsumer,
    InMemoryDedupStore,
    InMemoryDlq,
    Message,
    ProcessOutcome,
    RetryPolicy,
    bind,
)
from mate_platform.messaging import (
    Event,
    EventTypeTopicResolver,
    InMemoryOutboxWriter,
    InMemorySchemaRegistry,
    OutboxError,
    OutboxRelay,
    OutboxWriter,
    SchemaError,
    SchemaRegistry,
    new_event_id,
    schema_id_for,
    validate_event_type,
)
from mate_platform.tenancy import (
    AuthMethod,
    RequestContext,
    TenantId,
    UserId,
)


# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------
def make_ctx(
    *,
    tenant: str = "t1",
    user: str = "u1",
    roles: frozenset[str] = frozenset(),
    method: AuthMethod = AuthMethod.SERVICE,
) -> RequestContext:
    return RequestContext(
        request_id="r1",
        trace_id="trace-1",
        tenant_id=TenantId(tenant),
        user_id=UserId(user),
        roles=roles,
        permissions=frozenset(),
        client_id="metaplatform-backend",
        auth_method=method,
    )


def make_event(
    *,
    tenant: str = "t1",
    type: str = "iam.user.created",
    aggregate: str = "user-1",
    payload: dict[str, Any] | None = None,
    event_id: str | None = None,
) -> Event:
    return Event.create(
        type=type,
        tenant_id=tenant,
        aggregate_id=aggregate,
        payload=payload or {"name": "alice"},
        event_id=event_id,
    )


# -----------------------------------------------------------------------------
# Event envelope
# -----------------------------------------------------------------------------
class TestEvent:
    def test_create_generates_id_and_timestamp(self) -> None:
        e = make_event()
        assert e.id
        assert e.occurred_at
        assert e.tenant_id == "t1"

    def test_invalid_type_rejected(self) -> None:
        with pytest.raises(ValueError, match="event type"):
            Event.create(
                type="badtype",
                tenant_id="t1",
                aggregate_id="x",
                payload={},
            )

    def test_round_trip(self) -> None:
        e = make_event(payload={"a": 1, "b": "two"})
        d = e.to_dict()
        e2 = Event.from_dict(d)
        assert e2 == e

    def test_new_event_id_unique(self) -> None:
        ids = {new_event_id() for _ in range(100)}
        assert len(ids) == 100


# -----------------------------------------------------------------------------
# Schema registry
# -----------------------------------------------------------------------------
class TestSchemaRegistry:
    def test_validate_event_type_ok(self) -> None:
        validate_event_type("order.placed.created")

    def test_validate_event_type_rejects_short(self) -> None:
        with pytest.raises(SchemaError, match="invalid event type"):
            validate_event_type("bad")

    def test_validate_event_type_rejects_uppercase(self) -> None:
        with pytest.raises(SchemaError, match="invalid event type"):
            validate_event_type("Order.placed")

    def test_schema_id_for(self) -> None:
        assert schema_id_for("order.placed.created") == (
            "metaplatform.order.placed.created.v1"
        )

    def test_in_memory_registry(self) -> None:
        reg: SchemaRegistry = InMemorySchemaRegistry()
        sid = reg.register(
            "iam.user.created", {"type": "object", "properties": {}}
        )
        assert sid == "metaplatform.iam.user.created.v1"
        schema = reg.fetch(sid)
        assert schema["type"] == "object"


# -----------------------------------------------------------------------------
# Outbox writer
# -----------------------------------------------------------------------------
class TestOutboxWriter:
    def test_append_requires_tenant(self) -> None:
        ob: OutboxWriter = InMemoryOutboxWriter()
        e = Event.create(
            type="iam.user.created",
            tenant_id="",
            aggregate_id="u",
            payload={},
        )
        with pytest.raises(OutboxError, match="no tenant_id"):
            ob.append(e)

    def test_append_and_fetch(self) -> None:
        ob: OutboxWriter = InMemoryOutboxWriter()
        e1 = make_event(event_id="e1")
        e2 = make_event(event_id="e2", aggregate="user-2")
        ob.append(e1)
        ob.append(e2)
        pending = ob.fetch_pending()
        assert len(pending) == 2
        assert {r.event.id for r in pending} == {"e1", "e2"}

    def test_mark_published(self) -> None:
        ob: OutboxWriter = InMemoryOutboxWriter()
        e = make_event(event_id="e1")
        ob.append(e)
        ob.mark_published("e1")
        assert ob.fetch_pending() == []

    def test_mark_attempt_failed_increments(self) -> None:
        ob: InMemoryOutboxWriter = InMemoryOutboxWriter()
        e = make_event(event_id="e1")
        ob.append(e)
        ob.mark_attempt_failed("e1", "boom")
        rec = ob.all_records()[0]
        assert rec.attempts == 1
        assert rec.last_error == "boom"

    def test_mark_published_unknown_raises(self) -> None:
        ob: InMemoryOutboxWriter = InMemoryOutboxWriter()
        with pytest.raises(OutboxError, match="not in outbox"):
            ob.mark_published("missing")


# -----------------------------------------------------------------------------
# Outbox relay
# -----------------------------------------------------------------------------
class FakeProducer:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.fail: bool = False

    def send(self, *, topic: str, key: str, value: bytes, headers: dict[str, str]) -> None:
        if self.fail:
            raise RuntimeError("simulated kafka failure")
        self.sent.append(
            {"topic": topic, "key": key, "value": value, "headers": dict(headers)}
        )


class TestOutboxRelay:
    def test_drain_once_sends_pending(self) -> None:
        ob: InMemoryOutboxWriter = InMemoryOutboxWriter()
        prod = FakeProducer()
        ob.append(make_event(event_id="e1"))
        ob.append(make_event(event_id="e2"))
        relay = OutboxRelay(outbox=ob, producer=prod, topic_resolver=EventTypeTopicResolver())
        sent = relay.drain_once()
        assert sent == 2
        assert len(prod.sent) == 2
        assert ob.fetch_pending() == []

    def test_drain_once_failure_keeps_pending(self) -> None:
        ob: InMemoryOutboxWriter = InMemoryOutboxWriter()
        prod = FakeProducer()
        prod.fail = True
        ob.append(make_event(event_id="e1"))
        relay = OutboxRelay(outbox=ob, producer=prod, topic_resolver=EventTypeTopicResolver())
        sent = relay.drain_once()
        assert sent == 0
        assert len(ob.fetch_pending()) == 1
        rec = ob.all_records()[0]
        assert rec.attempts == 1
        assert rec.last_error == "simulated kafka failure"

    def test_drain_once_skips_max_attempts(self) -> None:
        ob: InMemoryOutboxWriter = InMemoryOutboxWriter()
        prod = FakeProducer()
        for _ in range(6):
            ob.mark_attempt_failed if False else None
        # Simulate that the event has been attempted 5 times already
        e = make_event(event_id="e1")
        ob.append(e)
        for _ in range(5):
            ob.mark_attempt_failed("e1", "boom")
        relay = OutboxRelay(
            outbox=ob,
            producer=prod,
            topic_resolver=EventTypeTopicResolver(),
            max_attempts=5,
        )
        sent = relay.drain_once()
        assert sent == 0
        assert len(ob.fetch_pending()) == 1
        assert prod.sent == []

    def test_topic_resolver_format(self) -> None:
        e = make_event(tenant="acme", type="order.placed.created")
        topic = EventTypeTopicResolver().topic_for(e)
        assert topic == "metaplatform.order.acme.order.placed.created"


# -----------------------------------------------------------------------------
# IdempotentConsumer
# -----------------------------------------------------------------------------
def make_message(event: Event) -> Message:
    return Message(
        topic="metaplatform.iam.t1.iam.user.created",
        partition=0,
        offset=0,
        key=event.aggregate_id.encode("utf-8"),
        value=json.dumps(event.to_dict()).encode("utf-8"),
        headers={"tenant_id": event.tenant_id, "event_id": event.id, "event_type": event.type},
    )


class TestIdempotentConsumer:
    def test_process_ok_marks_dedup(self) -> None:
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1")
        e = make_event(event_id="e1")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        outcome = consumer.process(make_message(e))
        assert outcome == ProcessOutcome.OK
        assert dedup.is_processed(f"t:t1:dedup:{e.id}")
        assert dlq.entries == []

    def test_process_deduped_on_repeat(self) -> None:
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1")
        e = make_event(event_id="e1")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        consumer.process(make_message(e))
        outcome = consumer.process(make_message(e))
        assert outcome == ProcessOutcome.DEDUPED

    def test_process_retry_then_dlq(self) -> None:
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1")
        e = make_event(event_id="e1")
        consumer = IdempotentConsumer(
            dedup=dedup, dlq=dlq, ctx=ctx, retry=RetryPolicy(max_attempts=3)
        )

        def fail(_ev, _c):
            raise RuntimeError("boom")

        bind(fail)
        o1 = consumer.process(make_message(e))
        o2 = consumer.process(make_message(e))
        o3 = consumer.process(make_message(e))
        assert o1 == ProcessOutcome.RETRY
        assert o2 == ProcessOutcome.RETRY
        assert o3 == ProcessOutcome.DLQ
        assert len(dlq.entries) == 1
        entry = dlq.entries[0]
        assert entry.original_topic == "metaplatform.iam.t1.iam.user.created"
        assert entry.error == "boom"

    def test_process_cross_tenant_message_rejected(self) -> None:
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1")
        e = make_event(tenant="t2", event_id="e1")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        with pytest.raises(Exception):
            consumer.process(make_message(e))

    def test_process_cross_tenant_message_allowed_for_admin(self) -> None:
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1", roles=frozenset({"cross_tenant_admin"}))
        e = make_event(tenant="t2", event_id="e1")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        outcome = consumer.process(make_message(e))
        assert outcome == ProcessOutcome.OK

    def test_dedup_key_uses_tenant_prefix(self) -> None:
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="acme")
        e = make_event(tenant="acme", event_id="e1")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        consumer.process(make_message(e))
        # dedup key uses Redis k() prefix: t:<tenant>:dedup:<event>
        assert dedup.is_processed("t:acme:dedup:e1")

    def test_dlq_entry_topic_suffix(self) -> None:
        entry = DlqEntry(
            original_topic="metaplatform.iam.t1.iam.user.created",
            key="u1",
            value=b"{}",
            headers={},
            error="x",
        )
        assert entry.dlq_topic() == "metaplatform.iam.t1.iam.user.created.dlq"

    def test_message_deserialize_bad_json(self) -> None:
        msg = Message(
            topic="t",
            partition=0,
            offset=0,
            key=b"k",
            value=b"not-json",
            headers={},
        )
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        with pytest.raises(ConsumerError, match="not valid JSON"):
            consumer.process(msg)

    def test_message_deserialize_missing_fields(self) -> None:
        msg = Message(
            topic="t",
            partition=0,
            offset=0,
            key=b"k",
            value=json.dumps({"id": "x"}).encode("utf-8"),
            headers={},
        )
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        with pytest.raises(ConsumerError, match="malformed"):
            consumer.process(msg)


# -----------------------------------------------------------------------------
# Cross-tenant negatives (per ADR-0013 §6.5)
# -----------------------------------------------------------------------------
class TestCrossTenantNegatives:
    def test_event_without_tenant_rejected_by_outbox(self) -> None:
        ob: InMemoryOutboxWriter = InMemoryOutboxWriter()
        e = Event.create(
            type="iam.user.created",
            tenant_id="",
            aggregate_id="u",
            payload={},
        )
        with pytest.raises(OutboxError, match="no tenant_id"):
            ob.append(e)

    def test_event_invalid_type_rejected(self) -> None:
        with pytest.raises(ValueError):
            Event.create(
                type="bad", tenant_id="t1", aggregate_id="u", payload={}
            )

    def test_schema_invalid_type_rejected(self) -> None:
        with pytest.raises(SchemaError):
            schema_id_for("Order.placed")

    def test_consumer_cross_tenant_message_rejected(self) -> None:
        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        ctx = make_ctx(tenant="t1")
        e = make_event(tenant="t2")
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        bind(lambda ev, c: None)
        with pytest.raises(Exception):
            consumer.process(make_message(e))

    def test_relay_sends_only_tenant_topics(self) -> None:
        ob: InMemoryOutboxWriter = InMemoryOutboxWriter()
        prod = FakeProducer()
        e1 = make_event(tenant="t1", event_id="e1", type="order.placed.created")
        e2 = make_event(tenant="t2", event_id="e2", type="order.placed.created")
        ob.append(e1)
        ob.append(e2)
        relay = OutboxRelay(outbox=ob, producer=prod, topic_resolver=EventTypeTopicResolver())
        relay.drain_once()
        topics = {m["topic"] for m in prod.sent}
        assert topics == {
            "metaplatform.order.t1.order.placed.created",
            "metaplatform.order.t2.order.placed.created",
        }
