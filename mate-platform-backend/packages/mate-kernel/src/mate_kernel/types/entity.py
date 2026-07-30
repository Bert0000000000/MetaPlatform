from typing import Protocol, runtime_checkable


@runtime_checkable
class Entity(Protocol):
    """Aggregate root contract. Implementations must expose entity_id()."""

    def entity_id(self) -> str: ...
