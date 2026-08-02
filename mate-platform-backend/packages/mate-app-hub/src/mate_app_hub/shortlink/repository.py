"""In-memory tenant-scoped short-link store (APPHUB-RUNTIME-01 phase C).

Data shape:
    _store: outer key = tenant_id (string)
            inner key = code (string)
            value    = ShortlinkEntry

The store is tenant-scoped: every lookup requires the tenant binding
and rejects entries that don't belong to that tenant. This is the
layer at which the ADR-0014 cross-tenant rule is enforced (mirrors
``repositories.in_memory``).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ShortlinkEntry:
    id: str
    tenant_id: str
    app_id: str
    code: str
    role: str | None = None
    expires_at: str | None = None
    created_at: str = ""


class InMemoryShortlinkStore:
    def __init__(self) -> None:
        self._store: dict[str, dict[str, ShortlinkEntry]] = {}

    def put(self, entry: ShortlinkEntry) -> ShortlinkEntry:
        self._store.setdefault(entry.tenant_id, {})[entry.code] = entry
        return entry

    def get_by_code(self, tenant_id: str, code: str) -> ShortlinkEntry | None:
        return self._store.get(tenant_id, {}).get(code)

    def list(self, tenant_id: str) -> list[ShortlinkEntry]:
        return list(self._store.get(tenant_id, {}).values())

    def delete(self, tenant_id: str, code: str) -> bool:
        return self._store.get(tenant_id, {}).pop(code, None) is not None

    def exists(self, tenant_id: str, code: str) -> bool:
        return code in self._store.get(tenant_id, {})

    def reset(self) -> None:
        self._store.clear()
