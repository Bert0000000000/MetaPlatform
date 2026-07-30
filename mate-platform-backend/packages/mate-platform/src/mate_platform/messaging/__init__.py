"""Messaging primitives: outbox + relay + event envelope + schema registry.

Reused by every domain that publishes events. The outbox lives in
the same database as the business table; the relay drains it to
Kafka with at-least-once + idempotency (via the consumer's Redis
dedup key). See ADR-0013 for the full decision record.
"""
from .events import Event, new_event_id
from .kafka_tenant import (
    KafkaTopicError,
    assert_message_tenant,
    consumer_group,
    topic_name,
)
from .outbox import (
    EventTypeTopicResolver,
    InMemoryOutboxWriter,
    OutboxError,
    OutboxRecord,
    OutboxRelay,
    OutboxWriter,
    Producer,
    TopicResolver,
)
from .schemas import (
    InMemorySchemaRegistry,
    SchemaError,
    SchemaRegistry,
    schema_id_for,
    validate_event_type,
)

__all__ = [
    "Event",
    "EventTypeTopicResolver",
    "InMemoryOutboxWriter",
    "InMemorySchemaRegistry",
    "KafkaTopicError",
    "OutboxError",
    "OutboxRecord",
    "OutboxRelay",
    "OutboxWriter",
    "Producer",
    "SchemaError",
    "SchemaRegistry",
    "TopicResolver",
    "assert_message_tenant",
    "consumer_group",
    "new_event_id",
    "schema_id_for",
    "topic_name",
    "validate_event_type",
]