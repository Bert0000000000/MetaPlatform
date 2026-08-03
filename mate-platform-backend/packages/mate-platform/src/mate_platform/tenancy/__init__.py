"""Tenant isolation primitives for mate-platform."""
from .ads_audit import ADS_AUDIT_EVENT_TYPE, CROSS_TENANT_TAG, AdsAuditMiddleware
from .audit import CrossTenantAccess, emit_cross_tenant_access, make_target_tenants
from .context import AuthMethod, RequestContext, UserId
from .context import TenantId as TenantId
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
    rls_db_session,
    rls_db_session_for,
    rls_session_middleware,
)

__all__ = [
    "ADS_AUDIT_EVENT_TYPE",
    "CROSS_TENANT_TAG",
    "GUC_BYPASS",
    "GUC_TENANT_ID",
    "AdsAuditMiddleware",
    "AuthMethod",
    "CrossTenantAccess",
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
    "rls_db_session",
    "rls_db_session_for",
    "rls_session_middleware",
]
