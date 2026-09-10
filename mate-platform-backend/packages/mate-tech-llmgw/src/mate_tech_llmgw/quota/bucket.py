"""Redis rate limiting (ST-5.5.4.1, P3 atomic close-out 2026-09-09).

每租户 RPM + TPM 限制（固定分钟窗口）。

P3 changes:
- check + increment run in ONE Lua script (the legacy INCR-then-check
  pipeline had a race: concurrent requests could all pass the check
  before any counter landed, overselling the limit);
- EXPIRE is set only when a key is first created (the legacy code reset
  the TTL on every request);
- per-tenant limits resolve through TenantConfigProvider
  (Redis read-through cache → PG llmgw_tenant_config → QuotaConfig
  defaults), so operators can raise/lower a single tenant's limits
  without a redeploy. Rejected requests still consume the window slot
  (documented semantics — rolling back the INCR would race).
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

import redis.asyncio as redis
import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class QuotaConfig:
    """每租户的配额配置."""

    rpm_limit: int = 100       # requests per minute
    tpm_limit: int = 100_000   # tokens per minute
    window_sec: int = 60


class QuotaExceededError(Exception):
    """触发限流时抛出."""

    def __init__(self, key: str, retry_after: int) -> None:
        super().__init__(f"Quota exceeded for {key}; retry after {retry_after}s")
        self.key = key
        self.retry_after = retry_after


# KEYS[1]=req key  KEYS[2]=tok key
# ARGV: rpm_limit, tpm_limit, estimated_tokens, window_sec, now_epoch
# Returns {allowed, req_count, tok_count, retry_after, reason_idx}
# reason: 0=ok, 1=rpm, 2=tpm. EXPIRE only on key creation.
_RATELIMIT_LUA = """
local req = redis.call('INCR', KEYS[1])
if req == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]) * 2)
end
local tok = redis.call('INCRBY', KEYS[2], ARGV[3])
if tok == tonumber(ARGV[3]) then
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]) * 2)
end
local retry = tonumber(ARGV[4]) - (math.floor(tonumber(ARGV[5])) % tonumber(ARGV[4]))
if req > tonumber(ARGV[1]) then
  return {0, req, tok, retry, 1}
end
if tok > tonumber(ARGV[2]) then
  return {0, req, tok, retry, 2}
end
return {1, req, tok, 0, 0}
"""


@dataclass(frozen=True, slots=True)
class Decision:
    """Pure window decision (unit-testable without Redis)."""

    allowed: bool
    reason: str = ""            # "" | "rpm" | "tpm"
    req_count: int = 0
    tok_count: int = 0
    retry_after: int = 0


def decide(req_count: int, tok_count: int, cfg: QuotaConfig, *, now: int) -> Decision:
    """Evaluate a (possibly already incremented) window against the config."""
    retry_after = max(cfg.window_sec - (now % cfg.window_sec), 1)
    if req_count > cfg.rpm_limit:
        return Decision(False, "rpm", req_count, tok_count, retry_after)
    if tok_count > cfg.tpm_limit:
        return Decision(False, "tpm", req_count, tok_count, retry_after)
    return Decision(True, "", req_count, tok_count, 0)


class TenantConfigProvider:
    """Per-tenant quota limits: Redis cache (TTL) → PG → built-in defaults."""

    _CACHE_TTL_SEC = 300

    def __init__(
        self,
        pg_pool: Any | None = None,
        redis_client: Any | None = None,
        ttl_sec: int = _CACHE_TTL_SEC,
        default: QuotaConfig | None = None,
    ) -> None:
        self._pool = pg_pool
        self._redis = redis_client
        self._ttl = ttl_sec
        self._default = default or QuotaConfig()
        self._local: dict[str, QuotaConfig] = {}

    async def resolve(self, tenant_id: str) -> QuotaConfig:
        """Best-effort tenant limits; any failure falls back to defaults."""
        if self._redis is not None:
            try:
                cached = await self._redis.get(f"llmgw:tenantcfg:{tenant_id}")
                if cached:
                    return _cfg_from_json(cached)
            except Exception as exc:
                logger.warning("llmgw.tenantcfg.cache_read_failed", error=str(exc))

        if tenant_id in self._local:
            return self._local[tenant_id]

        cfg = self._default
        if self._pool is not None:
            try:
                async with self._pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """
                        SELECT rpm_limit, tpm_limit, window_sec FROM (
                          SELECT rpm_limit, tpm_limit, 60 AS window_sec
                          FROM llmgw_tenant_config WHERE tenant_id = $1
                        ) sub
                        """,
                        tenant_id,
                    )
                if row is not None:
                    cfg = QuotaConfig(
                        rpm_limit=int(row["rpm_limit"]),
                        tpm_limit=int(row["tpm_limit"]),
                        window_sec=int(row["window_sec"]),
                    )
            except Exception as exc:
                logger.warning("llmgw.tenantcfg.pg_read_failed", error=str(exc))

        self._local[tenant_id] = cfg
        if self._redis is not None:
            try:
                import json

                await self._redis.setex(
                    f"llmgw:tenantcfg:{tenant_id}",
                    self._ttl,
                    json.dumps(
                        {
                            "rpm_limit": cfg.rpm_limit,
                            "tpm_limit": cfg.tpm_limit,
                            "window_sec": cfg.window_sec,
                        }
                    ),
                )
            except Exception as exc:
                logger.warning("llmgw.tenantcfg.cache_write_failed", error=str(exc))
        return cfg

    async def invalidate(self, tenant_id: str) -> None:
        """Drop cached limits (management endpoint calls this after an update)."""
        self._local.pop(tenant_id, None)
        if self._redis is not None:
            try:
                await self._redis.delete(f"llmgw:tenantcfg:{tenant_id}")
            except Exception as exc:
                logger.warning("llmgw.tenantcfg.invalidate_failed", error=str(exc))


def _cfg_from_json(raw: str) -> QuotaConfig:
    import json

    data = json.loads(raw)
    return QuotaConfig(
        rpm_limit=int(data.get("rpm_limit", 100)),
        tpm_limit=int(data.get("tpm_limit", 100_000)),
        window_sec=int(data.get("window_sec", 60)),
    )


class RedisTokenBucket:
    """基于 Redis 的固定分钟窗口限流（P3: Lua 原子化 + per-tenant 配置）.

    使用两个 key:
    - req:{tenant}:{minute}    -> 当前分钟已用 request 数
    - tok:{tenant}:{minute}    -> 当前分钟已用 token 数
    """

    def __init__(
        self,
        redis_client: redis.Redis | None = None,
        config: QuotaConfig | None = None,
        tenant_config: TenantConfigProvider | None = None,
    ) -> None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis = redis_client or redis.from_url(url, decode_responses=True)
        self._config = config or QuotaConfig()
        self._tenant_config = tenant_config

    async def _limits_for(self, tenant_id: str) -> QuotaConfig:
        if self._tenant_config is None:
            return self._config
        try:
            return await self._tenant_config.resolve(tenant_id)
        except Exception as exc:
            logger.warning("llmgw.tenantcfg.resolve_failed", error=str(exc))
            return self._config

    async def acquire(
        self,
        *,
        tenant_id: str,
        estimated_tokens: int = 0,
    ) -> None:
        """检查并扣减配额;超额抛 QuotaExceededError.

        Args:
            tenant_id: 租户 id
            estimated_tokens: 预估本次请求 token 数(TPM)

        Raises:
            QuotaExceededError: RPM 或 TPM 超限
        """
        cfg = await self._limits_for(tenant_id)
        minute = int(time.time()) // cfg.window_sec
        req_key = f"req:{tenant_id}:{minute}"
        tok_key = f"tok:{tenant_id}:{minute}"

        try:
            result = await self._redis.eval(
                _RATELIMIT_LUA,
                2,
                req_key,
                tok_key,
                cfg.rpm_limit,
                cfg.tpm_limit,
                max(int(estimated_tokens), 0),
                cfg.window_sec,
                int(time.time()),
            )
        except Exception as exc:
            logger.warning("llmgw.quota.acquire_degraded", tenant=tenant_id, error=str(exc))
            return

        allowed, req_count, tok_count, retry_after, reason_idx = (
            int(result[0]), int(result[1]), int(result[2]), int(result[3]), int(result[4])
        )
        if not allowed:
            reason = "rpm" if reason_idx == 1 else "tpm"
            key = req_key if reason == "rpm" else tok_key
            logger.warning(
                "quota.exceeded." + reason,
                tenant=tenant_id,
                count=req_count if reason == "rpm" else tok_count,
            )
            raise QuotaExceededError(key, retry_after)

        logger.debug("quota.acquired", tenant=tenant_id, req=req_count, tok=tok_count)

    async def close(self) -> None:
        await self._redis.aclose()

    async def status(self, tenant_id: str) -> dict[str, Any]:
        """返回某租户当前配额使用状态."""
        cfg = await self._limits_for(tenant_id)
        minute = int(time.time()) // cfg.window_sec
        req_key = f"req:{tenant_id}:{minute}"
        tok_key = f"tok:{tenant_id}:{minute}"
        req_count = await self._redis.get(req_key)
        tok_count = await self._redis.get(tok_key)
        return {
            "tenant_id": tenant_id,
            "rpm_used": int(req_count or 0),
            "rpm_limit": cfg.rpm_limit,
            "tpm_used": int(tok_count or 0),
            "tpm_limit": cfg.tpm_limit,
            "window_sec": cfg.window_sec,
        }
