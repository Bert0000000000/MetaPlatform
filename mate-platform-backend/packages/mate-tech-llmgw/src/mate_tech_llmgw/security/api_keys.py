"""Consumer virtual API keys (P5, LiteLLM VerificationToken pattern).

Key lifecycle: ``sk-llmgw-<random>`` plaintext is shown ONCE at creation;
only its sha256 is stored (hard rule 12 — no recoverable secrets in git
or DB). Budgets accumulate on the key row (spend-on-key) plus the P1
daily rollup; revocation invalidates the Redis cache immediately,
otherwise cache TTL bounds revocation latency at 30s.

The verifier is handed to ``mate_platform.auth.install_auth`` as the
optional ``api_key_verifier`` hook: JWT stays the primary path, and a
``sk-llmgw-*`` bearer falls through to this verifier.
"""
from __future__ import annotations

import fnmatch
import hashlib
import json
import secrets
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId

logger = structlog.get_logger(__name__)

KEY_PREFIX = "sk-llmgw-"
_CACHE_TTL_SEC = 30
_BUDGET_DURATIONS = {"1d": 86_400, "7d": 7 * 86_400, "30d": 30 * 86_400}


class ApiKeyRejected(Exception):
    """Key unknown/blocked/expired — maps to 401/403 at the middleware."""


@dataclass(frozen=True, slots=True)
class ApiKeyRecord:
    key_id: str
    tenant_id: str
    key_name: str
    key_prefix: str
    models: tuple[str, ...]
    max_budget_usd: float | None
    soft_budget_usd: float | None
    budget_duration: str | None
    budget_reset_at: datetime | None
    tpm_limit: int | None
    rpm_limit: int | None
    spend_usd: float
    blocked: bool
    expires_at: datetime | None
    last_active_at: datetime | None


def generate_api_key() -> tuple[str, str, str]:
    """Return (plaintext, sha256_hex, prefix8)."""
    plaintext = KEY_PREFIX + secrets.token_urlsafe(32)
    return plaintext, hash_key(plaintext), plaintext[:11]


def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def parse_duration(duration: str | None) -> int | None:
    if not duration:
        return None
    return _BUDGET_DURATIONS.get(duration)


class ApiKeyStore:
    """asyncpg-backed key CRUD (soft dependency)."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def create(
        self,
        *,
        tenant_id: str,
        key_name: str = "",
        models: tuple[str, ...] | list[str] = (),
        max_budget_usd: float | None = None,
        soft_budget_usd: float | None = None,
        budget_duration: str | None = None,
        tpm_limit: int | None = None,
        rpm_limit: int | None = None,
        expires_at: datetime | None = None,
        created_by: str = "",
    ) -> tuple[ApiKeyRecord, str]:
        plaintext, key_hash, key_prefix = generate_api_key()
        key_id = "key-" + secrets.token_hex(8)
        reset_at = None
        duration_sec = parse_duration(budget_duration)
        if duration_sec:
            reset_at = datetime.now(UTC) + timedelta(seconds=duration_sec)

        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO llmgw_api_keys
                  (key_id, tenant_id, key_name, key_hash, key_prefix, models,
                   max_budget_usd, soft_budget_usd, budget_duration,
                   budget_reset_at, tpm_limit, rpm_limit, blocked, expires_at,
                   created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                        FALSE, $13, $14)
                """,
                key_id, tenant_id, key_name, key_hash, key_prefix,
                json.dumps(list(models)), max_budget_usd, soft_budget_usd,
                budget_duration, reset_at, tpm_limit, rpm_limit,
                expires_at, created_by,
            )
        record = await self._get_by_hash(key_hash)
        # (record may be None only if the row vanished immediately; the
        # caller still receives the plaintext + a reconstructed record.)
        if record is None:
            record = ApiKeyRecord(
                key_id=key_id, tenant_id=tenant_id, key_name=key_name,
                key_prefix=key_prefix, models=tuple(models),
                max_budget_usd=max_budget_usd, soft_budget_usd=soft_budget_usd,
                budget_duration=budget_duration, budget_reset_at=reset_at,
                tpm_limit=tpm_limit, rpm_limit=rpm_limit, spend_usd=0.0,
                blocked=False, expires_at=expires_at, last_active_at=None,
            )
        return record, plaintext

    async def verify(self, plaintext: str) -> ApiKeyRecord:
        """Look up by hash; raise ApiKeyRejected for unknown/blocked/expired."""
        record = await self._get_by_hash(hash_key(plaintext))
        if record is None:
            raise ApiKeyRejected("unknown api key")
        if record.blocked:
            raise ApiKeyRejected("api key revoked")
        if record.expires_at is not None and record.expires_at <= datetime.now(UTC):
            raise ApiKeyRejected("api key expired")
        return record

    async def _get_by_hash(self, key_hash: str) -> ApiKeyRecord | None:
        async with self._pool.acquire() as conn:
            return await self._fetch_one(conn, key_hash)

    async def _fetch_one(self, conn: Any, key_hash: str) -> ApiKeyRecord | None:
        row = await conn.fetchrow(
            """
            SELECT key_id, tenant_id, key_name, key_prefix, models,
                   max_budget_usd, soft_budget_usd, budget_duration,
                   budget_reset_at, tpm_limit, rpm_limit, spend_usd,
                   blocked, expires_at, last_active_at
            FROM llmgw_api_keys WHERE key_hash = $1
            """,
            key_hash,
        )
        return _row_to_record(row) if row else None

    async def revoke(self, tenant_id: str, key_id: str) -> bool:
        async with self._pool.acquire() as conn:
            row = await conn.execute(
                """
                UPDATE llmgw_api_keys SET blocked = TRUE
                WHERE key_id = $1 AND tenant_id = $2
                """,
                key_id, tenant_id,
            )
        return "UPDATE 1" in str(row)

    async def key_hash_for(self, key_id: str) -> str | None:
        """Current hash of a key (cache invalidation after revoke/rotate)."""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT key_hash FROM llmgw_api_keys WHERE key_id = $1", key_id
            )
        return str(row["key_hash"]) if row else None

    async def rotate(self, tenant_id: str, key_id: str) -> tuple[ApiKeyRecord, str] | None:
        """Revoke the old secret and issue a new one under the same key_id."""
        plaintext, key_hash, key_prefix = generate_api_key()
        async with self._pool.acquire() as conn:
            row = await conn.execute(
                """
                UPDATE llmgw_api_keys
                   SET key_hash = $3, key_prefix = $4, blocked = FALSE,
                       last_active_at = NULL
                 WHERE key_id = $1 AND tenant_id = $2
                """,
                key_id, tenant_id, key_hash, key_prefix,
            )
            if "UPDATE 1" not in str(row):
                return None
            record = await conn.fetchrow(
                """
                SELECT key_id, tenant_id, key_name, key_prefix, models,
                       max_budget_usd, soft_budget_usd, budget_duration,
                       budget_reset_at, tpm_limit, rpm_limit, spend_usd,
                       blocked, expires_at, last_active_at
                FROM llmgw_api_keys WHERE key_id = $1
                """,
                key_id,
            )
        return _row_to_record(record), plaintext

    async def list_keys(self, tenant_id: str) -> list[ApiKeyRecord]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT key_id, tenant_id, key_name, key_prefix, models,
                       max_budget_usd, soft_budget_usd, budget_duration,
                       budget_reset_at, tpm_limit, rpm_limit, spend_usd,
                       blocked, expires_at, last_active_at
                FROM llmgw_api_keys WHERE tenant_id = $1
                ORDER BY created_at DESC
                """,
                tenant_id,
            )
        return [_row_to_record(r) for r in rows]

    async def advance_budget_window(self, record: ApiKeyRecord) -> ApiKeyRecord:
        """Lazily roll an expired budget window and reset the spend counter."""
        duration_sec = parse_duration(record.budget_duration)
        if not duration_sec or record.budget_reset_at is None:
            return record
        now = datetime.now(UTC)
        if record.budget_reset_at > now:
            return record
        new_reset = now + timedelta(seconds=duration_sec)
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE llmgw_api_keys
                   SET budget_reset_at = $3, spend_usd = 0
                 WHERE key_id = $1 AND budget_reset_at = $2
                """,
                record.key_id, record.budget_reset_at, new_reset,
            )
        from dataclasses import replace

        return replace(record, budget_reset_at=new_reset, spend_usd=0.0)


def _row_to_record(row: Any) -> ApiKeyRecord:
    return ApiKeyRecord(
        key_id=row["key_id"],
        tenant_id=row["tenant_id"],
        key_name=row["key_name"] or "",
        key_prefix=row["key_prefix"] or "",
        models=tuple(json.loads(row["models"] or "[]")),
        max_budget_usd=(
            float(row["max_budget_usd"]) if row["max_budget_usd"] is not None else None
        ),
        soft_budget_usd=(
            float(row["soft_budget_usd"]) if row["soft_budget_usd"] is not None else None
        ),
        budget_duration=row["budget_duration"],
        budget_reset_at=row["budget_reset_at"],
        tpm_limit=(
            int(row["tpm_limit"]) if row["tpm_limit"] is not None else None
        ),
        rpm_limit=(
            int(row["rpm_limit"]) if row["rpm_limit"] is not None else None
        ),
        spend_usd=float(row["spend_usd"] or 0.0),
        blocked=bool(row["blocked"]),
        expires_at=row["expires_at"],
        last_active_at=row["last_active_at"],
    )


class ApiKeyCache:
    """Redis read-through cache keyed by key hash (30s TTL)."""

    def __init__(self, redis_client: Any | None = None) -> None:
        self._redis = redis_client

    async def get_or_load(
        self, key_hash: str, loader: Any
    ) -> ApiKeyRecord | None:
        cache_key = f"llmgw:key:{key_hash}"
        if self._redis is not None:
            try:
                raw = await self._redis.get(cache_key)
                if raw:
                    data = json.loads(raw)
                    if data.get("_miss"):
                        return None
                    return _record_from_json(data)
            except Exception as exc:
                logger.warning("llmgw.apikey.cache_read_failed", error=str(exc))
        record = await loader(key_hash)
        if self._redis is not None:
            try:
                payload = _record_to_json(record) if record else {"_miss": True}
                await self._redis.setex(cache_key, _CACHE_TTL_SEC, json.dumps(payload))
            except Exception as exc:
                logger.warning("llmgw.apikey.cache_write_failed", error=str(exc))
        return record

    async def invalidate(self, key_hash: str) -> None:
        if self._redis is None:
            return
        try:
            await self._redis.delete(f"llmgw:key:{key_hash}")
        except Exception as exc:
            logger.warning("llmgw.apikey.invalidate_failed", error=str(exc))


def _record_to_json(record: ApiKeyRecord) -> dict[str, Any]:
    return {
        "key_id": record.key_id,
        "tenant_id": record.tenant_id,
        "key_name": record.key_name,
        "key_prefix": record.key_prefix,
        "models": list(record.models),
        "max_budget_usd": record.max_budget_usd,
        "soft_budget_usd": record.soft_budget_usd,
        "budget_duration": record.budget_duration,
        "budget_reset_at": record.budget_reset_at.isoformat() if record.budget_reset_at else None,
        "tpm_limit": record.tpm_limit,
        "rpm_limit": record.rpm_limit,
        "spend_usd": record.spend_usd,
        "blocked": record.blocked,
        "expires_at": record.expires_at.isoformat() if record.expires_at else None,
        "last_active_at": record.last_active_at.isoformat() if record.last_active_at else None,
    }


def _record_from_json(data: dict[str, Any]) -> ApiKeyRecord:
    return ApiKeyRecord(
        key_id=data["key_id"],
        tenant_id=data["tenant_id"],
        key_name=data.get("key_name", ""),
        key_prefix=data.get("key_prefix", ""),
        models=tuple(data.get("models", ())),
        max_budget_usd=data.get("max_budget_usd"),
        soft_budget_usd=data.get("soft_budget_usd"),
        budget_duration=data.get("budget_duration"),
        budget_reset_at=(
            datetime.fromisoformat(data["budget_reset_at"])
            if data.get("budget_reset_at") else None
        ),
        tpm_limit=data.get("tpm_limit"),
        rpm_limit=data.get("rpm_limit"),
        spend_usd=float(data.get("spend_usd", 0.0)),
        blocked=bool(data.get("blocked", False)),
        expires_at=(
            datetime.fromisoformat(data["expires_at"])
            if data.get("expires_at") else None
        ),
        last_active_at=(
            datetime.fromisoformat(data["last_active_at"])
            if data.get("last_active_at") else None
        ),
    )


# ---------------------------------------------------------------------------
# Request-side enforcement
# ---------------------------------------------------------------------------
def model_allowed(record: ApiKeyRecord, model: str) -> bool:
    """fnmatch whitelist; empty list = all models allowed; empty request
    model (provider default, resolved later) = allowed."""
    if not record.models or not (model or "").strip():
        return True
    return any(fnmatch.fnmatchcase(model, pattern) for pattern in record.models)


async def enforce_key_limits(
    record: ApiKeyRecord,
    *,
    model: str,
    estimated_tokens: int,
    redis_client: Any | None,
) -> ApiKeyRecord:
    """Models whitelist → rpm/tpm → max budget (spend-on-key row).

    Returns the (possibly window-advanced) record; raises HTTPException.
    """
    from fastapi import HTTPException

    if not model_allowed(record, model):
        raise HTTPException(
            status_code=403,
            detail=f"model {model!r} not allowed for this api key",
        )

    if redis_client is not None and (record.rpm_limit or record.tpm_limit):
        await _key_rate_limit(record, redis_client, estimated_tokens)

    if record.max_budget_usd is not None:
        if _store is not None:
            record = await _store.advance_budget_window(record)
        if record.spend_usd >= record.max_budget_usd:
            raise HTTPException(
                status_code=429,
                detail="api key budget exhausted",
                headers={"Retry-After": "3600"},
            )
    return record


async def _key_rate_limit(
    record: ApiKeyRecord, redis_client: Any, estimated_tokens: int
) -> None:

    from ..quota.bucket import _RATELIMIT_LUA, QuotaExceededError

    minute = int(time.time()) // 60
    req_key = f"llmgw:ratelimit:key:{record.key_id}:{minute}"
    tok_key = f"llmgw:ratelimit:key:{record.key_id}:tok:{minute}"
    try:
        result = await redis_client.eval(
            _RATELIMIT_LUA, 2, req_key, tok_key,
            record.rpm_limit or 10**9, record.tpm_limit or 10**12,
            max(int(estimated_tokens), 0), 60, int(time.time()),
        )
    except Exception as exc:
        logger.warning("llmgw.apikey.ratelimit_degraded", error=str(exc))
        return
    if int(result[0]) == 0:
        raise QuotaExceededError(req_key, int(result[3]))


# ---------------------------------------------------------------------------
# Process-wide singletons (wired in main.py lifespan)
# ---------------------------------------------------------------------------
_store: ApiKeyStore | None = None
_cache: ApiKeyCache | None = None
_redis: Any | None = None


def set_api_key_runtime(
    store: ApiKeyStore | None, cache: ApiKeyCache | None, redis_client: Any | None
) -> None:
    global _store, _cache, _redis
    _store, _cache, _redis = store, cache, redis_client


def get_api_key_store() -> ApiKeyStore | None:
    return _store


def get_api_key_cache() -> ApiKeyCache | None:
    return _cache


def get_api_key_redis() -> Any | None:
    return _redis


async def llmgw_api_key_verifier(request: Any, token: str) -> RequestContext:
    """install_auth hook: verify a sk-llmgw-* bearer (async).

    Non-prefixed tokens raise (back to the middleware's 401 with the JWT
    reason). Disabled runtime (no PG pool) → reject so keys never silently
    bypass auth.
    """
    if not token.startswith(KEY_PREFIX):
        raise ApiKeyRejected("not an llmgw api key")
    if _store is None:
        raise ApiKeyRejected("api key auth disabled")

    async def _load(key_hash: str) -> ApiKeyRecord | None:
        return await _store._get_by_hash(key_hash)

    cache = _cache or ApiKeyCache(None)
    record = await cache.get_or_load(hash_key(token), _load)
    if record is None:
        raise ApiKeyRejected("unknown api key")
    if record.blocked:
        raise ApiKeyRejected("api key revoked")
    if record.expires_at is not None and record.expires_at <= datetime.now(UTC):
        raise ApiKeyRejected("api key expired")

    # Stash the record for per-request enforcement (model whitelist /
    # key rate limits / key budget) — avoids a second lookup in handlers.
    request.state.llmgw_api_key = record

    return RequestContext(
        request_id=request.headers.get("x-request-id", ""),
        trace_id=request.headers.get("x-trace-id", ""),
        tenant_id=TenantId(record.tenant_id),
        user_id=UserId(f"apikey:{record.key_id}"),
        roles=frozenset(),
        permissions=frozenset(),
        scopes=frozenset({"llmgw"}),
        client_id="llmgw-api-key",
        auth_method=AuthMethod.API_KEY,
    )


def key_id_from_ctx(ctx: Any) -> str | None:
    """Parse the key id encoded in an API_KEY ctx's user_id."""
    user_id = str(getattr(ctx, "user_id", "") or "")
    if user_id.startswith("apikey:"):
        return user_id[len("apikey:"):]
    return None
