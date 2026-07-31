"""Repository protocol — the interface all persistence backends implement."""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Repository(Protocol):
    """Marker protocol for tenant-scoped repositories."""

    def list_all(self, tenant_id: str) -> list[Any]: ...

    def get(self, tenant_id: str, entity_id: str) -> Any | None: ...
