from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class OutboxEvent:
    event_id: str
    aggregate_id: str
    name: str
    payload: dict[str, Any]


class OutboxWriter(Protocol):
    async def append(self, event: OutboxEvent) -> None: ...


class OutboxPublisher(Protocol):
    async def publish_pending(self) -> int: ...
