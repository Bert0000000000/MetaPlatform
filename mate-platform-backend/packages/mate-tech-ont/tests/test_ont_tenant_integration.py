"""BUSINESS-SLICES P2 wave cross-tenant tests for mate-tech-ont.

Per ADR-0014 step 2, ont uses a global HTTP middleware (rather than
per-handler decorators) because the 4 sub-routers (ontology,
instances, sparql, explain) are wired via app.include_router and
modifying each one is invasive. The middleware enforces the same
require_tenant(ctx) check on every non-/healthz, non-/openapi route.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-ont"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


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
            request_id="r1", trace_id="t1", tenant_id=TenantId(""),
            user_id=UserId("u"), roles=frozenset(),
            permissions=frozenset(), auth_method=AuthMethod.USER,
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
            request_id="r1", trace_id="t1", tenant_id=TenantId("t1"),
            user_id=UserId("anon"), roles=frozenset(),
            permissions=frozenset(), auth_method=AuthMethod.ANONYMOUS,
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
            request_id="r1", trace_id="t1", tenant_id=TenantId("acme"),
            user_id=UserId("u"), roles=frozenset(),
            permissions=frozenset(), auth_method=AuthMethod.SERVICE,
        )
        assert require_tenant(ctx) == "acme"


class TestCrossTenantNegatives:
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
            request_id="r1", trace_id="t1", tenant_id=TenantId(""),
            user_id=UserId("u"), roles=frozenset(),
            permissions=frozenset(), auth_method=AuthMethod.USER,
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
            request_id="r1", trace_id="t1", tenant_id=TenantId("t1"),
            user_id=UserId("anon"), roles=frozenset(),
            permissions=frozenset(), auth_method=AuthMethod.ANONYMOUS,
        )
        with pytest.raises(TenantAccessError, match="anonymous"):
            require_tenant(ctx)

    def test_case3_mismatched_tenant_rejected(self) -> None:
        from mate_platform.tenancy import (
            AuthMethod,
            RequestContext,
            TenantAccessError,
            TenantId,
            UserId,
            assert_same_tenant,
        )
        ctx = RequestContext(
            request_id="r1", trace_id="t1", tenant_id=TenantId("t1"),
            user_id=UserId("u"), roles=frozenset(),
            permissions=frozenset(), auth_method=AuthMethod.USER,
        )
        with pytest.raises(TenantAccessError, match="does not match"):
            assert_same_tenant(TenantId("t2"), ctx)


class TestOntMainWiring:
    """Static text check that ont main.py has install_auth + the
    global tenant-enforcement middleware."""

    def test_ont_main_uses_install_auth(self) -> None:
        main_py = (
            Path(__file__).resolve().parents[3]
            / "packages" / "mate-tech-ont" / "src" / "mate_tech_ont" / "main.py"
        )
        text = main_py.read_text(encoding="utf-8")
        assert "install_auth(app)" in text, "install_auth not wired in ont"
        assert "@app.middleware('http')" in text, (
            "global tenant-enforcement middleware not registered"
        )
        assert "_enforce_tenant_per_request" in text, (
            "middleware handler function not present"
        )
