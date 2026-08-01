"""Authentication & authorization facade for mate-platform."""
from .audit import (
    CrossTenantAuditSink,
    CrossTenantDataAccess,
    InMemoryAuditSink,
    StdoutAuditSink,
    emit_cross_tenant_data_access,
)
from .audit_middleware import (
    install_cross_tenant_audit_middleware,
    make_test_sink,
)
from .config import AuthConfig, load_auth_config
from .identity import IdentityError, ServiceIdentity, ServiceToken
from .jwks import ALLOWED_ALGS, JWKSCache, JWKSError
from .middleware import AuthMiddleware, build_service_identity, install_auth
from .retention import (
    InMemoryRetentionStore,
    RetentionAction,
    RetentionPolicy,
    RetentionStore,
    SoftDeleteRecord,
    is_tenant_soft_deleted,
    request_gdpr_forget,
)
from .tenant import TenantBinding, TenantError, resolve_tenant
from .verifier import TokenError, TokenVerifier, VerifiedClaims

__all__ = [
    "ALLOWED_ALGS",
    "AuthConfig",
    "AuthMiddleware",
    "CrossTenantAuditSink",
    "CrossTenantDataAccess",
    "IdentityError",
    "InMemoryAuditSink",
    "InMemoryRetentionStore",
    "JWKSCache",
    "JWKSError",
    "RetentionAction",
    "RetentionPolicy",
    "RetentionStore",
    "ServiceIdentity",
    "ServiceToken",
    "SoftDeleteRecord",
    "StdoutAuditSink",
    "TenantBinding",
    "TenantError",
    "TokenError",
    "TokenVerifier",
    "VerifiedClaims",
    "build_service_identity",
    "emit_cross_tenant_data_access",
    "install_auth",
    "install_cross_tenant_audit_middleware",
    "is_tenant_soft_deleted",
    "load_auth_config",
    "make_test_sink",
    "request_gdpr_forget",
    "resolve_tenant",
]
