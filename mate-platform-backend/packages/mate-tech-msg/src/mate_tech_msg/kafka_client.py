"""Kafka client (ST-5.1.3).

aiokafka Producer / Consumer 封装。
"""
from __future__ import annotations

import os
from typing import Any

import structlog
from aiokafka import AIOKafkaProducer

logger = structlog.get_logger(__name__)


class KafkaClient:
    def __init__(
        self,
        *,
        bootstrap_servers: str | None = None,
        client_id: str = "mate-tech-msg",
    ) -> None:
        self._bootstrap = bootstrap_servers or os.getenv(
            "KAFKA_BOOTSTRAP", "localhost:9092"
        )
        self._client_id = client_id
        self._producer: AIOKafkaProducer | None = None

    async def start_producer(self) -> None:
        if self._producer is not None:
            return
        self._producer = AIOKafkaProducer(
            bootstrap_servers=self._bootstrap,
            client_id=f"{self._client_id}-producer",
            value_serializer=lambda v: str(v).encode(),
            key_serializer=lambda k: k.encode() if k else None,
        )
        await self._producer.start()
        logger.info("kafka.producer.started", servers=self._bootstrap)

    async def stop_producer(self) -> None:
        if self._producer is not None:
            await self._producer.stop()
            self._producer = None

    async def send(
        self,
        topic: str,
        value: Any,
        *,
        key: str | None = None,
        headers: list[tuple[str, bytes]] | None = None,
    ) -> tuple[int, int]:
        if self._producer is None:
            await self.start_producer()
        assert self._producer is not None
        meta = await self._producer.send_and_wait(
            topic, value=value, key=key, headers=headers
        )
        logger.info("kafka.sent", topic=topic, partition=meta.partition, offset=meta.offset)
        return meta.partition, meta.offset


def create_kafka_client() -> KafkaClient:
    return KafkaClient()
