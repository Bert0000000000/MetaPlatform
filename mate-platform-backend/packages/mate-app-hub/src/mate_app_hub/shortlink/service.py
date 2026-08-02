"""Short-link service facade (APPHUB-RUNTIME-01 phase C).

Thin orchestration layer over ``generator`` + ``repository`` +
``resolver``. Holds the module-level default store used by the
HTTP endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone

from .generator import generate_code
from .repository import InMemoryShortlinkStore, ShortlinkEntry
from .resolver import resolve

_MAX_COLLISION_RETRIES = 3


def create_shortlink(
    store: InMemoryShortlinkStore,
    tenant_id: str,
    app_id: str,
    role: str | None = None,
) -> ShortlinkEntry:
    """Generate a unique code and persist a new ShortlinkEntry."""
    code: str | None = None
    for _ in range(_MAX_COLLISION_RETRIES):
        candidate = generate_code()
        if not store.exists(tenant_id, candidate):
            code = candidate
            break
    if code is None:
        raise ValueError("code collision after 3 retries")
    now = datetime.now(timezone.utc).isoformat()
    entry = ShortlinkEntry(
        id=f"sl-{code}",
        tenant_id=tenant_id,
        app_id=app_id,
        code=code,
        role=role,
        created_at=now,
    )
    store.put(entry)
    return entry


def resolve_shortlink(
    store: InMemoryShortlinkStore, tenant_id: str, code: str,
) -> dict:
    """Delegate to ``resolver.resolve``."""
    return resolve(store, tenant_id, code)


def list_shortlinks(
    store: InMemoryShortlinkStore, tenant_id: str,
) -> list[ShortlinkEntry]:
    """Return all shortlinks for a tenant."""
    return store.list(tenant_id)


def revoke_shortlink(
    store: InMemoryShortlinkStore, tenant_id: str, code: str,
) -> bool:
    """Delete a shortlink by code. Returns True if deleted."""
    return store.delete(tenant_id, code)


# ---------------------------------------------------------------------------
# Module-level default store (used by the HTTP endpoints)
# ---------------------------------------------------------------------------
_default_store = InMemoryShortlinkStore()


def get_default_store() -> InMemoryShortlinkStore:
    return _default_store
