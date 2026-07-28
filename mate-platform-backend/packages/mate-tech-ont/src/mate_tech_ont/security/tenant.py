"""Tenant isolation (ST-5.4.11)."""
from __future__ import annotations

from dataclasses import dataclass

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class TenantContext:
    tenant_id: str
    user_id: str
    roles: tuple[str, ...] = ()


DEFAULT_TENANT = TenantContext(tenant_id="default", user_id="anonymous")


def check_tenant_access(ctx: TenantContext, resource_tenant: str) -> bool:
    if ctx.tenant_id == "default":
        return True
    return ctx.tenant_id == resource_tenant


def assert_tenant_access(ctx: TenantContext, resource_tenant: str) -> None:
    if not check_tenant_access(ctx, resource_tenant):
        logger.warning(
            "tenant.access_denied",
            ctx=ctx.tenant_id,
            resource=resource_tenant,
        )
        raise PermissionError(
            f"Cross-tenant access denied: {ctx.tenant_id} -> {resource_tenant}"
        )