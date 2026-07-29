"""Tenant isolation tests (ST-5.4.11)."""
from __future__ import annotations

import pytest

from mate_tech_ont.security.tenant import (
    DEFAULT_TENANT,
    TenantContext,
    assert_tenant_access,
    check_tenant_access,
)


def test_default_tenant_can_access_any() -> None:
    assert check_tenant_access(DEFAULT_TENANT, "any-resource-tenant") is True


def test_same_tenant_can_access() -> None:
    ctx = TenantContext(tenant_id="acme", user_id="alice")
    assert check_tenant_access(ctx, "acme") is True


def test_cross_tenant_denied() -> None:
    ctx = TenantContext(tenant_id="acme", user_id="alice")
    assert check_tenant_access(ctx, "bob") is False


def test_assert_tenant_access_raises_on_cross() -> None:
    ctx = TenantContext(tenant_id="acme", user_id="alice")
    with pytest.raises(PermissionError, match="denied"):
        assert_tenant_access(ctx, "bob")


def test_assert_tenant_access_passes_on_same() -> None:
    ctx = TenantContext(tenant_id="acme", user_id="alice")
    assert_tenant_access(ctx, "acme")
