"""Authentication & authorization facade for mate-platform."""
from .audit import (
    CrossTenantAuditSink,
    CrossTenantDataAccess,
    InMemoryAuditSink,
    StdoutAuditSink,
    emit_cross_tenant_data_access,
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
    "is_tenant_soft_deleted",
    "load_auth_config",
    "request_gdpr_forget",
    "resolve_tenant",
]
