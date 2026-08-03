"""Cross-tenant ADS access audit middleware (v3.2-δ DATA-D5).

Captures reads from the Iceberg ADS layer for audit. The Iceberg
sub-chart is shared infrastructure — when a tenant reads an ADS
table that has the ``cross_tenant_data_access`` flag (set in the
data product's tags), the access is audited.

The middleware emits an ``audit.cross_tenant_data_access`` outbox
event on the platform event bus. This is orthogonal to the
existing ``audit.cross_tenant_access`` (which is the row-level
bypass flag inside the rls_session module).
"""
from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from ..messaging.events import Event
from ..messaging.outbox import OutboxWriter
from .context import AuthMethod, RequestContext

logger = logging.getLogger(__name__)

# Event type emitted to the platform event bus when an ADS read
# crosses a tenant boundary. Kept in sync with the platform
# contract — see ``contracts/openapi/services/data.yaml``.
ADS_AUDIT_EVENT_TYPE = "audit.cross_tenant_data_access"

# Tag that data products (in their tags JSON list) carry to opt
# in to cross-tenant ADS audit. A data product with this tag
# instructs the ADS read handler to set ``request.state.ads_read``
# on the FastAPI request so the middleware can find it.
CROSS_TENANT_TAG = "audit:cross_tenant"

# ``request.state`` attribute set by the ADS read handler. Truthy
# values are audited; falsy / missing values are not.
_ADS_READ_ATTR = "ads_read"


class AdsAuditMiddleware:
    """FastAPI middleware that audits ADS reads crossing tenant boundaries.

    The middleware inspects ``request.state.ctx`` (set by
    AuthMiddleware) plus ``request.state.ads_read`` (a flag set
    by the ADS read handler) and emits one audit event per
    request.

    Tag ``audit:cross_tenant`` on a data product (in the data
    product's tags JSON list) marks it as needing audit.
    """

    def __init__(
        self,
        app: Any,
        *,
        outbox_writer: OutboxWriter | None = None,
    ) -> None:
        self.app = app
        self.outbox_writer = outbox_writer

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Callable[[], Awaitable[dict[str, Any]]],
        send: Callable[[dict[str, Any]], Awaitable[None]],
    ) -> None:
        # Skip non-HTTP scopes (lifespan, websocket). The middleware
        # only audits HTTP traffic; anything else is a transparent
        # passthrough.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        # Always call the inner app first so the request is served;
        # the audit emission happens *after* the response is in
        # flight so we never block the user-visible path.
        await self.app(scope, receive, send)

        if self.outbox_writer is None:
            # No writer wired — the middleware is a no-op observer.
            return

        ctx = _extract_ctx(scope)
        if ctx is None or ctx.auth_method == AuthMethod.ANONYMOUS:
            return

        ads_read = _extract_ads_read(scope)
        if not ads_read:
            return

        tags = _normalize_tags(ads_read.get("tags"))
        if CROSS_TENANT_TAG not in tags:
            return

        product_id = str(ads_read.get("product_id") or "")
        table = str(ads_read.get("table") or "")
        if not product_id or not table:
            # Without an identifier we cannot correlate the audit
            # event to a data product; skip rather than emit a
            # half-formed event.
            logger.warning(
                "ads_audit.skip_missing_identifiers",
                extra={"product_id": product_id, "table": table},
            )
            return

        event = Event.create(
            type=ADS_AUDIT_EVENT_TYPE,
            tenant_id=str(ctx.tenant_id),
            aggregate_id=product_id,
            trace_id=ctx.trace_id,
            payload={
                "tenant_id": str(ctx.tenant_id),
                "user_id": str(ctx.user_id),
                "trace_id": ctx.trace_id,
                "product_id": product_id,
                "table": table,
                "tags": list(tags),
            },
        )
        try:
            self.outbox_writer.append(event)
        except Exception:  # pragma: no cover - defensive
            # Audit failures must not break the user-visible path.
            logger.exception(
                "ads_audit.outbox_append_failed",
                extra={"event_id": event.id, "product_id": product_id},
            )


# ---------------------------------------------------------------------------
# ASGI helpers — kept module-private so the middleware surface stays small.
# ---------------------------------------------------------------------------
def _extract_ctx(scope: dict[str, Any]) -> RequestContext | None:
    """Pull the RequestContext from ``scope['state']`` if present.

    FastAPI exposes the same ``request.state`` object as
    ``scope.setdefault('state', <State>).ctx`` once the auth
    middleware has populated it. We tolerate both shapes so the
    middleware is testable with a plain dict scope.
    """
    state = scope.get("state")
    if state is None:
        return None
    # Starlette State exposes attributes directly.
    ctx = getattr(state, "ctx", None)
    if ctx is not None:
        return ctx
    # Plain-dict shape (used in some unit tests).
    if isinstance(state, dict):
        return state.get("ctx")
    return None


def _extract_ads_read(scope: dict[str, Any]) -> dict[str, Any] | None:
    """Pull the ADS read descriptor from ``scope['state']``.

    The ADS read handler is expected to set a dict with keys
    ``product_id``, ``table``, ``tags`` (a list of strings).
    Falsy / missing values mean the request did not touch ADS.
    """
    state = scope.get("state")
    if state is None:
        return None
    value = getattr(state, _ADS_READ_ATTR, None)
    if value is not None:
        return value
    if isinstance(state, dict):
        return state.get(_ADS_READ_ATTR)
    return None


def _normalize_tags(raw: Any) -> tuple[str, ...]:
    """Return a tuple of string tags, dropping empty / non-strings."""
    if raw is None:
        return ()
    if isinstance(raw, (list, tuple)):
        return tuple(str(t) for t in raw if t)
    if isinstance(raw, str):
        return (raw,)
    return ()


__all__ = [
    "ADS_AUDIT_EVENT_TYPE",
    "CROSS_TENANT_TAG",
    "AdsAuditMiddleware",
]
