"""Outbox service for Kafka A2A protocol events with trace_id propagation.

Stores events in a pending list and relays them to Kafka via a background
loop. When no Kafka broker is configured (``kafka_bootstrap_servers`` is
empty), events are kept in-memory and marked as relayed (mock mode).

This implements the Outbox pattern mandated by the platform architecture:
Kafka message publishing must use Outbox to prevent data loss.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Dict, List, Optional

from app.events.schemas import EventType, OutboxEvent, event_to_dict

logger = logging.getLogger("tech-a2a.events")


class OutboxService:
    """Outbox pattern implementation with background relay loop."""

    def __init__(
        self,
        kafka_bootstrap_servers: str = "",
        topic: str = "a2a-protocol-events",
    ) -> None:
        self._kafka_bootstrap_servers = kafka_bootstrap_servers
        self._topic = topic
        self._lock = RLock()
        self._pending: List[OutboxEvent] = []
        self._relayed: List[OutboxEvent] = []
        self._relay_task: Optional[asyncio.Task] = None
        self._running = False
        self._producer = None

    async def publish_event(
        self,
        event_type: EventType,
        payload: Dict[str, Any],
        *,
        trace_id: Optional[str] = None,
    ) -> OutboxEvent:
        """Store an event in the pending outbox."""
        event = OutboxEvent(
            event_id=f"evt-{uuid.uuid4().hex[:24]}",
            event_type=event_type,
            payload=payload,
            trace_id=trace_id,
        )
        with self._lock:
            self._pending.append(event)
        return event

    async def relay_pending(self) -> int:
        """Relay all pending events to Kafka. Returns count relayed."""
        with self._lock:
            to_relay = list(self._pending)
            self._pending.clear()

        count = 0
        for event in to_relay:
            try:
                await self._send_to_kafka(event)
                event.relayed = True
                event.relayed_at = datetime.now(timezone.utc)
                count += 1
            except Exception:
                logger.exception("Failed to relay event %s", event.event_id)
                with self._lock:
                    self._pending.append(event)
                break

        with self._lock:
            self._relayed.extend(
                e for e in to_relay if e.relayed
            )
        return count

    async def _send_to_kafka(self, event: OutboxEvent) -> None:
        """Send a single event to Kafka (or mock when no broker)."""
        if not self._kafka_bootstrap_servers:
            # Mock mode: no-op, event is considered delivered.
            return

        if self._producer is None:
            try:
                from kafka import KafkaProducer
                import json

                self._producer = KafkaProducer(
                    bootstrap_servers=self._kafka_bootstrap_servers,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    key_serializer=lambda k: k.encode("utf-8") if k else None,
                )
            except ImportError:
                logger.warning(
                    "kafka-python not installed, falling back to mock mode"
                )
                return

        import json

        headers = []
        if event.trace_id:
            headers.append(("X-Trace-Id", event.trace_id.encode("utf-8")))

        self._producer.send(
            self._topic,
            key=event.event_id,
            value=event_to_dict(event),
            headers=headers,
        )

    def start_relay_loop(self, interval: float = 1.0) -> None:
        """Start the background relay loop."""
        if self._running:
            return
        self._running = True

        async def _loop():
            while self._running:
                try:
                    await self.relay_pending()
                except Exception:
                    logger.exception("Relay loop error")
                await asyncio.sleep(interval)

        try:
            loop = asyncio.get_running_loop()
            self._relay_task = loop.create_task(_loop())
        except RuntimeError:
            self._running = False

    def stop_relay_loop(self) -> None:
        """Stop the background relay loop."""
        self._running = False
        if self._relay_task:
            self._relay_task.cancel()
            self._relay_task = None

    async def get_pending_events(self) -> List[OutboxEvent]:
        with self._lock:
            return list(self._pending)

    async def get_relayed_events(self) -> List[OutboxEvent]:
        with self._lock:
            return list(self._relayed)

    def clear(self) -> None:
        with self._lock:
            self._pending.clear()
            self._relayed.clear()
