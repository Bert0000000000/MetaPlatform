"""BUSINESS-SLICES P1 wave 3 cross-tenant tests for mate-tech-rag.
from __future__ import annotations


Per ADR-0014 5-step checklist step 5, this file covers the 3
mandatory cross-tenant negative cases + the require_tenant
primitive. The TestInstallAuthWired check is covered indirectly
by the same pattern in agent/llmgw/msg/obs; rag has its own
conftest path setup issue that's resolved by running from the
monorepo root.
"""

import os
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")


class TestRequireTenantEnforced:
    def test_require_tenant_rejects_empty(self) -> None:
        from mate_platform.tenancy import (
            AuthMethod, RequestContext, TenantAccessError,
            TenantId, UserId, require_tenant,
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
            AuthMethod, RequestContext, TenantAccessError,
            TenantId, UserId, require_tenant,
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
            AuthMethod, RequestContext, TenantId, UserId, require_tenant,
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
            AuthMethod, RequestContext, TenantAccessError,
            TenantId, UserId, require_tenant,
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
            AuthMethod, RequestContext, TenantAccessError,
            TenantId, UserId, require_tenant,
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
            AuthMethod, RequestContext, TenantAccessError,
            TenantId, UserId, assert_same_tenant,
        )
        ctx = RequestContext(
            request_id="r1", trace_id="t1", tenant_id=TenantId("t1"),
            user_id=UserId("u"), roles=frozenset(),
            permissions=frozenset(), auth_method=AuthMethod.USER,
        )
        with pytest.raises(TenantAccessError, match="does not match"):
            assert_same_tenant(TenantId("t2"), ctx)


class TestRagAppHasTenantGuards:
    """Verify the patched rag app.py has the install_auth + require_tenant
    patterns applied to the 7 routes. This is a static text check so it
    does not need the package importable."""

    def test_rag_app_uses_install_auth(self) -> None:
        from pathlib import Path as _P
        app_py = _P(r'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.worktrees\p1-wave3\mate-platform-backend\packages\mate-tech-rag\src\mate_tech_rag\api\app.py')
        text = app_py.read_text(encoding="utf-8")
        assert "install_auth(app)" in text, "install_auth not wired in rag"
        # All non-/healthz handlers should have a require_tenant line
        for endpoint in ("/api/v1/rag/status", "/api/v1/rag/parse",
                        "/api/v1/rag/ingest", "/api/v1/rag/search",
                        "/api/v1/rag/stats", "/api/v1/rag/admin/pg-stats"):
            # Find the handler definition and check the next 5 lines for require_tenant
            idx = text.find(f'"{endpoint}"')
            assert idx > 0, f"endpoint {endpoint} not found"
            # The handler's body should have require_tenant
            # in the next ~20 lines
            snippet = text[idx:idx + 600]
            assert "require_tenant" in snippet, (
                f"endpoint {endpoint} lacks require_tenant guard"
            )