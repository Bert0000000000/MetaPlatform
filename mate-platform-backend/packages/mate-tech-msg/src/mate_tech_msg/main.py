"""Mate Platform - Tech MSG main entry.

Wires the three integration hooks per ADR-0014 (the same 5-step
checklist as mate-app-kb canonical):
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at the top of every handler (SEC-TENANT-01).
  3. (future) outbox.append(event) for write endpoints.
  4. BearerAuth + OutgoingAuthMiddleware for all outbound calls.
  5. >=3 cross-tenant negative tests in tests/.

The service is the message bus (Kafka producer/consumer + idempotency
+ retry). The `/healthz` endpoint is anonymous; all other endpoints
require an authenticated tenant.
"""
from __future__ import annotations

from dataclasses import asdict

import structlog
from fastapi import FastAPI, HTTPException, Query, Request

# TECH-SERVICES / BUSINESS-SLICES: hooks 1, 2 (auth + tenant).
from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import require_tenant

from .dedup import DedupStore
from .in_memory import list_messages
from .kafka_client import create_kafka_client
from .observability.tracing import init_tracing
from .publisher import Publisher
from .schemas import PublishRequest, PublishResponse
from .subscription_routes import router as subscription_router
from .subscription_routes import dlq_router as dlq_router_mod
from .subscription_routes import _set_dlq_store as _share_dlq_store
from .subscriptions import InMemoryDLQStore, SubscriptionStore

logger = structlog.get_logger(__name__)

# Module-level singletons.
kafka = create_kafka_client()
dedup = DedupStore()

# 扩展能力 (backlog §3.6): 订阅 / Webhook / 推送通道 in-memory store.
subscription_store = SubscriptionStore()
dlq_store = InMemoryDLQStore()
# Share the store with the subscription_routes module so handlers
# resolve to the same instance (the router module also creates a
# default store at import time as a fallback for direct-import tests).
from .subscription_routes import _set_store as _share_subscription_store  # noqa: E402

_share_subscription_store(subscription_store)
_share_dlq_store(dlq_store)

publisher = Publisher(
    kafka=kafka,
    dedup=dedup,
    subscription_store=subscription_store,
    dlq_store=dlq_store,
)

# OTel init (kept from original).
init_tracing()

app = FastAPI(
    title="mate-tech-msg",
    version="0.1.0",
    description="Message Bus service: Kafka producer / consumer + idempotency + retry",
)

# Hook 1 of 5: install auth middleware (SEC-IAM-01).
# After this call, every request has request.state.ctx populated or a
# 401/403 was returned.
install_auth(app)

# Mount the subscription / webhook extension router (backlog §3.6).
app.include_router(subscription_router)
app.include_router(dlq_router_mod)


def _require_ctx(request: Request):
    """Return the request's RequestContext, raising 401 if missing.

    Defence in depth: install_auth populates ctx or returns 401, so
    this check is a safety net for any handler added later.
    """
    ctx = getattr(request.state, "ctx", None)
    if ctx is None:
        raise HTTPException(status_code=401, detail="no auth context")
    return ctx


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """ST-5.1.1.2 DoD: health check (anonymous, whitelisted by auth)."""
    return {"status": "ok", "version": app.version}


@app.post("/api/v1/msg/publish", response_model=PublishResponse)
async def publish_endpoint(request: Request, req: PublishRequest) -> PublishResponse:
    """ST-5.1.4: publish a message. Tenant guard at the top."""
    ctx = _require_ctx(request)
    require_tenant(ctx)
    try:
        # The publisher derives the partition key from the payload's
        # tenant_id field (default_partition_key_field="tenant_id").
        return await publisher.publish(req)
    except Exception as e:
        logger.error("publish.error", error=str(e), tenant_id=ctx.tenant_id)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/v1/msg/topics")
async def list_topics(request: Request) -> dict[str, list[str]]:
    """List common topics. Tenant guard at the top."""
    ctx = _require_ctx(request)
    require_tenant(ctx)
    return {
        "topics": [
            "mate.msg.dlq",
            "mate.events.user",
            "mate.events.system",
            "mate.kb.ingest",
        ]
    }


def _paginate(items: list, page: int, size: int) -> dict:
    """Apply cursor-free pagination to a list of serialized dicts."""
    total = len(items)
    pages = (total + size - 1) // size if size > 0 else 0
    start = (page - 1) * size
    end = start + size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


@app.get("/api/v1/msg/messages")
async def list_messages_endpoint(
    request: Request,
    topic: str | None = Query(default=None, description="exact topic filter"),
    since: float | None = Query(
        default=None, description="epoch-seconds lower bound (inclusive)"
    ),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Query historical messages (P3-W8). Tenant guard at the top.

    Supports filtering by ``topic`` (exact match) and ``since`` (epoch
    seconds, inclusive). Returns the standard paginated envelope.
    """
    ctx = _require_ctx(request)
    require_tenant(ctx)
    tid = str(ctx.tenant_id)
    rows = list_messages(tid, topic=topic, since=since)
    items = [asdict(m) for m in rows]
    return _paginate(items, page, size)
