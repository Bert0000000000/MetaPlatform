from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class DomainEvent:
    name: str
    trace_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
