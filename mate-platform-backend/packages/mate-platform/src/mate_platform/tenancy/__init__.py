"""Tenant isolation primitives for mate-platform."""
from .audit import CrossTenantAccess, emit_cross_tenant_access, make_target_tenants
from .context import AuthMethod, RequestContext, TenantId, UserId
from .guards import (
    TenantAccessError,
    assert_same_tenant,
    is_cross_tenant_admin,
    require_any_tenant,
    require_tenant,
)
from .repository import TenantScopedRepository

__all__ = [
    "AuthMethod",
    "CrossTenantAccess",
    "RequestContext",
    "TenantAccessError",
    "TenantId",
    "TenantScopedRepository",
    "UserId",
    "assert_same_tenant",
    "emit_cross_tenant_access",
    "is_cross_tenant_admin",
    "make_target_tenants",
    "require_any_tenant",
    "require_tenant",
]
