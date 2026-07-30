from dataclasses import dataclass
from typing import NewType

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
    locale: str = "en"
