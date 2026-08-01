"""Tests for the msg subscription / webhook extension (backlog §3.6).

Covers:
  * Topic filter matching (`*`, `prefix.*`, exact).
  * HMAC-SHA256 payload signing.
  * SubscriptionStore CRUD + tenant isolation.
  * Delivery engine: at-least-once + retries + status recording.
  * FastAPI endpoints: create / list / get / delete / deliveries /
    test-webhook (with respx-mocked HTTP).
  * Cross-tenant negative cases (ADR-0014 step 5).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
from pathlib import Path
from typing import Any

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

import jwt as _pyjwt  # noqa: E402

from mate_tech_msg.subscriptions import (  # noqa: E402
    Delivery,
    Subscription,
    SubscriptionStore,
    deliver_once,
    deliver_with_retries,
    sign_payload,
    topic_matches,
)

_TEST_JWT_SECRET = "test-secret"


def _make_token(tenant_id: str = "tenant-acme") -> str:
    import time

    now = int(time.time())
    return _pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_token()}",
        "X-Tenant-Id": "tenant-acme",
    }


@pytest.fixture
def auth_headers_other_tenant() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_token(tenant_id='tenant-other')}",
        "X-Tenant-Id": "tenant-other",
    }


@pytest.fixture
def fresh_store() -> SubscriptionStore:
    return SubscriptionStore()


# ---------------------------------------------------------------------------
# Topic filter matching
# ---------------------------------------------------------------------------
class TestTopicMatching:
    def test_wildcard_matches_anything(self) -> None:
        assert topic_matches("*", "anything") is True
        assert topic_matches("*", "mate.events.user") is True

    def test_prefix_wildcard_matches_single_segment(self) -> None:
        assert topic_matches("mate.events.*", "mate.events.user") is True
        assert topic_matches("mate.events.*", "mate.events.system") is True
        assert topic_matches("mate.events.*", "mate.events") is True  # prefix itself

    def test_prefix_wildcard_does_not_match_other_root(self) -> None:
        assert topic_matches("mate.events.*", "mate.msg.dlq") is False
        assert topic_matches("mate.events.*", "other.events.user") is False

    def test_exact_match(self) -> None:
        assert topic_matches("mate.events.user", "mate.events.user") is True
        assert topic_matches("mate.events.user", "mate.events.system") is False


# ---------------------------------------------------------------------------
# HMAC signing
# ---------------------------------------------------------------------------
class TestSignPayload:
    def test_signature_format(self) -> None:
        sig = sign_payload("super-secret", b'{"hello":"world"}')
        assert sig.startswith("sha256=")
        # Verify the signature is the actual HMAC of the body.
        expected = hmac.new(
            b"super-secret", b'{"hello":"world"}', hashlib.sha256
        ).hexdigest()
        assert sig == f"sha256={expected}"

    def test_signature_changes_with_secret(self) -> None:
        body = b"payload"
        a = sign_payload("secret-a", body)
        b = sign_payload("secret-b", body)
        assert a != b


# ---------------------------------------------------------------------------
# SubscriptionStore CRUD + tenant isolation
# ---------------------------------------------------------------------------
class TestSubscriptionStore:
    def test_create_and_get(self, fresh_store: SubscriptionStore) -> None:
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="mate.events.*",
            target_url="https://example.com/hook",
            secret="super-secret",
        )
        assert sub.id.startswith("sub-")
        assert sub.tenant_id == "t1"
        fetched = fresh_store.get_subscription(tenant_id="t1", sub_id=sub.id)
        assert fetched is sub

    def test_get_returns_none_for_other_tenant(
        self, fresh_store: SubscriptionStore
    ) -> None:
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://example.com/hook",
            secret="super-secret",
        )
        # Cross-tenant read returns None (not the row).
        assert fresh_store.get_subscription(tenant_id="t2", sub_id=sub.id) is None

    def test_list_filters_by_tenant(self, fresh_store: SubscriptionStore) -> None:
        fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://a.example.com",
            secret="super-secret",
        )
        fresh_store.create_subscription(
            tenant_id="t2",
            topic_filter="*",
            target_url="https://b.example.com",
            secret="super-secret",
        )
        assert len(fresh_store.list_subscriptions(tenant_id="t1")) == 1
        assert len(fresh_store.list_subscriptions(tenant_id="t2")) == 1
        assert len(fresh_store.list_subscriptions(tenant_id="t3")) == 0

    def test_delete_marks_deleted_status(self, fresh_store: SubscriptionStore) -> None:
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://a.example.com",
            secret="super-secret",
        )
        assert fresh_store.delete_subscription(tenant_id="t1", sub_id=sub.id) is True
        deleted = fresh_store.get_subscription(tenant_id="t1", sub_id=sub.id)
        assert deleted is not None
        assert deleted.status == "deleted"

    def test_delete_returns_false_for_other_tenant(
        self, fresh_store: SubscriptionStore
    ) -> None:
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://a.example.com",
            secret="super-secret",
        )
        assert fresh_store.delete_subscription(tenant_id="t2", sub_id=sub.id) is False

    def test_create_validates_target_url(self, fresh_store: SubscriptionStore) -> None:
        with pytest.raises(ValueError, match="target_url must be http"):
            fresh_store.create_subscription(
                tenant_id="t1",
                topic_filter="*",
                target_url="ftp://nope",
                secret="super-secret",
            )

    def test_find_matching_returns_only_active(
        self, fresh_store: SubscriptionStore
    ) -> None:
        s1 = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="mate.events.*",
            target_url="https://a.example.com",
            secret="super-secret",
        )
        fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="mate.msg.*",
            target_url="https://b.example.com",
            secret="super-secret",
        )
        # Delete one — it must not appear in matches.
        fresh_store.delete_subscription(tenant_id="t1", sub_id=s1.id)
        matches = fresh_store.find_matching(tenant_id="t1", topic="mate.events.user")
        assert len(matches) == 0
        matches = fresh_store.find_matching(tenant_id="t1", topic="mate.msg.dlq")
        assert len(matches) == 1


# ---------------------------------------------------------------------------
# Delivery engine
# ---------------------------------------------------------------------------
class TestDeliveryEngine:
    @respx.mock
    @pytest.mark.asyncio
    async def test_deliver_once_success(self) -> None:
        respx.post("https://example.com/hook").mock(return_value=Response(200, text="ok"))
        sub = Subscription(
            id="sub-1",
            tenant_id="t1",
            topic_filter="*",
            target_url="https://example.com/hook",
            secret="super-secret",
        )
        code, err = await deliver_once(sub, "topic.x", {"hi": 1})
        assert code == 200
        assert err is None

    @respx.mock
    @pytest.mark.asyncio
    async def test_deliver_once_records_http_error(self) -> None:
        respx.post("https://example.com/hook").mock(return_value=Response(500, text="bad"))
        sub = Subscription(
            id="sub-1",
            tenant_id="t1",
            topic_filter="*",
            target_url="https://example.com/hook",
            secret="super-secret",
        )
        code, err = await deliver_once(sub, "topic.x", {"hi": 1})
        assert code == 500
        assert err is not None
        assert "HTTP 500" in err

    @respx.mock
    @pytest.mark.asyncio
    async def test_deliver_with_retries_succeeds_on_second_attempt(
        self, fresh_store: SubscriptionStore
    ) -> None:
        # First call 500s, second succeeds.
        route = respx.post("https://example.com/hook")
        route.mock(side_effect=[
            Response(500, text="boom"),
            Response(200, text="ok"),
        ])
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://example.com/hook",
            secret="super-secret",
            max_attempts=3,
        )
        delivery = await deliver_with_retries(
            fresh_store,
            sub,
            "topic.x",
            {"hello": "world"},
            attempt_delays=(0.0, 0.0, 0.0),  # no real sleeps in tests
        )
        assert delivery.status == "success"
        assert delivery.attempt == 2
        assert delivery.status_code == 200
        assert delivery.delivered_at is not None

    @respx.mock
    @pytest.mark.asyncio
    async def test_deliver_with_retries_records_failure(
        self, fresh_store: SubscriptionStore
    ) -> None:
        respx.post("https://example.com/hook").mock(
            return_value=Response(503, text="down")
        )
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://example.com/hook",
            secret="super-secret",
            max_attempts=2,
        )
        delivery = await deliver_with_retries(
            fresh_store,
            sub,
            "topic.x",
            {},
            attempt_delays=(0.0, 0.0),
        )
        assert delivery.status == "failed"
        assert delivery.attempt == 2
        assert delivery.status_code == 503
        assert delivery.last_error is not None

    @respx.mock
    @pytest.mark.asyncio
    async def test_deliver_with_retries_records_network_error(
        self, fresh_store: SubscriptionStore
    ) -> None:
        # httpx raises ConnectError when the host doesn't resolve.
        respx.post("https://example.com/hook").mock(
            side_effect=__import__("httpx").ConnectError("dns failed")
        )
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://example.com/hook",
            secret="super-secret",
            max_attempts=1,
        )
        delivery = await deliver_with_retries(
            fresh_store,
            sub,
            "topic.x",
            {},
            attempt_delays=(0.0,),
        )
        assert delivery.status == "failed"
        assert delivery.attempt == 1
        assert delivery.status_code == 0  # network error
        assert "dns failed" in (delivery.last_error or "")

    @respx.mock
    @pytest.mark.asyncio
    async def test_delivery_records_signature_header(
        self, fresh_store: SubscriptionStore
    ) -> None:
        captured: dict[str, Any] = {}

        def _intercept(request):
            captured["headers"] = dict(request.headers)
            captured["body"] = request.content
            return Response(200, text="ok")

        respx.post("https://example.com/hook").mock(side_effect=_intercept)
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://example.com/hook",
            secret="super-secret",
        )
        await deliver_with_retries(
            fresh_store, sub, "topic.x", {"hi": 1}, attempt_delays=(0.0,)
        )
        assert "x-mate-signature" in captured["headers"]
        sig = captured["headers"]["x-mate-signature"]
        assert sig.startswith("sha256=")
        # Verify the signature matches the body.
        expected = sign_payload("super-secret", captured["body"])
        assert sig == expected
        assert captured["headers"]["x-mate-topic"] == "topic.x"
        assert captured["headers"]["x-mate-subscription-id"] == sub.id


# ---------------------------------------------------------------------------
# FastAPI endpoints
# ---------------------------------------------------------------------------
class TestSubscriptionsEndpoints:
    @pytest.fixture
    def client(self):
        """Build a TestClient backed by the real main.app.

        ``install_auth`` is wired in main.py with
        ``INSECURE_SKIP_SIGNATURE=1`` (set in conftest), so a valid
        Keycloak-format JWT in ``Authorization`` populates
        ``request.state.ctx``. We reset the shared subscription
        store before each test for isolation.
        """
        from fastapi.testclient import TestClient

        from mate_tech_msg import main as main_mod
        from mate_tech_msg import subscription_routes as routes_mod

        # Both modules share the same SubscriptionStore instance
        # (main.py calls _set_store at import time); reset it.
        main_mod.subscription_store.reset()
        # Defensive: in case the routes module's store drifted.
        routes_mod.subscription_store = main_mod.subscription_store

        yield TestClient(main_mod.app)

        # Clean up after the test.
        main_mod.subscription_store.reset()

    def _create_sub(
        self,
        client,
        auth_headers: dict[str, str],
        *,
        topic_filter: str = "mate.events.*",
        target_url: str = "https://example.com/hook",
        secret: str = "super-secret",
    ) -> dict[str, Any]:
        r = client.post(
            "/api/v1/msg/subscriptions",
            json={
                "topic_filter": topic_filter,
                "target_url": target_url,
                "secret": secret,
            },
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text
        return r.json()["subscription"]

    def test_create_subscription_endpoint(self, client, auth_headers) -> None:
        sub = self._create_sub(client, auth_headers)
        assert sub["id"].startswith("sub-")
        assert sub["topic_filter"] == "mate.events.*"
        assert sub["target_url"] == "https://example.com/hook"
        assert sub["status"] == "active"

    def test_create_rejects_invalid_url(self, client, auth_headers) -> None:
        r = client.post(
            "/api/v1/msg/subscriptions",
            json={
                "topic_filter": "*",
                "target_url": "ftp://nope",
                "secret": "super-secret",
            },
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_list_subscriptions_endpoint(self, client, auth_headers) -> None:
        self._create_sub(client, auth_headers, topic_filter="mate.events.*")
        self._create_sub(client, auth_headers, topic_filter="mate.msg.*")
        r = client.get("/api/v1/msg/subscriptions", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 2

    def test_get_subscription_endpoint(self, client, auth_headers) -> None:
        sub = self._create_sub(client, auth_headers)
        r = client.get(f"/api/v1/msg/subscriptions/{sub['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["subscription"]["id"] == sub["id"]

    def test_get_returns_404_for_unknown(self, client, auth_headers) -> None:
        r = client.get("/api/v1/msg/subscriptions/sub-does-not-exist", headers=auth_headers)
        assert r.status_code == 404

    def test_delete_subscription_endpoint(self, client, auth_headers) -> None:
        sub = self._create_sub(client, auth_headers)
        r = client.delete(f"/api/v1/msg/subscriptions/{sub['id']}", headers=auth_headers)
        assert r.status_code == 200
        # Subsequent get should still return the row, but with status=deleted.
        r2 = client.get(f"/api/v1/msg/subscriptions/{sub['id']}", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["subscription"]["status"] == "deleted"

    def test_cross_tenant_get_returns_404(
        self, client, auth_headers, auth_headers_other_tenant
    ) -> None:
        sub = self._create_sub(client, auth_headers)
        # Other tenant cannot read.
        r = client.get(
            f"/api/v1/msg/subscriptions/{sub['id']}",
            headers=auth_headers_other_tenant,
        )
        assert r.status_code == 404

    @respx.mock
    def test_test_webhook_endpoint_records_delivery(
        self, client, auth_headers
    ) -> None:
        respx.post("https://example.com/hook").mock(return_value=Response(200, text="ok"))
        sub = self._create_sub(client, auth_headers)
        r = client.post(
            f"/api/v1/msg/subscriptions/{sub['id']}/test",
            json={"topic": "mate.events.user", "payload": {"hello": "world"}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["delivery"]["status"] == "success"
        assert body["delivery"]["status_code"] == 200
        # Delivery should also appear in the deliveries list.
        r2 = client.get(
            f"/api/v1/msg/subscriptions/{sub['id']}/deliveries",
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["total"] >= 1


# ---------------------------------------------------------------------------
# ADR-0014 step 5: cross-tenant negative tests (3 minimum)
# ---------------------------------------------------------------------------
class TestCrossTenantNegatives:
    def test_require_tenant_rejects_empty_tenant(self) -> None:
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantAccessError,
            TenantId,
            UserId,
            require_tenant,
        )

        ctx = RequestContext(
            request_id="r1",
            trace_id="t1",
            tenant_id=TenantId(""),
            user_id=UserId("u"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.USER,
        )
        with pytest.raises(TenantAccessError, match="missing tenant"):
            require_tenant(ctx)

    def test_subscription_store_refuses_cross_tenant_read(
        self, fresh_store: SubscriptionStore
    ) -> None:
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://a.example.com",
            secret="super-secret",
        )
        # Tenant t2 cannot read t1's subscription.
        assert fresh_store.get_subscription(tenant_id="t2", sub_id=sub.id) is None
        # And cannot list it either.
        assert len(fresh_store.list_subscriptions(tenant_id="t2")) == 0

    def test_subscription_store_refuses_cross_tenant_delete(
        self, fresh_store: SubscriptionStore
    ) -> None:
        sub = fresh_store.create_subscription(
            tenant_id="t1",
            topic_filter="*",
            target_url="https://a.example.com",
            secret="super-secret",
        )
        # Tenant t2 cannot delete t1's subscription.
        assert fresh_store.delete_subscription(tenant_id="t2", sub_id=sub.id) is False
        # t1's sub is still there.
        assert fresh_store.get_subscription(tenant_id="t1", sub_id=sub.id) is not None
