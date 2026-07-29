"""Publisher service (ST-5.1.4).

publish API:
- POST /api/v1/msg/publish
- 甯?idempotency_key
- 榛樿 partition_key = tenantId
"""
from __future__ import annotations

import structlog

from .dedup import DedupStore
from .kafka_client import KafkaClient
from .schemas import PublishRequest, PublishResponse

logger = structlog.get_logger(__name__)


class Publisher:
    """鍙戝竷鍣細dedup 鈫?Kafka send."""

    def __init__(
        self,
        kafka: KafkaClient,
        dedup: DedupStore | None = None,
        *,
        default_partition_key_field: str = "tenant_id",
    ) -> None:
        self._kafka = kafka
        self._dedup = dedup or DedupStore()
        self._default_partition_key_field = default_partition_key_field

    async def publish(self, req: PublishRequest) -> PublishResponse:
        """鍙戝竷娑堟伅鍒?Kafka.

        Args:
            req: PublishRequest(topic, payload, partition_key, idempotency_key)

        Returns:
            PublishResponse(topic, partition, offset, idempotency_hit)
        """
        # 1. 骞傜瓑妫€鏌?        idempotency_hit = False
        if req.idempotency_key:
            result = await self._dedup.check_and_store(
                key=req.idempotency_key,
                payload_id=f"{req.topic}:{req.partition_key}",
            )
            if result.hit:
                logger.info(
                    "publisher.idempotency_hit",
                    key=req.idempotency_key,
                )
                # 鍛戒腑锛氳繑鍥炶櫄鎷熷搷搴旓紙涓嶇湡鍙戯級
                return PublishResponse(
                    topic=req.topic,
                    partition=-1,
                    offset=-1,
                    idempotency_hit=True,
                )

        # 2. Compute partition key (default: tenantId)
        partition_key = req.partition_key
        if partition_key is None:
            payload_dict = req.payload if isinstance(req.payload, dict) else {}
            partition_key = str(
                payload_dict.get(self._default_partition_key_field, "default")
            )

        # 3. 鍙戦€佸埌 Kafka
        partition, offset = await self._kafka.send(
            req.topic,
            req.payload,
            key=partition_key,
        )
        logger.info(
            "publisher.sent",
            topic=req.topic,
            partition=partition,
            offset=offset,
            key=partition_key,
        )
        return PublishResponse(
            topic=req.topic,
            partition=partition,
            offset=offset,
            idempotency_hit=False,
        )
