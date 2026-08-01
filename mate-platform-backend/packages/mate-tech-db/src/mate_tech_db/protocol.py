"""Repository protocol — the interface all persistence backends implement.

Extended in P3-W1 (TD-5 持久化升级) to cover the full CRUD surface.
Both in-memory and SQL backends implement this protocol so the API
layer is agnostic to the storage choice.
"""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Repository(Protocol):
    """Marker protocol for tenant-scoped repositories.

    Implementations MUST enforce tenant isolation at every method
    (硬规则 3: no repository access without tenant context).
    """

    def list_all(self, tenant_id: str) -> list[Any]:
        """List all entities for a tenant."""
        ...

    def get(self, tenant_id: str, entity_id: str) -> Any | None:
        """Get a single entity by id. Returns None if not found."""
        ...


@runtime_checkable
class WritableRepository(Repository, Protocol):
    """Extended protocol for repositories that support write operations."""

    def put(self, tenant_id: str, entity: Any) -> Any:
        """Insert or update an entity (upsert). Returns the persisted entity."""
        ...

    def delete(self, tenant_id: str, entity_id: str) -> bool:
        """Delete an entity. Returns True if removed, False if not found."""
        ...

    def count(self, tenant_id: str) -> int:
        """Count entities for a tenant."""
        ...
