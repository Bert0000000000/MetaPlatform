"""In-memory message-history store for mate-tech-msg (P3-W8).

Records every published message so ``GET /api/v1/msg/messages`` can
return a queryable history (filter by ``topic`` / ``since``). The store
is tenant-scoped: each tenant sees only its own messages.

This is a P3-W8 stub — the real persistence layer (Paimon / Postgres
CDC) reuses the ``MessageRecord`` shape without leaking FastAPI types.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class MessageRecord:
    """A persisted message envelope (history view)."""

    id: str
    tenant_id: str
    topic: str
    payload: dict[str, Any] = field(default_factory=dict)
    partition_key: str = ""
    partition: int = 0
    offset: int = 0
    ts: float = 0.0  # epoch seconds


def _seed_messages(tenant_id: str) -> list[MessageRecord]:
    catalog: list[tuple[str, str, dict[str, Any], str, float]] = [
        ("m1", "mate.events.user", {"event": "login", "uid": 1}, "1", 1000.0),
        ("m2", "mate.events.system", {"event": "deploy"}, "2", 1100.0),
        ("m3", "mate.kb.ingest", {"doc": "spec"}, "3", 1200.0),
        ("m4", "mate.events.user", {"event": "logout", "uid": 1}, "1", 1300.0),
    ]
    return [
        MessageRecord(
            id=mid,
            tenant_id=tenant_id,
            topic=topic,
            payload=payload,
            partition_key=pkey,
            partition=i,
            offset=i,
            ts=ts,
        )
        for i, (mid, topic, payload, pkey, ts) in enumerate(catalog)
    ]


# tenant_id -> ordered message list
_MESSAGES: dict[str, list[MessageRecord]] = {}


def _ensure_tenant(tenant_id: str) -> list[MessageRecord]:
    if not tenant_id:
        return []
    if tenant_id not in _MESSAGES:
        _MESSAGES[tenant_id] = _seed_messages(tenant_id)
    return _MESSAGES[tenant_id]


def append_message(
    tenant_id: str,
    topic: str,
    payload: dict[str, Any],
    *,
    partition_key: str = "",
    partition: int = 0,
    offset: int = 0,
    ts: float = 0.0,
) -> MessageRecord:
    """Append a message to the tenant's history (used on publish)."""
    import time as _time
    import uuid as _uuid

    if not tenant_id:
        raise ValueError("tenant_id is required")
    rec = MessageRecord(
        id=f"m-{_uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        topic=topic,
        payload=dict(payload),
        partition_key=partition_key,
        partition=partition,
        offset=offset,
        ts=ts or _time.time(),
    )
    _ensure_tenant(tenant_id).append(rec)
    return rec


def list_messages(
    tenant_id: str,
    *,
    topic: str | None = None,
    since: float | None = None,
) -> list[MessageRecord]:
    """Return the tenant's message history, optionally filtered.

    Args:
        tenant_id: the calling tenant.
        topic: optional exact-topic filter.
        since: optional epoch-seconds lower bound (inclusive).
    """
    rows = list(_ensure_tenant(tenant_id))
    if topic:
        rows = [m for m in rows if m.topic == topic]
    if since is not None:
        rows = [m for m in rows if m.ts >= since]
    return rows


def reset_store() -> None:
    """Drop all seeded data (test isolation)."""
    _MESSAGES.clear()
