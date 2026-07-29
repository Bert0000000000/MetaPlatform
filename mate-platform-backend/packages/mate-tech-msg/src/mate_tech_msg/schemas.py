"""Message models (ST-5.1.2).

泛型消息：payload + headers + traceId + tenantId + key + timestamp.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, TypeVar

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class Message[T]:
    """泛型消息."""

    payload: T
    headers: dict[str, str] = field(default_factory=dict)
    trace_id: str | None = None
    tenant_id: str = "default"
    key: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_kafka_headers(self) -> list[tuple[str, bytes]]:
        result: list[tuple[str, bytes]] = []
        if self.trace_id:
            result.append(("trace_id", self.trace_id.encode()))
        result.append(("tenant_id", self.tenant_id.encode()))
        for k, v in self.headers.items():
            result.append((k, v.encode()))
        return result


@dataclass(frozen=True, slots=True)
class PublishRequest:
    topic: str
    payload: dict[str, Any]
    partition_key: str | None = None
    idempotency_key: str | None = None


@dataclass(frozen=True, slots=True)
class PublishResponse:
    topic: str
    partition: int
    offset: int
    idempotency_hit: bool = False
