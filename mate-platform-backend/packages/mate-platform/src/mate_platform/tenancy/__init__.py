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
from .rls_session import (
    GUC_BYPASS,
    GUC_TENANT_ID,
    attach_rls_listener,
    install_rls_session,
    is_attached,
    rls_session_middleware,
)

__all__ = [
    "AuthMethod",
    "CrossTenantAccess",
    "GUC_BYPASS",
    "GUC_TENANT_ID",
    "RequestContext",
    "TenantAccessError",
    "TenantScopedRepository",
    "UserId",
    "assert_same_tenant",
    "attach_rls_listener",
    "emit_cross_tenant_access",
    "install_rls_session",
    "is_attached",
    "is_cross_tenant_admin",
    "make_target_tenants",
    "require_any_tenant",
    "require_tenant",
    "rls_session_middleware",
]
