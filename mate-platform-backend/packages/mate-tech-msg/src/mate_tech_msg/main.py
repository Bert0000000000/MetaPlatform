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

import structlog
from fastapi import FastAPI, HTTPException, Request

# TECH-SERVICES / BUSINESS-SLICES: hooks 1, 2 (auth + tenant).
from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import require_tenant

from .dedup import DedupStore
from .kafka_client import create_kafka_client
from .observability.tracing import init_tracing
from .publisher import Publisher
from .schemas import PublishRequest, PublishResponse

logger = structlog.get_logger(__name__)

# Module-level singletons.
kafka = create_kafka_client()
dedup = DedupStore()
publisher = Publisher(kafka=kafka, dedup=dedup)

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
        # Pass tenant_id down so the publisher can scope the topic.
        return await publisher.publish(req, tenant_id=ctx.tenant_id)
    except Exception as e:
        logger.error("publish.error", error=str(e), tenant_id=ctx.tenant_id)
        raise HTTPException(status_code=500, detail=str(e))


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
