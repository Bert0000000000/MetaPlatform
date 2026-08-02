"""Short-link resolver (APPHUB-RUNTIME-01 phase C).

Looks up a code in the tenant-scoped store and returns the bound
app metadata. Raises ``ValueError`` when the code is unknown or
expired so callers (HTTP layer) can map it to a 404.
"""
from __future__ import annotations

from datetime import UTC, datetime

from ..telemetry import get_tracer
from .repository import InMemoryShortlinkStore


def resolve(
    store: InMemoryShortlinkStore, tenant_id: str, code: str,
) -> dict:
    """Resolve a short code to its bound app metadata.

    Returns ``{app_id, role, expires_at, created_at}``.
    Raises ``ValueError("shortlink not found")`` when the code is
    unknown for the tenant, and ``ValueError("shortlink expired")``
    when ``expires_at`` is in the past.
    """
    with get_tracer().start_as_current_span("apphub.shortlink.resolve") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.shortlink_code", code)
        entry = store.get_by_code(tenant_id, code)
        if entry is None:
            raise ValueError("shortlink not found")
        if entry.expires_at:
            expires = datetime.fromisoformat(entry.expires_at)
            now = datetime.now(UTC)
            # Normalise naive (tz-naive) expiry timestamps to UTC for compare.
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires < now:
                raise ValueError("shortlink expired")
        return {
            "app_id": entry.app_id,
            "role": entry.role,
            "expires_at": entry.expires_at,
            "created_at": entry.created_at,
        }
