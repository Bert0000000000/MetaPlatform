"""GA-ACCEPTANCE end-to-end smoke (mock mode).

The 17-domain end-to-end suite is intended to be run in a staging
cluster with real Keycloak / PG / Redis / MinIO / Kafka. This
file is the local-only smoke that proves the wiring
(mate-platform.auth, mate-platform.tenancy, mate-platform.messaging,
mate-clients.security) is internally consistent.

It is intentionally a thin integration: each subsystem already
has its own deep unit tests; here we just confirm they compose.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Make packages importable.
REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-app-kb"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


class TestWiring:
    def test_auth_subsystem_importable(self) -> None:
        from mate_platform.auth import (
            JWKSCache,
            TokenVerifier,
            load_auth_config,
            resolve_tenant,
        )
        assert callable(load_auth_config)
        assert callable(resolve_tenant)
        assert hasattr(JWKSCache, "refresh")
        assert hasattr(TokenVerifier, "verify")

    def test_tenancy_subsystem_importable(self) -> None:
        from mate_platform.tenancy import (
            RequestContext,
            TenantAccessError,
            TenantScopedRepository,
            emit_cross_tenant_access,
            require_tenant,
        )
        assert callable(require_tenant)
        assert callable(emit_cross_tenant_access)
        # RequestContext is a dataclass; check its fields.
        from dataclasses import fields
        names = {f.name for f in fields(RequestContext)}
        assert "tenant_id" in names
        assert "user_id" in names
        assert "auth_method" in names
        # TenantScopedRepository is a Protocol; check its methods.
        for m in ("require_tenant", "filter_by_tenant", "assert_tenant_owned"):
            assert hasattr(TenantScopedRepository, m)

    def test_messaging_subsystem_importable(self) -> None:
        from mate_platform.messaging import (
            Event,
            EventTypeTopicResolver,
            InMemoryOutboxWriter,
            InMemorySchemaRegistry,
            OutboxRelay,
            schema_id_for,
            validate_event_type,
        )
        assert callable(Event.create)
        assert callable(validate_event_type)
        assert callable(schema_id_for)
        assert hasattr(OutboxRelay, "drain_once")

    def test_kafka_acl_importable(self) -> None:
        from mate_clients.kafka import (
            IdempotentConsumer,
            InMemoryDedupStore,
            InMemoryDlq,
            KafkaProducer,
            Message,
            ProcessOutcome,
        )
        assert hasattr(IdempotentConsumer, "process")
        assert hasattr(KafkaProducer, "send")

    def test_redis_acl_importable(self) -> None:
        from mate_clients.redis import k, pattern_for, tenant_prefix

        assert callable(k)
        assert callable(pattern_for)
        assert callable(tenant_prefix)

    def test_minio_acl_importable(self) -> None:
        from mate_clients.minio import bucket_for, object_key

        assert callable(bucket_for)
        assert callable(object_key)


class TestEndToEndSmoke:
    """A thin end-to-end path: build an Event, push it through the
    outbox, send to a fake Kafka producer, and dedupe it through
    the IdempotentConsumer.
    """

    def test_event_to_outbox_to_consumer(self) -> None:
        from mate_platform.messaging import (
            Event,
            EventTypeTopicResolver,
            InMemoryOutboxWriter,
            OutboxRelay,
        )
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantId,
            UserId,
        )
        from mate_clients.kafka import (
            IdempotentConsumer,
            InMemoryDedupStore,
            InMemoryDlq,
            Message,
            ProcessOutcome,
            bind,
        )

        # 1. Build an event.
        event = Event.create(
            type="iam.user.created",
            tenant_id="t1",
            aggregate_id="u1",
            payload={"name": "alice"},
        )
        assert event.id

        # 2. Append to outbox.
        outbox = InMemoryOutboxWriter()
        outbox.append(event)
        pending = outbox.fetch_pending()
        assert len(pending) == 1
        assert pending[0].event.id == event.id

        # 3. Drain to a fake producer.
        class FakeProducer:
            def __init__(self) -> None:
                self.sent: list[dict] = []

            def send(self, *, topic, key, value, headers):
                self.sent.append(
                    {"topic": topic, "key": key, "value": value, "headers": dict(headers)}
                )

        prod = FakeProducer()
        relay = OutboxRelay(
            outbox=outbox,
            producer=prod,
            topic_resolver=EventTypeTopicResolver(),
        )
        sent = relay.drain_once()
        assert sent == 1
        assert len(prod.sent) == 1
        # Topic format: metaplatform.<domain>.<tenant>.<event>
        assert prod.sent[0]["topic"] == "metaplatform.iam.t1.iam.user.created"
        # The message is the event as JSON.
        decoded = json.loads(prod.sent[0]["value"])
        assert decoded["id"] == event.id
        assert decoded["tenant_id"] == "t1"

        # 4. Consumer-side tenant + dedup.
        ctx = RequestContext(
            request_id="r1",
            trace_id="trace-1",
            tenant_id=TenantId("t1"),
            user_id=UserId("svc"),
            roles=frozenset(),
            permissions=frozenset(),
            client_id="metaplatform-backend",
            auth_method=AuthMethod.SERVICE,
        )

        dedup = InMemoryDedupStore()
        dlq = InMemoryDlq()
        consumer = IdempotentConsumer(dedup=dedup, dlq=dlq, ctx=ctx)
        msg = Message(
            topic=prod.sent[0]["topic"],
            partition=0,
            offset=0,
            key=prod.sent[0]["key"].encode("utf-8"),
            value=prod.sent[0]["value"],
            headers=prod.sent[0]["headers"],
        )
        seen: list[str] = []

        def handler(ev, _c):
            seen.append(ev.id)

        bind(handler)
        outcome = consumer.process(msg)
        assert outcome == ProcessOutcome.OK
        assert seen == [event.id]

        # Second time (replay): DEDUPED.
        outcome2 = consumer.process(msg)
        assert outcome2 == ProcessOutcome.DEDUPED
        assert seen == [event.id]  # not re-invoked