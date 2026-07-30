"""Kafka ACL client (producer + consumer) for the mate-clients layer.

All Kafka access in the platform goes through this module; no
business code imports the raw Kafka client (hard rule 4: external
system without ACL client, business code does not connect directly).
"""
from .consumer import (
    ConsumerError,
    DlqEntry,
    IdempotentConsumer,
    InMemoryDedupStore,
    InMemoryDlq,
    Message,
    ProcessOutcome,
    RedisDedupStore,
    RetryPolicy,
    bind,
    handler,
)
from .producer import KafkaProducer, ProducerError

__all__ = [
    "ConsumerError",
    "DlqEntry",
    "IdempotentConsumer",
    "InMemoryDedupStore",
    "InMemoryDlq",
    "KafkaProducer",
    "Message",
    "ProcessOutcome",
    "ProducerError",
    "RedisDedupStore",
    "RetryPolicy",
    "bind",
    "handler",
]