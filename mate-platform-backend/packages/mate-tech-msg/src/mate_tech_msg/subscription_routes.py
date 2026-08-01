"""FastAPI routes for subscription / webhook management (扩展能力 — backlog §3.6).

Endpoints (all under ``/api/v1/msg/subscriptions``):

  POST   /api/v1/msg/subscriptions            — create subscription
  GET    /api/v1/msg/subscriptions            — list subscriptions
  GET    /api/v1/msg/subscriptions/{sub_id}   — get subscription
  DELETE /api/v1/msg/subscriptions/{sub_id}   — soft-delete subscription
  GET    /api/v1/msg/subscriptions/{sub_id}/deliveries
                                               — list delivery history
  POST   /api/v1/msg/subscriptions/{sub_id}/test
                                               — fire a test webhook

Spec status: ``contracts/openapi/services/msg.yaml`` does NOT yet
declare these endpoints. They are extension capabilities per backlog
§3.6 ("订阅 / Webhook / 推送通道 未做"). They are wired under the
canonical ``/api/v1/msg`` prefix so a future contract amendment
lands them at the right path.

ADR-0014 5-step pattern
-----------------------
1. install_auth: wired in main.py (already done for the existing
   publish / topics endpoints).
2. require_tenant: every handler reads ``request.state.ctx`` and
   calls ``require_tenant(ctx)`` before touching the store.
3. Outbox: subscription create / delete emit
   ``msg.subscription.created`` / ``msg.subscription.deleted``
   events via the ``OutboxWriter`` (when configured). The handler
   tolerates a missing outbox (test profile) so tests can run
   without a PG transaction.
4. BearerAuth: install_auth already enforces it.
5. Cross-tenant negative tests: see
   ``tests/test_msg_subscriptions.py``.
"""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from mate_platform.tenancy.guards import require_tenant

from .subscriptions import (
    Delivery,
    Subscription,
    SubscriptionStore,
    deliver_with_retries,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/msg/subscriptions", tags=["msg-subscriptions"])

# Module-level store (created in main.py and re-exported here for
# tests that import the router directly). main.py overrides this
# with its own instance at app-import time.
subscription_store: SubscriptionStore = SubscriptionStore()


def _set_store(store: SubscriptionStore) -> None:
    """Called by main.py to share its store instance with the router."""
    global subscription_store  # noqa: PLW0603
    subscription_store = store


def _tenant_id(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _serialize_sub(sub: Subscription) -> dict[str, Any]:
    d = asdict(sub)
    d["created_at"] = sub.created_at.isoformat()
    d["updated_at"] = sub.updated_at.isoformat()
    return d


def _serialize_delivery(d: Delivery) -> dict[str, Any]:
    return {
        "id": d.id,
        "subscription_id": d.subscription_id,
        "tenant_id": d.tenant_id,
        "topic": d.topic,
        "status": d.status,
        "attempt": d.attempt,
        "last_error": d.last_error,
        "status_code": d.status_code,
        "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
        "created_at": d.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class CreateSubscriptionRequest(BaseModel):
    topic_filter: str = Field(..., description="Topic filter: exact match or `*` / `prefix.*` wildcard")
    target_url: str = Field(..., description="Webhook target URL (http/https)")
    secret: str = Field(..., min_length=8, description="HMAC-SHA256 signing secret")
    max_attempts: int = Field(default=3, ge=1, le=10)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TestWebhookRequest(BaseModel):
    topic: str | None = Field(default=None, description="Override topic; defaults to the sub's filter")
    payload: dict[str, Any] = Field(default_factory=lambda: {"test": True})


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
@router.post("", status_code=201)
async def create_subscription_endpoint(
    request: Request,
    req: CreateSubscriptionRequest,
) -> dict[str, Any]:
    """Create a webhook subscription for the calling tenant."""
    tenant_id = _tenant_id(request)
    try:
        sub = subscription_store.create_subscription(
            tenant_id=tenant_id,
            topic_filter=req.topic_filter,
            target_url=req.target_url,
            secret=req.secret,
            max_attempts=req.max_attempts,
            metadata=req.metadata,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"subscription": _serialize_sub(sub)}


@router.get("")
async def list_subscriptions_endpoint(
    request: Request,
    topic_filter: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    subs = subscription_store.list_subscriptions(
        tenant_id=tenant_id,
        topic_filter=topic_filter,
        status=status,
    )
    return {
        "items": [_serialize_sub(s) for s in subs],
        "total": len(subs),
    }


@router.get("/{sub_id}")
async def get_subscription_endpoint(
    request: Request,
    sub_id: str,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    sub = subscription_store.get_subscription(tenant_id=tenant_id, sub_id=sub_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="subscription not found")
    return {"subscription": _serialize_sub(sub)}


@router.delete("/{sub_id}")
async def delete_subscription_endpoint(
    request: Request,
    sub_id: str,
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    ok = subscription_store.delete_subscription(tenant_id=tenant_id, sub_id=sub_id)
    if not ok:
        raise HTTPException(status_code=404, detail="subscription not found")
    return {"deleted": True, "sub_id": sub_id}


@router.get("/{sub_id}/deliveries")
async def list_deliveries_endpoint(
    request: Request,
    sub_id: str,
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    tenant_id = _tenant_id(request)
    sub = subscription_store.get_subscription(tenant_id=tenant_id, sub_id=sub_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="subscription not found")
    rows = subscription_store.list_deliveries(
        tenant_id=tenant_id,
        sub_id=sub_id,
        limit=limit,
    )
    return {
        "items": [_serialize_delivery(d) for d in rows],
        "total": len(rows),
    }


@router.post("/{sub_id}/test")
async def test_webhook_endpoint(
    request: Request,
    sub_id: str,
    req: TestWebhookRequest,
) -> dict[str, Any]:
    """Fire a test webhook delivery against the subscription's target."""
    tenant_id = _tenant_id(request)
    sub = subscription_store.get_subscription(tenant_id=tenant_id, sub_id=sub_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="subscription not found")
    if sub.status != "active":
        raise HTTPException(status_code=409, detail=f"subscription status is '{sub.status}', expected 'active'")

    topic = req.topic or sub.topic_filter
    delivery = await deliver_with_retries(
        subscription_store,
        sub,
        topic,
        req.payload,
        # Single-shot in the test endpoint — no retries.
        attempt_delays=(0.0,),
    )
    return {"delivery": _serialize_delivery(delivery)}


__all__ = ["router", "subscription_store", "_set_store"]
