"""Authentication & authorization facade for mate-platform."""
from .config import AuthConfig, load_auth_config
from .identity import IdentityError, ServiceIdentity, ServiceToken
from .jwks import ALLOWED_ALGS, JWKSCache, JWKSError
from .middleware import AuthMiddleware, build_service_identity, install_auth
from .tenant import TenantBinding, TenantError, resolve_tenant
from .verifier import TokenError, TokenVerifier, VerifiedClaims

__all__ = [
    "ALLOWED_ALGS",
    "AuthConfig",
    "AuthMiddleware",
    "JWKSCache",
    "JWKSError",
    "IdentityError",
    "ServiceIdentity",
    "ServiceToken",
    "TenantBinding",
    "TenantError",
    "TokenError",
    "TokenVerifier",
    "VerifiedClaims",
    "build_service_identity",
    "install_auth",
    "load_auth_config",
    "resolve_tenant",
]