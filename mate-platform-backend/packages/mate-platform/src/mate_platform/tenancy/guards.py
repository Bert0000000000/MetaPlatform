from typing import Protocol

from .context import RequestContext


class TenantGuard(Protocol):
    def require_tenant(self, ctx: RequestContext) -> None: ...
