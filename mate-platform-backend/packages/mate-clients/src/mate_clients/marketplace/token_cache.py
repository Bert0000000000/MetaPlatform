"""OCI v2 token 1h 短效缓存(Redis)。"""
from __future__ import annotations

import json
import time

import redis.asyncio as redis


class TokenCache:
    KEY = "mp:oci:token:{registry}:{kind}:{artifact_id}"

    def __init__(self, redis_url: str, ttl_seconds: int = 3600):
        self.redis = redis.from_url(redis_url)
        self.ttl = ttl_seconds

    async def get(
        self, registry: str, kind: str, artifact_id: str
    ) -> str | None:
        key = self.KEY.format(
            registry=registry, kind=kind, artifact_id=artifact_id
        )
        raw = await self.redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)["token"]

    async def set(
        self, registry: str, kind: str, artifact_id: str, token: str
    ) -> None:
        key = self.KEY.format(
            registry=registry, kind=kind, artifact_id=artifact_id
        )
        await self.redis.setex(
            key,
            self.ttl,
            json.dumps({"token": token, "ts": time.time()}),
        )

    async def close(self) -> None:
        await self.redis.close()