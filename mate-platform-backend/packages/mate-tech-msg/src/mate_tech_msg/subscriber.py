"""Subscriber worker (ST-5.1.5) + DLQ (ST-5.1.6).

consumer group = tech-msg，自动拉取 → 调本地 handler。
失败 3 次 → DLQ topic (mate.msg.dlq).
"""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import structlog
from aiokafka import AIOKafkaConsumer

logger = structlog.get_logger(__name__)

DLQ_TOPIC = "mate.msg.dlq"
MAX_RETRIES = 3
DEFAULT_GROUP = "tech-msg"


Handler = Callable[[dict[str, Any], dict[str, bytes]], Awaitable[None]]


class Subscriber:
    """Consumer group subscriber.

    Usage:
        sub = Subscriber(kafka_client, handler=my_handler)
        await sub.start()
        await sub.run_forever()
    """

    def __init__(
        self,
        *,
        bootstrap_servers: str | None = None,
        topics: list[str],
        group_id: str = DEFAULT_GROUP,
        handler: Handler | None = None,
        max_retries: int = MAX_RETRIES,
        dlq_topic: str = DLQ_TOPIC,
    ) -> None:
        self._bootstrap = bootstrap_servers
        self._topics = topics
        self._group_id = group_id
        self._handler = handler
        self._max_retries = max_retries
        self._dlq_topic = dlq_topic
        self._consumer: AIOKafkaConsumer | None = None

    async def start(self) -> None:
        """启动 consumer."""
        import os
        self._consumer = AIOKafkaConsumer(
            *self._topics,
            bootstrap_servers=self._bootstrap or os.getenv("KAFKA_BOOTSTRAP", "localhost:9092"),
            group_id=self._group_id,
            value_deserializer=lambda v: v.decode() if isinstance(v, bytes) else v,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
        )
        await self._consumer.start()
        logger.info(
            "subscriber.started",
            topics=self._topics,
            group_id=self._group_id,
        )

    async def stop(self) -> None:
        if self._consumer is not None:
            await self._consumer.stop()
            self._consumer = None

    async def process_one(self) -> None:
        """处理单条消息（可独立测试）."""
        assert self._consumer is not None
        msg = await self._consumer.getone()
        # 重试计数：3 次后入 DLQ
        attempts = 0
        last_exc: Exception | None = None
        while attempts < self._max_retries:
            try:
                if self._handler:
                    # value 是 bytes 或 dict（取决于 deserializer）
                    value = msg.value
                    headers = dict(msg.headers or [])
                    if hasattr(value, "decode"):
                        import json
                        value = json.loads(value.decode())
                    await self._handler(value, headers)
                # 成功：提交 offset
                await self._consumer.commit()
                logger.info(
                    "subscriber.handled",
                    topic=msg.topic,
                    partition=msg.partition,
                    offset=msg.offset,
                )
                return
            except Exception as e:
                attempts += 1
                last_exc = e
                logger.warning(
                    "subscriber.handler_failed",
                    attempt=attempts,
                    error=str(e),
                )
                await asyncio.sleep(0.1)

        # 3 次失败 → DLQ
        logger.error(
            "subscriber.dlq",
            topic=msg.topic,
            partition=msg.partition,
            offset=msg.offset,
            last_error=str(last_exc),
        )
        # In production, send to a DLQ topic; here we only log.
