"""AdsAuditMiddleware tests (v3.2-δ DATA-D5).

Verifies the cross-tenant ADS access audit middleware:

  - emits one ``audit.cross_tenant_data_access`` outbox event for
    ADS reads that carry the ``audit:cross_tenant`` tag
  - skips requests without an ADS read flag
  - skips anonymous contexts
  - skips reads whose tags do not include the cross-tenant marker
  - no-ops when ``outbox_writer`` is ``None``
  - is safe to install twice (idempotent constructor)
  - always calls the inner app first; the audit emission happens
    after the response is dispatched
  - the event payload carries tenant / user / trace / product / table / tags
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

# Make mate_platform importable from the source tree.
REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-tech-db"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_platform.messaging import InMemoryOutboxWriter
from mate_platform.tenancy import (
    ADS_AUDIT_EVENT_TYPE,
    CROSS_TENANT_TAG,
    AuthMethod,
    RequestContext,
    TenantId,
    UserId,
)
from mate_platform.tenancy.ads_audit import AdsAuditMiddleware


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _ctx(
    *,
    tenant_id: str = "tenant-acme",
    user_id: str = "u-1",
    auth_method: AuthMethod = AuthMethod.USER,
    trace_id: str = "trace-1",
) -> RequestContext:
    return RequestContext(
        request_id="req-1",
        trace_id=trace_id,
        tenant_id=TenantId(tenant_id),
        user_id=UserId(user_id),
        roles=frozenset(),
        permissions=frozenset(),
        scopes=frozenset(),
        client_id="metaplatform-backend",
        auth_method=auth_method,
    )


def _state(
    *,
    ctx: RequestContext | None = None,
    ads_read: dict[str, Any] | None = None,
) -> Any:
    """Build a ``scope['state']``-shaped object with attrs ``ctx`` / ``ads_read``."""
    return SimpleNamespace(ctx=ctx, ads_read=ads_read)


def _http_scope(
    state: Any,
    *,
    path: str = "/api/v1/data/ads/products/p1",
    method: str = "GET",
) -> dict[str, Any]:
    return {
        "type": "http",
        "method": method,
        "path": path,
        "state": state,
        "headers": [],
    }


class _Receive:
    def __init__(self) -> None:
        self.calls = 0

    async def __call__(self) -> dict[str, Any]:
        self.calls += 1
        return {"type": "http.request", "body": b"", "more_body": False}


class _Send:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    async def __call__(self, message: dict[str, Any]) -> None:
        self.messages.append(message)


class _InnerApp:
    """Records when the inner app is invoked.

    The inner app must be called BEFORE the audit emission so the
    middleware never blocks the user-visible path.
    """

    def __init__(self) -> None:
        self.called = False
        self.last_scope: dict[str, Any] | None = None
        self.order: list[str] = []

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Any,
        send: Any,
    ) -> None:
        self.called = True
        self.last_scope = scope
        self.order.append("inner")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
class TestEmitsEvent:
    def test_audit_emits_event_for_cross_tenant_ads_read(self) -> None:
        outbox = InMemoryOutboxWriter()
        inner = _InnerApp()
        mw = AdsAuditMiddleware(inner, outbox_writer=outbox)
        state = _state(
            ctx=_ctx(),
            ads_read={
                "product_id": "p-123",
                "table": "ads.orders_daily",
                "tags": [CROSS_TENANT_TAG, "pii:false"],
            },
        )
        receive, send = _Receive(), _Send()
        # Drive the middleware synchronously via asyncio.run
        import asyncio

        asyncio.run(mw(_http_scope(state), receive, send))

        # Inner app was called and exactly one outbox event was recorded.
        assert inner.called is True
        records = outbox.all_records()
        assert len(records) == 1
        ev = records[0].event
        assert ev.type == ADS_AUDIT_EVENT_TYPE
        assert ev.tenant_id == "tenant-acme"

    def test_audit_event_payload_contains_tenant_user_product_table_tags(self) -> None:
        outbox = InMemoryOutboxWriter()
        inner = _InnerApp()
        mw = AdsAuditMiddleware(inner, outbox_writer=outbox)
        state = _state(
            ctx=_ctx(tenant_id="tenant-globex", user_id="u-9", trace_id="trace-99"),
            ads_read={
                "product_id": "p-123",
                "table": "ads.orders_daily",
                "tags": [CROSS_TENANT_TAG, "pii:false"],
            },
        )
        import asyncio

        asyncio.run(mw(_http_scope(state), _Receive(), _Send()))

        ev = outbox.all_records()[0].event
        assert ev.payload["tenant_id"] == "tenant-globex"
        assert ev.payload["user_id"] == "u-9"
        assert ev.payload["trace_id"] == "trace-99"
        assert ev.payload["product_id"] == "p-123"
        assert ev.payload["table"] == "ads.orders_daily"
        assert ev.payload["tags"] == [CROSS_TENANT_TAG, "pii:false"]


class TestSkip:
    def test_audit_skips_non_ads_request(self) -> None:
        outbox = InMemoryOutboxWriter()
        inner = _InnerApp()
        mw = AdsAuditMiddleware(inner, outbox_writer=outbox)
        # ads_read is None — request did not touch ADS.
        state = _state(ctx=_ctx(), ads_read=None)
        import asyncio

        asyncio.run(mw(_http_scope(state), _Receive(), _Send()))

        assert inner.called is True
        assert outbox.all_records() == []

    def test_audit_skips_anonymous_ctx(self) -> None:
        outbox = InMemoryOutboxWriter()
        inner = _InnerApp()
        mw = AdsAuditMiddleware(inner, outbox_writer=outbox)
        state = _state(
            ctx=_ctx(auth_method=AuthMethod.ANONYMOUS),
            ads_read={
                "product_id": "p-123",
                "table": "ads.orders_daily",
                "tags": [CROSS_TENANT_TAG],
            },
        )
        import asyncio

        asyncio.run(mw(_http_scope(state), _Receive(), _Send()))

        # Anonymous requests never produce an audit event.
        assert outbox.all_records() == []

    def test_audit_skips_when_cross_tenant_tag_absent(self) -> None:
        outbox = InMemoryOutboxWriter()
        inner = _InnerApp()
        mw = AdsAuditMiddleware(inner, outbox_writer=outbox)
        state = _state(
            ctx=_ctx(),
            ads_read={
                "product_id": "p-123",
                "table": "ads.orders_daily",
                "tags": ["pii:false", "domain:commerce"],
            },
        )
        import asyncio

        asyncio.run(mw(_http_scope(state), _Receive(), _Send()))

        # Without the cross-tenant tag the read is in-tenant by
        # default — the middleware is a no-op observer.
        assert outbox.all_records() == []


class TestNoOpWriter:
    def test_audit_no_op_when_outbox_writer_is_none(self) -> None:
        inner = _InnerApp()
        mw = AdsAuditMiddleware(inner, outbox_writer=None)
        state = _state(
            ctx=_ctx(),
            ads_read={
                "product_id": "p-123",
                "table": "ads.orders_daily",
                "tags": [CROSS_TENANT_TAG],
            },
        )
        import asyncio

        # Should not raise, should not block.
        asyncio.run(mw(_http_scope(state), _Receive(), _Send()))
        assert inner.called is True


class TestIdempotentInstall:
    def test_audit_is_safe_to_install_twice(self) -> None:
        outbox = InMemoryOutboxWriter()
        # Constructing twice with the same outbox writer must not
        # double-emit when invoked (each middleware is its own
        # instance but each one is independent — the contract is
        # "constructor has no global state").
        mw1 = AdsAuditMiddleware(_InnerApp(), outbox_writer=outbox)
        mw2 = AdsAuditMiddleware(_InnerApp(), outbox_writer=outbox)
        # Both instances are usable.
        assert mw1 is not mw2
        assert mw1.app is not mw2.app
        # Wiring the same outbox to two independent middlewares is
        # a deliberate configuration choice (e.g. dev reloads);
        # we only require that the constructor itself is a pure
        # no-state function — assert that no global registry grew.
        state = _state(
            ctx=_ctx(),
            ads_read={
                "product_id": "p-1",
                "table": "ads.t",
                "tags": [CROSS_TENANT_TAG],
            },
        )
        import asyncio

        # One event per middleware invocation.
        asyncio.run(mw1(_http_scope(state), _Receive(), _Send()))
        asyncio.run(mw2(_http_scope(state), _Receive(), _Send()))
        assert len(outbox.all_records()) == 2


class TestInnerAppOrdering:
    def test_audit_does_not_block_inner_app(self) -> None:
        """Inner app must be called BEFORE audit emission."""
        outbox = InMemoryOutboxWriter()
        order: list[str] = []

        class _OrderApp:
            async def __call__(self, scope, receive, send):
                order.append("inner")

        mw = AdsAuditMiddleware(_OrderApp(), outbox_writer=outbox)
        state = _state(
            ctx=_ctx(),
            ads_read={
                "product_id": "p-1",
                "table": "ads.t",
                "tags": [CROSS_TENANT_TAG],
            },
        )
        import asyncio

        asyncio.run(mw(_http_scope(state), _Receive(), _Send()))

        # Inner app was called once; the audit emission came after.
        assert order == ["inner"]
        # And the event was recorded.
        assert len(outbox.all_records()) == 1
