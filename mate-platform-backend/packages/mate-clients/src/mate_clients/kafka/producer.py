"""Kafka producer factory for the mate-clients ACL layer.

A `KafkaProducer` instance knows how to:
  - Serialize an Event to JSON.
  - Attach standard headers (tenant_id, event_id, event_type, trace_id).
  - Call the underlying Kafka client (real one in production, fake
    here for tests).

Business code never imports the underlying Kafka client directly
(hard rule 4: external system without ACL client, business code does
not connect directly).
"""
from __future__ import annotations

import json
import logging
from typing import Protocol

from mate_platform.messaging.events import Event

logger = logging.getLogger(__name__)


class ProducerError(Exception):
    """Raised when a Kafka send fails."""


class UnderlyingProducer(Protocol):
    """The actual Kafka client (confluent-kafka, aiokafka, etc.)."""

    def produce(self, topic: str, *, key: bytes, value: bytes, headers: list[tuple[str, bytes]]) -> None:
        ...

    def flush(self, timeout_seconds: float = 5.0) -> int:
        ...


class KafkaProducer:
    """High-level producer used by OutboxRelay and direct publish.

    The send() method does the right thing for SEC-TENANT-01: the
    tenant_id is in the Event AND in the headers, so consumers can
    assert either way.
    """

    def __init__(self, client: UnderlyingProducer) -> None:
        self._client = client

    def send(self, *, topic: str, key: str, value: bytes, headers: dict[str, str]) -> None:
        encoded_headers = [(k, v.encode("utf-8")) for k, v in headers.items()]
        try:
            self._client.produce(
                topic,
                key=key.encode("utf-8"),
                value=value,
                headers=encoded_headers,
            )
        except Exception as exc:
            raise ProducerError(f"kafka send to {topic!r} failed: {exc}") from exc

    def flush(self, timeout_seconds: float = 5.0) -> int:
        return self._client.flush(timeout_seconds=timeout_seconds)

    @staticmethod
    def serialize_event(event: Event) -> bytes:
        return json.dumps(
            event.to_dict(), separators=(",", ":"), sort_keys=True
        ).encode("utf-8")
