"""Request-scoped context dataclass.

Lifted from ARCH-CORE-01 and enriched in SEC-IAM-01 with Keycloak
claims: scopes, client_id, auth_method. The dataclass is the contract
between the auth layer (Keycloak JWT verification) and the application
layer (every endpoint that needs a tenant / user / role).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import NewType


class AuthMethod(str, Enum):
    USER = "user"
    SERVICE = "service"
    ANONYMOUS = "anonymous"


TenantId = NewType("TenantId", str)
UserId = NewType("UserId", str)


@dataclass(frozen=True, slots=True)
class RequestContext:
    request_id: str
    trace_id: str
    tenant_id: TenantId
    user_id: UserId
    roles: frozenset[str]
    permissions: frozenset[str]
    scopes: frozenset[str] = frozenset()
    client_id: str = ""
    auth_method: AuthMethod = AuthMethod.ANONYMOUS
    locale: str = "en"

    @property
    def is_authenticated(self) -> bool:
        return self.auth_method != AuthMethod.ANONYMOUS

    @property
    def is_service(self) -> bool:
        return self.auth_method == AuthMethod.SERVICE

    def has_role(self, role: str) -> bool:
        return role in self.roles

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions
