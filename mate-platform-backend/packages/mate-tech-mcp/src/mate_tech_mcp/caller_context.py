"""Per-request caller identity for tools that call *other* services (1.1 task 1c).

Several tools on this surface proxy to another service (currently the
ontology engine). Those calls must go out **as the caller** — the caller's
bearer token plus the tenant they authenticated into — not as the MCP
service's own ``client_credentials`` identity.

Why the service identity does not work: the token's ``iss`` is minted by
whichever Keycloak address issued it, and the downstream service validates
against its own ``KEYCLOAK_URL``; on top of that the service token carries no
``tenant`` claim, so the ontology engine's ``AuthMiddleware`` rejects it
outright (measured: 401). A caller token already satisfies both ends.

Binding is per-request and intentionally narrow: the protocol surface (and the
REST bridge) wrap the tool invocation in :func:`bind_caller`, so a token can
never leak from one request into the next.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CallerContext:
    tenant_id: str
    bearer_token: str


_caller: ContextVar[CallerContext | None] = ContextVar("mcp_caller", default=None)


def current_caller() -> CallerContext | None:
    """The caller bound to this request, or None outside one."""
    return _caller.get()


@contextmanager
def bind_caller(*, tenant_id: str, bearer_token: str) -> Iterator[None]:
    """Bind the calling identity for the duration of one tool invocation."""
    token = _caller.set(CallerContext(tenant_id=tenant_id, bearer_token=bearer_token))
    try:
        yield
    finally:
        _caller.reset(token)


def unbind_caller() -> None:
    """Clear any binding (used when a test's context leaks)."""
    _caller.set(None)


__all__ = ["CallerContext", "bind_caller", "current_caller", "unbind_caller"]
