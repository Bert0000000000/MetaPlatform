"""Tests for msg webhook fan-out + DLQ delivery (P3-W9).

Covers:
  * publish → webhook fan-out (matching / no-match / paused).
  * DLQ records permanently failed deliveries.
  * DLQ list filtering by tenant.
  * DLQ replay re-delivers and removes on success.
  * Subscription pause / resume (status transitions + find_matching impact).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
import respx
from httpx import Response

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-msg"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_msg.kafka_client import KafkaClient  # noqa: E402
from mate_tech_msg.publisher import Publisher  # noqa: E402
from mate_tech_msg.schemas import PublishRequest  # noqa: E402
from mate_tech_msg.subscriptions import (  # noqa: E402
    InMemoryDLQStore,
    SubscriptionStore,
    deliver_with_retries,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def mock_kafka() -> KafkaClient:
    """KafkaClient with a mocked producer (no real Kafka needed)."""
    client = KafkaClient(bootstrap_servers="mock://localhost:9092")
    producer_mock = AsyncMock()
    meta = type("Meta", (), {"partition": 0, "offset": 0})()
    producer_mock.send_and_wait = AsyncMock(return_value=meta)
    client._producer = producer_mock
    return client


@pytest.fixture
def fresh_sub_store() -> SubscriptionStore:
    return SubscriptionStore()


@pytest.fixture
def fresh_dlq_store() -> InMemoryDLQStore:
    return InMemoryDLQStore()


_TENANT = "tenant-acme"


def _make_publisher(
    mock_kafka: KafkaClient,
    fresh_sub_store: SubscriptionStore,
    fresh_dlq_store: InMemoryDLQStore,
) -> Publisher:
    return Publisher(
        kafka=mock_kafka,
        subscription_store=fresh_sub_store,
        dlq_store=fresh_dlq_store,
    )


# ---------------------------------------------------------------------------
# Task 1: publish triggers webhook fan-out
# ---------------------------------------------------------------------------
class TestPublishFanOut:
    @respx.mock
    @pytest.mark.asyncio
    async def test_publish_triggers_matching_webhook(
        self,
        mock_kafka: KafkaClient,
        fresh_sub_store: SubscriptionStore,
        fresh_dlq_store: InMemoryDLQStore,
    ) -> None:
        respx.post("https://hook.example.com/cb").mock(
            return_value=Response(200, text="ok")
        )
        fresh_sub_store.create_subscription(
            tenant_id=_TENANT,
            topic_filter="mate.events.*",
            target_url="https://hook.example.com/cb",
            secret="super-secret",
        )
        pub = _make_publisher(mock_kafka, fresh_sub_store, fresh_dlq_store)

        resp = await pub.publish(
            PublishRequest(
                topic="mate.events.user",
                payload={"event": "login", "tenant_id": _TENANT},
            )
        )
        assert resp.idempotency_hit is False
        # Webhook was called exactly once.
        assert respx.calls.call_count == 1

    @respx.mock
    @pytest.mark.asyncio
    async def test_publish_no_matching_subscription_skips_webhook(
        self,
        mock_kafka: KafkaClient,
        fresh_sub_store: SubscriptionStore,
        fresh_dlq_store: InMemoryDLQStore,
    ) -> None:
        respx.post("https://hook.example.com/cb").mock(
            return_value=Response(200, text="ok")
        )
        # Subscription for a different topic pattern.
        fresh_sub_store.create_subscription(
            tenant_id=_TENANT,
            topic_filter="mate.msg.*",
            target_url="https://hook.example.com/cb",
            secret="super-secret",
        )
        pub = _make_publisher(mock_kafka, fresh_sub_store, fresh_dlq_store)

        await pub.publish(
            PublishRequest(
                topic="mate.events.user",
                payload={"event": "login", "tenant_id": _TENANT},
            )
        )
        # No webhook fired — topic didn't match.
        assert respx.calls.call_count == 0

    @respx.mock
    @pytest.mark.asyncio
    async def test_paused_subscription_not_triggered(
        self,
        mock_kafka: KafkaClient,
        fresh_sub_store: SubscriptionStore,
        fresh_dlq_store: InMemoryDLQStore,
    ) -> None:
        respx.post("https://hook.example.com/cb").mock(
            return_value=Response(200, text="ok")
        )
        sub = fresh_sub_store.create_subscription(
            tenant_id=_TENANT,
            topic_filter="mate.events.*",
            target_url="https://hook.example.com/cb",
            secret="super-secret",
        )
        fresh_sub_store.update_subscription_status(
            tenant_id=_TENANT,
            sub_id=sub.id,
            status="paused",
        )
        pub = _make_publisher(mock_kafka, fresh_sub_store, fresh_dlq_store)

        await pub.publish(
            PublishRequest(
                topic="mate.events.user",
                payload={"event": "login", "tenant_id": _TENANT},
            )
        )
        # Paused subscriptions are not in find_matching results.
        assert respx.calls.call_count == 0


# ---------------------------------------------------------------------------
# Task 2: DLQ records failed delivery
# ---------------------------------------------------------------------------
class TestDLQ:
    @respx.mock
    @pytest.mark.asyncio
    async def test_dlq_records_failed_delivery(
        self,
        fresh_sub_store: SubscriptionStore,
        fresh_dlq_store: InMemoryDLQStore,
    ) -> None:
        respx.post("https://hook.example.com/cb").mock(
            return_value=Response(500, text="boom")
        )
        sub = fresh_sub_store.create_subscription(
            tenant_id=_TENANT,
            topic_filter="mate.events.*",
            target_url="https://hook.example.com/cb",
            secret="super-secret",
            max_attempts=1,
        )
        delivery = await deliver_with_retries(
            fresh_sub_store,
            sub,
            "mate.events.user",
            {"event": "login"},
            attempt_delays=(0.0,),
            dlq_store=fresh_dlq_store,
        )
        assert delivery.status == "failed"

        entries = fresh_dlq_store.list(tenant_id=_TENANT)
        assert len(entries) == 1
        entry = entries[0]
        assert entry.topic == "mate.events.user"
        assert entry.subscription_id == sub.id
        assert entry.tenant_id == _TENANT
        assert "HTTP 500" in entry.error
        assert entry.payload == {"event": "login"}

    def test_dlq_list_filters_by_tenant(
        self,
        fresh_dlq_store: InMemoryDLQStore,
    ) -> None:
        fresh_dlq_store.put(
            tenant_id="t1",
            topic="x",
            payload={"a": 1},
            error="e1",
            subscription_id="s1",
        )
        fresh_dlq_store.put(
            tenant_id="t2",
            topic="y",
            payload={"b": 2},
            error="e2",
            subscription_id="s2",
        )
        assert len(fresh_dlq_store.list(tenant_id="t1")) == 1
        assert len(fresh_dlq_store.list(tenant_id="t2")) == 1
        # Cross-tenant isolation: t3 sees nothing.
        assert len(fresh_dlq_store.list(tenant_id="t3")) == 0
        # Filter by subscription_id within a tenant.
        assert len(
            fresh_dlq_store.list(tenant_id="t1", subscription_id="s1")
        ) == 1
        assert len(
            fresh_dlq_store.list(tenant_id="t1", subscription_id="nope")
        ) == 0

    @respx.mock
    @pytest.mark.asyncio
    async def test_dlq_replay_retries_delivery(
        self,
        fresh_sub_store: SubscriptionStore,
        fresh_dlq_store: InMemoryDLQStore,
    ) -> None:
        # Step 1: create a failed delivery that lands in DLQ.
        respx.post("https://hook.example.com/cb").mock(
            return_value=Response(500, text="boom")
        )
        sub = fresh_sub_store.create_subscription(
            tenant_id=_TENANT,
            topic_filter="mate.events.*",
            target_url="https://hook.example.com/cb",
            secret="super-secret",
            max_attempts=1,
        )
        await deliver_with_retries(
            fresh_sub_store,
            sub,
            "mate.events.user",
            {"event": "login"},
            attempt_delays=(0.0,),
            dlq_store=fresh_dlq_store,
        )
        entries = fresh_dlq_store.list(tenant_id=_TENANT)
        assert len(entries) == 1
        msg_id = entries[0].message_id

        # Step 2: mock webhook to succeed and replay the delivery.
        respx.post("https://hook.example.com/cb").mock(
            return_value=Response(200, text="ok")
        )
        entry = fresh_dlq_store.get(tenant_id=_TENANT, message_id=msg_id)
        assert entry is not None
        assert entry.subscription_id == sub.id

        replay_sub = fresh_sub_store.get_subscription(
            tenant_id=_TENANT,
            sub_id=entry.subscription_id,
        )
        assert replay_sub is not None
        delivery = await deliver_with_retries(
            fresh_sub_store,
            replay_sub,
            entry.topic,
            entry.payload,
            attempt_delays=(0.0,),
        )
        assert delivery.status == "success"

        # On success, the entry is removed from DLQ.
        assert fresh_dlq_store.remove(
            tenant_id=_TENANT, message_id=msg_id
        ) is True
        assert len(fresh_dlq_store.list(tenant_id=_TENANT)) == 0


# ---------------------------------------------------------------------------
# Task 3: subscription pause / resume
# ---------------------------------------------------------------------------
class TestSubscriptionPauseResume:
    def test_subscription_pause_and_resume(
        self,
        fresh_sub_store: SubscriptionStore,
    ) -> None:
        sub = fresh_sub_store.create_subscription(
            tenant_id=_TENANT,
            topic_filter="*",
            target_url="https://hook.example.com/cb",
            secret="super-secret",
        )
        assert sub.status == "active"

        # Pause: active → paused.
        paused = fresh_sub_store.update_subscription_status(
            tenant_id=_TENANT,
            sub_id=sub.id,
            status="paused",
        )
        assert paused is not None
        assert paused.status == "paused"

        # Paused subscriptions are excluded from find_matching.
        assert (
            len(
                fresh_sub_store.find_matching(
                    tenant_id=_TENANT, topic="any.topic"
                )
            )
            == 0
        )

        # Resume: paused → active.
        resumed = fresh_sub_store.update_subscription_status(
            tenant_id=_TENANT,
            sub_id=sub.id,
            status="active",
        )
        assert resumed is not None
        assert resumed.status == "active"

        # Active subscriptions are back in find_matching results.
        assert (
            len(
                fresh_sub_store.find_matching(
                    tenant_id=_TENANT, topic="any.topic"
                )
            )
            == 1
        )

        # Cross-tenant: update returns None.
        assert (
            fresh_sub_store.update_subscription_status(
                tenant_id="other",
                sub_id=sub.id,
                status="paused",
            )
            is None
        )
