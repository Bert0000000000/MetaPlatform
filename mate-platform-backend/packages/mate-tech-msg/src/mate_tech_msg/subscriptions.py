"""Subscription / Webhook / Delivery store (扩展能力 — backlog §3.6).

The msg spec only declares ``POST /api/v1/msg/publish`` and
``GET /api/v1/msg/topics``; ``订阅 / Webhook / 推送通道`` is a
declared gap. This module adds:

* ``Subscription`` — a tenant-scoped webhook registration
  (target URL + topic filter + secret + active flag).
* ``Delivery`` — per-message delivery attempt record (status,
  attempt count, last error). At-least-once semantics with up to
  ``max_attempts`` retries (default 3, exponential backoff).
* ``SubscriptionStore`` — in-memory tenant-scoped repository.
  Production replaces this with the SQL store (out of scope per
  task constraint "不修改持久化层").

The store is intentionally tenant-scoped: every method takes the
``tenant_id`` from the request context (never from the body / path)
and refuses cross-tenant reads.

Wiring
------
``mate_tech_msg.main`` instantiates a module-level
``subscription_store`` and exposes the 4 new endpoints
(``POST/GET/DELETE /api/v1/msg/subscriptions`` +
``GET .../{id}/deliveries`` + ``POST .../{id}/test``) on the same
FastAPI app.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------
SubscriptionStatus = str  # "active" | "paused" | "deleted"
DeliveryStatus = str  # "success" | "failed" | "pending" | "retry"


@dataclass(frozen=True)
class Subscription:
    """Webhook subscription: topic filter + target URL + secret.

    The ``secret`` is used to sign the webhook payload (HMAC-SHA256)
    so receivers can verify authenticity via the
    ``X-Mate-Signature`` header (``sha256=<hex>``).
    """

    id: str
    tenant_id: str
    topic_filter: str  # exact match or ``*`` wildcard suffix (``mate.events.*``)
    target_url: str
    secret: str
    status: SubscriptionStatus = "active"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    max_attempts: int = 3
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Delivery:
    """Per-message delivery attempt record."""

    id: str
    subscription_id: str
    tenant_id: str
    topic: str
    payload: dict[str, Any]
    status: DeliveryStatus
    attempt: int
    last_error: str | None = None
    status_code: int | None = None
    delivered_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True)
class DLQEntry:
    """Dead-letter queue entry for permanently failed deliveries."""

    message_id: str
    tenant_id: str
    subscription_id: str | None
    topic: str
    payload: dict[str, Any]
    error: str
    failed_at: datetime = field(default_factory=lambda: datetime.now(UTC))


# ---------------------------------------------------------------------------
# Topic filter matching
# ---------------------------------------------------------------------------
def topic_matches(filter_expr: str, topic: str) -> bool:
    """Match a topic against a filter expression.

    Supported syntax:
      * ``*`` matches everything.
      * ``mate.events.*`` matches ``mate.events.user``,
        ``mate.events.system``, etc. (single-segment wildcard
        suffix).
      * ``mate.events.user`` matches only that exact topic.

    Multi-segment wildcards (``mate.*.user``) are NOT supported —
    keeps the matcher trivially auditable.
    """
    if filter_expr == "*":
        return True
    if filter_expr.endswith(".*"):
        prefix = filter_expr[:-2]
        return topic == prefix or topic.startswith(prefix + ".")
    return filter_expr == topic


# ---------------------------------------------------------------------------
# In-memory store (tenant-scoped)
# ---------------------------------------------------------------------------
class SubscriptionStore:
    """In-memory subscription + delivery repository.

    Production replaces this with the SQL store; the API surface
    is identical so the swap is mechanical. The store is tenant-
    scoped: every method takes ``tenant_id`` from the request
    context and refuses cross-tenant reads.
    """

    def __init__(self) -> None:
        self._subs: dict[str, dict[str, Subscription]] = {}  # tenant -> id -> sub
        self._deliveries: dict[str, list[Delivery]] = {}  # tenant -> list
        self._counter: int = 0

    def _next_id(self, prefix: str) -> str:
        self._counter += 1
        return f"{prefix}-{self._counter:08d}"

    # ----- subscriptions -----
    def create_subscription(
        self,
        *,
        tenant_id: str,
        topic_filter: str,
        target_url: str,
        secret: str,
        max_attempts: int = 3,
        metadata: dict[str, Any] | None = None,
    ) -> Subscription:
        if not tenant_id:
            raise ValueError("tenant_id required")
        if not topic_filter:
            raise ValueError("topic_filter required")
        if not target_url.startswith(("http://", "https://")):
            raise ValueError("target_url must be http(s)://...")
        sub_id = self._next_id("sub")
        sub = Subscription(
            id=sub_id,
            tenant_id=tenant_id,
            topic_filter=topic_filter,
            target_url=target_url,
            secret=secret,
            max_attempts=max_attempts,
            metadata=dict(metadata) if metadata else {},
        )
        self._subs.setdefault(tenant_id, {})[sub_id] = sub
        logger.info(
            "subscription.created",
            sub_id=sub_id,
            tenant_id=tenant_id,
            topic_filter=topic_filter,
        )
        return sub

    def get_subscription(self, *, tenant_id: str, sub_id: str) -> Subscription | None:
        return self._subs.get(tenant_id, {}).get(sub_id)

    def list_subscriptions(
        self,
        *,
        tenant_id: str,
        topic_filter: str | None = None,
        status: SubscriptionStatus | None = None,
    ) -> list[Subscription]:
        subs = list(self._subs.get(tenant_id, {}).values())
        if topic_filter:
            subs = [s for s in subs if s.topic_filter == topic_filter]
        if status:
            subs = [s for s in subs if s.status == status]
        return sorted(subs, key=lambda s: s.created_at)

    def delete_subscription(self, *, tenant_id: str, sub_id: str) -> bool:
        bucket = self._subs.get(tenant_id, {})
        if sub_id in bucket:
            # Soft-delete: mark status="deleted" so historical
            # deliveries remain queryable; the row is removed on the
            # next GC cycle (out of scope here).
            old = bucket[sub_id]
            bucket[sub_id] = Subscription(
                id=old.id,
                tenant_id=old.tenant_id,
                topic_filter=old.topic_filter,
                target_url=old.target_url,
                secret=old.secret,
                status="deleted",
                created_at=old.created_at,
                updated_at=datetime.now(UTC),
                max_attempts=old.max_attempts,
                metadata=old.metadata,
            )
            logger.info("subscription.deleted", sub_id=sub_id, tenant_id=tenant_id)
            return True
        return False

    def update_subscription_status(
        self,
        *,
        tenant_id: str,
        sub_id: str,
        status: SubscriptionStatus,
    ) -> Subscription | None:
        """Update a subscription's status (active / paused / deleted)."""
        bucket = self._subs.get(tenant_id, {})
        old = bucket.get(sub_id)
        if old is None:
            return None
        new_sub = Subscription(
            id=old.id,
            tenant_id=old.tenant_id,
            topic_filter=old.topic_filter,
            target_url=old.target_url,
            secret=old.secret,
            status=status,
            created_at=old.created_at,
            updated_at=datetime.now(UTC),
            max_attempts=old.max_attempts,
            metadata=old.metadata,
        )
        bucket[sub_id] = new_sub
        logger.info(
            "subscription.status_updated",
            sub_id=sub_id,
            tenant_id=tenant_id,
            status=status,
        )
        return new_sub

    def find_matching(self, *, tenant_id: str, topic: str) -> list[Subscription]:
        """Return active subscriptions whose filter matches ``topic``."""
        return [
            s
            for s in self._subs.get(tenant_id, {}).values()
            if s.status == "active" and topic_matches(s.topic_filter, topic)
        ]

    # ----- deliveries -----
    def record_delivery(self, delivery: Delivery) -> Delivery:
        self._deliveries.setdefault(delivery.tenant_id, []).append(delivery)
        return delivery

    def list_deliveries(
        self,
        *,
        tenant_id: str,
        sub_id: str | None = None,
        limit: int = 100,
    ) -> list[Delivery]:
        rows = self._deliveries.get(tenant_id, [])
        if sub_id:
            rows = [d for d in rows if d.subscription_id == sub_id]
        return sorted(rows, key=lambda d: d.created_at, reverse=True)[:limit]

    def reset(self) -> None:
        """Drop all data. Used by tests."""
        self._subs.clear()
        self._deliveries.clear()
        self._counter = 0


class InMemoryDLQStore:
    """In-memory dead-letter queue store (tenant-scoped).

    Records permanently failed deliveries so they can be queried and
    replayed via the management API.
    """

    def __init__(self) -> None:
        self._entries: dict[str, list[DLQEntry]] = {}  # tenant_id -> entries
        self._counter: int = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"dlq-{self._counter:08d}"

    def put(
        self,
        *,
        tenant_id: str,
        topic: str,
        payload: dict[str, Any],
        error: str,
        subscription_id: str | None = None,
    ) -> DLQEntry:
        """Append a failed-delivery record to the DLQ."""
        entry = DLQEntry(
            message_id=self._next_id(),
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            topic=topic,
            payload=dict(payload),
            error=error,
        )
        self._entries.setdefault(tenant_id, []).append(entry)
        logger.info(
            "dlq.put",
            message_id=entry.message_id,
            tenant_id=tenant_id,
            topic=topic,
            subscription_id=subscription_id,
        )
        return entry

    def list(
        self,
        *,
        tenant_id: str,
        subscription_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[DLQEntry]:
        """Return DLQ entries, optionally filtered by subscription_id."""
        rows = list(self._entries.get(tenant_id, []))
        if subscription_id:
            rows = [e for e in rows if e.subscription_id == subscription_id]
        rows = sorted(rows, key=lambda e: e.failed_at, reverse=True)
        return rows[offset : offset + limit]

    def get(self, *, tenant_id: str, message_id: str) -> DLQEntry | None:
        """Get a single DLQ entry by message_id (tenant-scoped)."""
        for e in self._entries.get(tenant_id, []):
            if e.message_id == message_id:
                return e
        return None

    def remove(self, *, tenant_id: str, message_id: str) -> bool:
        """Remove a DLQ entry (e.g. after successful replay)."""
        bucket = self._entries.get(tenant_id, [])
        for i, e in enumerate(bucket):
            if e.message_id == message_id:
                bucket.pop(i)
                return True
        return False

    def reset(self) -> None:
        """Drop all data. Used by tests."""
        self._entries.clear()
        self._counter = 0


# ---------------------------------------------------------------------------
# Webhook delivery engine (at-least-once with bounded retries)
# ---------------------------------------------------------------------------
def sign_payload(secret: str, body: bytes) -> str:
    """HMAC-SHA256 signature, hex-encoded with the ``sha256=`` prefix."""
    mac = hmac.new(secret.encode(), body, hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


async def deliver_once(
    sub: Subscription,
    topic: str,
    payload: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = 5.0,
) -> tuple[int, str | None]:
    """Single webhook delivery attempt. Returns (status_code, error)."""
    body = json.dumps({"topic": topic, "payload": payload}).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Mate-Signature": sign_payload(sub.secret, body),
        "X-Mate-Topic": topic,
        "X-Mate-Subscription-Id": sub.id,
    }
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=timeout)
    try:
        resp = await client.post(sub.target_url, content=body, headers=headers)
        if 200 <= resp.status_code < 300:
            return resp.status_code, None
        return resp.status_code, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        return 0, str(exc)
    finally:
        if own_client:
            await client.aclose()


async def deliver_with_retries(
    store: SubscriptionStore,
    sub: Subscription,
    topic: str,
    payload: dict[str, Any],
    *,
    attempt_delays: tuple[float, ...] = (0.0, 1.0, 5.0),
    dlq_store: InMemoryDLQStore | None = None,
) -> Delivery:
    """Deliver with bounded retries; record each attempt.

    Default schedule: immediate, 1s, 5s. Tests override
    ``attempt_delays`` to (0.0,) for a single-shot delivery.
    """
    max_attempts = min(sub.max_attempts, len(attempt_delays))
    last_error: str | None = None
    last_status: int | None = None
    status: DeliveryStatus = "retry"
    delivered_at: datetime | None = None
    actual_attempts = 0

    for i in range(max_attempts):
        actual_attempts = i + 1
        await asyncio.sleep(attempt_delays[i])
        code, err = await deliver_once(sub, topic, payload)
        last_status = code
        last_error = err
        if err is None:
            status = "success"
            delivered_at = datetime.now(UTC)
            break
        # Last attempt failed permanently.
        if i == max_attempts - 1:
            status = "failed"

    delivery = Delivery(
        id=f"del-{int(time.time() * 1000)}-{sub.id}",
        subscription_id=sub.id,
        tenant_id=sub.tenant_id,
        topic=topic,
        payload=payload,
        status=status,
        attempt=actual_attempts,
        last_error=last_error,
        status_code=last_status,
        delivered_at=delivered_at,
    )
    store.record_delivery(delivery)
    if status == "failed" and dlq_store is not None:
        dlq_store.put(
            tenant_id=sub.tenant_id,
            subscription_id=sub.id,
            topic=topic,
            payload=payload,
            error=last_error or "unknown error",
        )
    logger.info(
        "subscription.delivered",
        sub_id=sub.id,
        topic=topic,
        status=status,
        attempt=actual_attempts,
        status_code=last_status,
    )
    return delivery


__all__ = [
    "DLQEntry",
    "Delivery",
    "DeliveryStatus",
    "InMemoryDLQStore",
    "Subscription",
    "SubscriptionStatus",
    "SubscriptionStore",
    "deliver_once",
    "deliver_with_retries",
    "sign_payload",
    "topic_matches",
]
