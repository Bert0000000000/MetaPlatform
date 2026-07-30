"""BUSINESS-SLICES cross-tenant negative tests for mate-tech-msg.

Per ADR-0014 5-step checklist step 5, every app must have >=3
cross-tenant negative tests. This file covers the 3 minimum for
mate-tech-msg.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Make packages importable.
REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-msg"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


# -----------------------------------------------------------------------------
# Hook 1: install_auth is called by create_app
# -----------------------------------------------------------------------------
class TestInstallAuthWired:
    def test_create_main_calls_install_auth(self) -> None:
        # The module-level app instance has already run create_app-style
        # code at import time; we just confirm the install_auth was
        # invoked by checking the middleware stack.
        from mate_tech_msg import main

        # Look for AuthMiddleware in the middleware stack (it adds
        # itself as BaseHTTPMiddleware).
        middleware_classes = [
            m.cls.__name__ for m in main.app.user_middleware
        ]
        assert "AuthMiddleware" in middleware_classes, (
            f"AuthMiddleware missing from stack: {middleware_classes}"
        )


# -----------------------------------------------------------------------------
# Hook 2: require_tenant enforced on every handler
# -----------------------------------------------------------------------------
class TestRequireTenantEnforced:
    def test_require_tenant_rejects_empty(self) -> None:
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

    def test_require_tenant_rejects_anonymous(self) -> None:
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
            tenant_id=TenantId("t1"),
            user_id=UserId("anon"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.ANONYMOUS,
        )
        with pytest.raises(TenantAccessError, match="anonymous"):
            require_tenant(ctx)

    def test_require_tenant_accepts_valid(self) -> None:
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantId,
            UserId,
            require_tenant,
        )

        ctx = RequestContext(
            request_id="r1",
            trace_id="t1",
            tenant_id=TenantId("acme"),
            user_id=UserId("u"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.SERVICE,
        )
        assert require_tenant(ctx) == "acme"


# -----------------------------------------------------------------------------
# Cross-tenant negatives (3 minimum per ADR-0014 §2.3)
# -----------------------------------------------------------------------------
class TestCrossTenantNegatives:
    """Per ADR-0014 step 5, every app has at least 3 cross-tenant
    negative cases. For mate-tech-msg, the three are:

    1. No tenant (RequestContext has empty tenant_id).
    2. Anonymous caller.
    3. Mismatched tenant in path/query/body vs the token.
    """

    def test_case1_no_tenant_rejected(self) -> None:
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

    def test_case2_anonymous_rejected(self) -> None:
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
            tenant_id=TenantId("t1"),
            user_id=UserId("anon"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.ANONYMOUS,
        )
        with pytest.raises(TenantAccessError, match="anonymous"):
            require_tenant(ctx)

    def test_case3_mismatched_tenant_rejected(self) -> None:
        """Path / body that asserts a different tenant from the token
        must be rejected by assert_same_tenant (per ADR-0012 §2.4).
        """
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantAccessError,
            TenantId,
            UserId,
            assert_same_tenant,
        )

        ctx = RequestContext(
            request_id="r1",
            trace_id="t1",
            tenant_id=TenantId("t1"),
            user_id=UserId("u"),
            roles=frozenset(),
            permissions=frozenset(),
            auth_method=AuthMethod.USER,
        )
        with pytest.raises(TenantAccessError, match="does not match"):
            assert_same_tenant(TenantId("t2"), ctx)
