"""Idempotency via Redis SETNX (ST-5.1.8)."""
from __future__ import annotations

import os
from dataclasses import dataclass

import redis.asyncio as redis
import structlog

logger = structlog.get_logger(__name__)

DEFAULT_TTL_SEC = 7 * 24 * 3600  # 7 天


@dataclass(frozen=True, slots=True)
class DedupResult:
    hit: bool
    stored: bool


class DedupStore:
    def __init__(
        self,
        redis_client: redis.Redis | None = None,
        ttl_sec: int = DEFAULT_TTL_SEC,
    ) -> None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis = redis_client or redis.from_url(url, decode_responses=True)
        self._ttl = ttl_sec

    async def check_and_store(self, *, key: str, payload_id: str) -> DedupResult:
        full_key = f"dedup:{key}"
        stored = await self._redis.set(full_key, payload_id, ex=self._ttl, nx=True)
        if stored:
            return DedupResult(hit=False, stored=True)
        existing = await self._redis.get(full_key)
        logger.info("dedup.hit", key=key, existing=existing)
        return DedupResult(hit=True, stored=False)

    async def close(self) -> None:
        await self._redis.aclose()
