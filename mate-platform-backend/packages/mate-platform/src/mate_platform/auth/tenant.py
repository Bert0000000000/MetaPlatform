"""Tenant binding utilities."""
from __future__ import annotations

from dataclasses import dataclass

from .verifier import VerifiedClaims


class TenantError(Exception):
    """Raised when tenant binding is invalid or forbidden."""


@dataclass(frozen=True, slots=True)
class TenantBinding:
    tenant_id: str
    switched: bool
    raw_token_tenant: str


def resolve_tenant(
    claims: VerifiedClaims,
    *,
    header_tenant: str | None,
    allow_switch: bool,
) -> TenantBinding:
    raw = claims.tenant_id
    if not header_tenant or header_tenant == raw:
        return TenantBinding(tenant_id=raw, switched=False, raw_token_tenant=raw)

    if not allow_switch:
        raise TenantError(
            "X-Tenant-Id header is present and differs from the token tenant, "
            "but tenant switching is not enabled for this caller"
        )
    if "tenant_switch_enabled" not in claims.scopes:
        raise TenantError(
            "X-Tenant-Id header is present and differs from the token tenant, "
            "but the token does not carry the tenant_switch_enabled scope"
        )
    return TenantBinding(tenant_id=header_tenant, switched=True, raw_token_tenant=raw)
