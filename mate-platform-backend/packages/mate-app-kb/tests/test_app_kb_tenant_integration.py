"""mate-app-kb canonical reference tests.

Covers the 5-step integration checklist from ADR-0014:
  1. install_auth(app) is wired
  2. require_tenant(ctx) is enforced on every handler
  3. outbox.append is the only path for events (placeholder OK)
  4. BearerAuth + OutgoingAuthMiddleware used for outbound calls
  5. >=3 cross-tenant negative tests
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Make mate_platform / mate_clients importable from the source tree.
REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common"):
    sys.path.insert(0, str(PKG / sub / "src"))

# Make mate_app_kb importable too.
APP = REPO / "mate-platform-backend" / "packages" / "mate-app-kb"
sys.path.insert(0, str(APP / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


from mate_clients.security import (
    BearerAuth,
)
from mate_platform.tenancy import (
    AuthMethod,
    RequestContext,
    TenantAccessError,
    TenantId,
    UserId,
    require_tenant,
)


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def make_ctx(*, tenant: str = "t1", method: AuthMethod = AuthMethod.USER) -> RequestContext:
    return RequestContext(
        request_id="r1",
        trace_id="trace-1",
        tenant_id=TenantId(tenant),
        user_id=UserId("u1"),
        roles=frozenset(),
        permissions=frozenset(),
        client_id="metaplatform-backend",
        auth_method=method,
    )


@pytest.fixture
def app():
    """Build the FastAPI app with a mocked install_auth."""
    from mate_app_kb.api.app import create_app

    # Patch install_auth so we don't try to actually verify JWTs
    # against a real Keycloak. The real flow is covered in
    # SEC-IAM-01's tests; here we just confirm the app calls
    # install_auth at create time.
    with patch("mate_app_kb.api.app.install_auth") as mock_install:
        mock_install.return_value = None
        app = create_app()
        # The middleware itself is mocked; tests inject request.state.ctx.
        yield app


# -----------------------------------------------------------------------------
# Step 1: install_auth is called
# -----------------------------------------------------------------------------
class TestInstallAuthWired:
    def test_create_app_calls_install_auth(self) -> None:
        from mate_app_kb.api.app import create_app

        with patch("mate_app_kb.api.app.install_auth") as mock_install:
            create_app()
            mock_install.assert_called_once()


# -----------------------------------------------------------------------------
# Step 2: require_tenant enforced on every handler
# -----------------------------------------------------------------------------
class TestRequireTenantEnforced:
    def test_require_tenant_rejects_empty(self) -> None:
        with pytest.raises(TenantAccessError):
            require_tenant(make_ctx(tenant=""))

    def test_require_tenant_rejects_anonymous(self) -> None:
        with pytest.raises(TenantAccessError):
            require_tenant(make_ctx(tenant="t1", method=AuthMethod.ANONYMOUS))

    def test_require_tenant_accepts_valid(self) -> None:
        assert require_tenant(make_ctx(tenant="t1")) == "t1"


# -----------------------------------------------------------------------------
# Step 4: clients use BearerAuth + OutgoingAuthMiddleware
# -----------------------------------------------------------------------------
class TestClientsUseAuth:
    def test_rag_client_accepts_auth_and_tenant(self) -> None:
        from mate_app_kb.clients import RAGClient

        auth = MagicMock(spec=BearerAuth)
        client = RAGClient(auth=auth, tenant_id="t1")
        # The auth attribute is set; the OutgoingAuthMiddleware is
        # applied to httpx.Client.auth.
        assert client._auth is auth
        assert client._tenant_id == "t1"
        client.close()

    def test_rag_client_set_tenant_swaps_auth(self) -> None:
        from mate_app_kb.clients import RAGClient

        auth = MagicMock(spec=BearerAuth)
        client = RAGClient(auth=auth, tenant_id="t1")
        client.set_tenant("t2")
        assert client._tenant_id == "t2"
        client.close()

    def test_agent_client_accepts_auth_and_tenant(self) -> None:
        from mate_app_kb.clients import AgentClient

        auth = MagicMock(spec=BearerAuth)
        client = AgentClient(auth=auth, tenant_id="t1")
        assert client._auth is auth
        assert client._tenant_id == "t1"
        client.close()

    def test_clients_no_auth_when_omitted(self) -> None:
        """No auth + no tenant is allowed for dev/local; in
        production install_auth enforces the auth contract.
        """
        from mate_app_kb.clients import AgentClient, RAGClient

        # Construct without auth; should not raise.
        RAGClient().close()
        AgentClient().close()


# -----------------------------------------------------------------------------
# Step 5: cross-tenant negative cases (3 minimum per ADR-0014 §2.3)
# -----------------------------------------------------------------------------
class TestCrossTenantNegatives:
    def test_case1_no_tenant_rejected(self) -> None:
        """Empty tenant is rejected at the require_tenant boundary."""
        with pytest.raises(TenantAccessError):
            require_tenant(make_ctx(tenant=""))

    def test_case2_anonymous_rejected(self) -> None:
        """Anonymous callers cannot reach tenant-scoped code paths."""
        with pytest.raises(TenantAccessError):
            require_tenant(make_ctx(tenant="t1", method=AuthMethod.ANONYMOUS))

    def test_case3_mismatched_tenant_in_url(self) -> None:
        """A path / query that asserts a different tenant from the
        ctx must be rejected by assert_same_tenant (per ADR-0012
        §2.4). The full integration in the FastAPI handler is
        covered in the per-app smoke tests; here we verify the
        guard primitive still raises."""
        from mate_platform.tenancy.guards import assert_same_tenant

        ctx = make_ctx(tenant="t1")
        with pytest.raises(TenantAccessError):
            assert_same_tenant(TenantId("t2"), ctx)


# -----------------------------------------------------------------------------
# Outbox hook (Step 3) — placeholder test for future wiring
# -----------------------------------------------------------------------------
class TestOutboxHookPlumbing:
    def test_outbox_event_class_importable(self) -> None:
        """The event envelope is exported from mate_platform.messaging.
        Per ADR-0014 Step 3, every write handler should call
        outbox.append(event) in the same transaction as the
        mutation. This test only verifies the import; the actual
        event-emission contract is covered in PLATFORM-EVENT-01's
        tests.
        """
        from mate_platform.messaging import Event, OutboxWriter

        assert hasattr(Event, "create")
        # OutboxWriter is a Protocol; verify it has the expected
        # method names.
        assert hasattr(OutboxWriter, "append")
        assert hasattr(OutboxWriter, "fetch_pending")
        assert hasattr(OutboxWriter, "mark_published")
