"""Search event publishing service (P1-RAG-07).

Implements the Outbox pattern: events are written to the
``rag_search_events`` table (PENDING). A relay method dispatches them
to Kafka. When no Kafka producer is configured, the relay runs in
no-op mode (logs and marks events as SENT).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional, Protocol

from app.config import settings
from app.models.repository import SearchEventRepository
from app.models.schemas import SearchEvent

logger = logging.getLogger("techrag")


class KafkaProducerLike(Protocol):
    """Minimal protocol for a Kafka producer (real or mock)."""

    def send(self, topic: str, value: bytes, headers: list[tuple[str, bytes]]): ...
    def flush(self): ...


class EventService:
    """Publish and relay search events via the Outbox pattern."""

    def __init__(
        self,
        event_repository: SearchEventRepository,
        kafka_producer: Optional[KafkaProducerLike] = None,
    ) -> None:
        self._event_repo = event_repository
        self._kafka_producer = kafka_producer

    async def publish_event(
        self,
        tenant_id: str,
        event_type: str,
        payload: dict[str, Any],
        headers: Optional[dict[str, Any]] = None,
    ) -> SearchEvent:
        """Write a search event to the outbox table.

        *headers* should include ``traceId`` for distributed tracing.
        """

        event = SearchEvent(
            tenant_id=tenant_id,
            event_type=event_type,
            payload=json.dumps(payload, ensure_ascii=False),
            headers=json.dumps(headers, ensure_ascii=False) if headers else None,
            status="PENDING",
        )
        created = await self._event_repo.create(event)
        logger.info(
            "search_event_published id=%s type=%s tenant=%s",
            created.id,
            event_type,
            tenant_id,
        )
        return created

    async def relay_events(self, tenant_id: Optional[str] = None) -> int:
        """Relay PENDING events to Kafka.

        If *tenant_id* is provided, only that tenant's events are relayed.
        Otherwise, all pending events across all tenants are processed.

        When a Kafka producer is configured, events are sent to the topic
        ``{prefix}.Retrieval.{event_type}``. On success, the event is
        marked as SENT. On failure, the retry count is incremented; if
        it exceeds ``max_retries``, the event is marked as DEAD.

        When no Kafka producer is configured (no-op mode), events are
        logged and marked as SENT immediately.

        Returns the number of events successfully relayed.
        """

        if tenant_id is not None:
            pending = await self._event_repo.list_pending(tenant_id)
        else:
            pending = await self._event_repo.list_all_pending()

        count = 0
        for evt in pending:
            success = await self._dispatch(evt)
            if success:
                await self._event_repo.mark_sent(evt.id)
                count += 1
            else:
                await self._event_repo.increment_retry(evt.id)
                if evt.retry_count >= evt.max_retries:
                    await self._event_repo.mark_dead(evt.id)
                    logger.warning(
                        "search_event_dead id=%s retries=%d",
                        evt.id,
                        evt.retry_count,
                    )
        return count

    async def _dispatch(self, event: SearchEvent) -> bool:
        """Send a single event to Kafka. Returns True on success."""

        topic = f"{settings.kafka_topic_prefix}.Retrieval.{event.event_type}"

        # Parse headers from JSON; always include X-Trace-Id.
        msg_headers: list[tuple[str, bytes]] = []
        if event.headers:
            try:
                hdr_dict = json.loads(event.headers)
                trace_id = hdr_dict.get("X-Trace-Id") or hdr_dict.get("traceId", "")
                if trace_id:
                    msg_headers.append(("X-Trace-Id", trace_id.encode("utf-8")))
            except (json.JSONDecodeError, TypeError):
                pass

        payload_bytes = event.payload.encode("utf-8")

        if self._kafka_producer is None:
            # No-op mode: log and succeed.
            logger.info(
                "search_event_relay_noop id=%s topic=%s payload=%s",
                event.id,
                topic,
                event.payload,
            )
            return True

        try:
            self._kafka_producer.send(topic, value=payload_bytes, headers=msg_headers)
            self._kafka_producer.flush()
            logger.info(
                "search_event_relay_sent id=%s topic=%s", event.id, topic
            )
            return True
        except Exception as exc:
            logger.warning(
                "search_event_relay_failed id=%s topic=%s error=%s",
                event.id,
                topic,
                exc,
            )
            return False
