"""Runtime authorization — role-based access checks.

APPHUB-RUNTIME-01 phase B.

Role matrix:
  - admin  → full access (read + write + publish)
  - editor → read + write (NO publish)
  - viewer → read-only
"""
from __future__ import annotations

from .schema import RuntimeContext

_READ_ROLES = frozenset({"admin", "editor", "viewer"})
_PUBLISH_ROLES = frozenset({"admin"})


def check_runtime_access(ctx: RuntimeContext, user_role: str) -> bool:
    """Check whether *user_role* has basic runtime access.

    All three roles (admin / editor / viewer) can access the runtime
    in read mode. Unknown roles are denied.
    """
    return user_role in _READ_ROLES


def check_publish_access(user_role: str) -> bool:
    """Check whether *user_role* can publish an app.

    Only ``admin`` is allowed to publish.
    """
    return user_role in _PUBLISH_ROLES


def check_shortlink_access(ctx: RuntimeContext, role: str | None) -> bool:
    """Check shortlink (public link) access.

    Anonymous callers (``role is None``) are denied. Any recognised
    role (admin / editor / viewer) is granted access.
    """
    if role is None:
        return False
    return role in _READ_ROLES
