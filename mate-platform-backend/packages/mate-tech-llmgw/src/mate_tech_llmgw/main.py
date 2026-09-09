"""Mate Platform - Tech LLM Gateway main entry.

Wires the 3 integration hooks per ADR-0014:
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at every non-/healthz route in api/routes.py
     (the install here only wires the middleware; the per-route guard
     is in api/routes.py).
  3. (future) outbox.append(event) for usage events.

P0 close-out (2026-09-09): the lifespan now wires ALL runtime singletons
(quota bucket / cache / cost recorder / monthly ceiling / user daily cap).
Redis and Postgres are soft dependencies — either being unavailable logs a
warning and degrades that subsystem to a no-op; startup never crashes and
requests are never blocked by wiring failures.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

import structlog
from fastapi import FastAPI

# BUSINESS-SLICES P1 wave 2: hook 1 (auth).
from mate_platform.auth import install_auth
from mate_platform.runtime import runtime_profile

from .api.routes import legacy_router as legacy_llm_router
from .api.routes import router as llm_router
from .cache.llm_cache import LLMCache
from .cost.ceiling import MonthlyTokenBucket, UserDailyCap
from .cost.recorder import CostRecorder
from .quota.bucket import RedisTokenBucket
from .repositories.ddl import ensure_schema
from .router import (
    set_cache,
    set_cost_recorder,
    set_monthly_bucket,
    set_quota_bucket,
    set_user_daily_cap,
    get_quota_bucket,
)

logger = structlog.get_logger(__name__)


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _redis_quota_enabled_by_default() -> bool:
    return runtime_profile() in {"staging", "production", "prod"} or bool(
        os.getenv("REDIS_URL", "").strip()
    )


def _redis_quota_enabled() -> bool:
    return _env_flag(
        "MATE_LLMGW_ENABLE_REDIS_QUOTA",
        default=_redis_quota_enabled_by_default(),
    )


# --- Soft-dependency builders (module-level so tests can monkeypatch) -------


async def _build_redis_client() -> Any | None:
    """Shared Redis client; None when unreachable (degrade, don't crash)."""
    import redis.asyncio as redis

    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        return None
    try:
        client = redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        await client.ping()
    except Exception as exc:  # noqa: BLE001
        logger.warning("mate-tech-llmgw.redis.degraded", error=str(exc))
        return None
    return client


async def _build_pg_pool() -> Any | None:
    """asyncpg pool from PG_DSN; None when unset/unreachable.

    llmgw tables live in the PG_DSN database (deploy convention:
    metaplatform_kb), NOT the platform main DB.
    """
    dsn = os.getenv("PG_DSN", "").strip()
    if not dsn:
        return None
    try:
        import asyncpg

        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5, timeout=5)
    except Exception as exc:  # noqa: BLE001
        logger.warning("mate-tech-llmgw.pg.degraded", error=str(exc))
        return None
    return pool


@dataclass(slots=True)
class _RuntimeDeps:
    """Singletons owned by this lifespan (closed in reverse on shutdown)."""

    redis_client: Any | None = None
    pg_pool: Any | None = None
    cache: LLMCache | None = None

    async def close(self) -> None:
        # The shared Redis client is closed exactly once: by the cache
        # when it holds the reference, otherwise directly.
        if self.cache is not None:
            try:
                await self.cache.close()
            except Exception:  # noqa: BLE001
                pass
            self.cache = None
        elif self.redis_client is not None:
            try:
                await self.redis_client.aclose()
            except Exception:  # noqa: BLE001
                pass
            self.redis_client = None
        if self.pg_pool is not None:
            try:
                await self.pg_pool.close()
            except Exception:  # noqa: BLE001
                pass
            self.pg_pool = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup lifespan hook: configure structlog + wire runtime singletons.

    Every subsystem is wired independently: one failing dependency (Redis
    down, PG down, a builder raising) degrades only that subsystem and
    never blocks the rest — nor startup itself.
    """
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(__import__("logging"), log_level)
        ),
    )

    deps = _RuntimeDeps()
    # Quota bucket constructed without a shared client owns a lazy client
    # and must be closed here; with a shared client, deps closes it once.
    owned_quota_bucket: RedisTokenBucket | None = None
    quota_bucket_owns_client = False

    # --- Infrastructure clients (each degrades to None independently) ---
    try:
        deps.redis_client = await _build_redis_client()
    except Exception as exc:  # noqa: BLE001
        logger.warning("mate-tech-llmgw.redis.build_failed", error=str(exc))
        deps.redis_client = None
    try:
        deps.pg_pool = await _build_pg_pool()
    except Exception as exc:  # noqa: BLE001
        logger.warning("mate-tech-llmgw.pg.build_failed", error=str(exc))
        deps.pg_pool = None

    if deps.pg_pool is not None:
        await ensure_schema(deps.pg_pool)

    # --- Quota bucket (pre-existing wiring; now shares the client) ---
    if get_quota_bucket() is None and _redis_quota_enabled():
        try:
            quota_bucket_owns_client = deps.redis_client is None
            owned_quota_bucket = RedisTokenBucket(
                redis_client=deps.redis_client
            )
            set_quota_bucket(owned_quota_bucket)
            logger.info(
                "mate-tech-llmgw.quota.enabled",
                profile=runtime_profile(),
                backend="redis",
                shared_client=not quota_bucket_owns_client,
            )
        except Exception as exc:  # noqa: BLE001
            owned_quota_bucket = None
            logger.warning("mate-tech-llmgw.quota.degraded", error=str(exc))

    # --- Response cache (Redis soft dependency) ---
    if _env_flag("MATE_LLMGW_ENABLE_CACHE", default=True):
        if deps.redis_client is not None:
            try:
                deps.cache = LLMCache(redis_client=deps.redis_client)
                set_cache(deps.cache)
                logger.info("mate-tech-llmgw.cache.enabled", backend="redis")
            except Exception as exc:  # noqa: BLE001
                deps.cache = None
                logger.warning("mate-tech-llmgw.cache.degraded", error=str(exc))
        else:
            logger.warning("mate-tech-llmgw.cache.degraded", reason="no redis")

    # --- Provider cooldown / circuit breaking (P2, needs Redis) ---
    if _env_flag("MATE_LLMGW_ENABLE_COOLDOWN", default=True):
        if deps.redis_client is not None:
            try:
                from .resilience.cooldown import CooldownManager, set_cooldown

                set_cooldown(
                    CooldownManager(
                        deps.redis_client,
                        allowed_fails=int(os.getenv("LLMGW_COOLDOWN_ALLOWED_FAILS", "2")),
                        default_cooldown_sec=float(os.getenv("LLMGW_COOLDOWN_SECONDS", "60")),
                    )
                )
                logger.info("mate-tech-llmgw.cooldown.enabled")
            except Exception as exc:  # noqa: BLE001
                from .resilience.cooldown import set_cooldown

                set_cooldown(None)
                logger.warning("mate-tech-llmgw.cooldown.degraded", error=str(exc))
        else:
            logger.warning("mate-tech-llmgw.cooldown.degraded", reason="no redis")

    # --- Cost recorder (always injected; PG pool optional) ---
    try:
        cost_pool = (
            deps.pg_pool
            if _env_flag("MATE_LLMGW_ENABLE_COST_PG", default=True)
            else None
        )
        set_cost_recorder(CostRecorder(pool=cost_pool))
        logger.info(
            "mate-tech-llmgw.cost.enabled", persistent=cost_pool is not None
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("mate-tech-llmgw.cost.degraded", error=str(exc))

    # --- Monthly token ceiling (in-memory or PG-backed) ---
    if _env_flag("MATE_LLMGW_ENABLE_MONTHLY_CEILING", default=True):
        try:
            set_monthly_bucket(MonthlyTokenBucket(pool=deps.pg_pool))
            logger.info("mate-tech-llmgw.monthly_ceiling.enabled")
        except Exception as exc:  # noqa: BLE001
            logger.warning("mate-tech-llmgw.monthly_ceiling.degraded", error=str(exc))

    # --- Per-user daily cost cap (in-memory) ---
    if _env_flag("MATE_LLMGW_ENABLE_USER_DAILY_CAP", default=True):
        try:
            set_user_daily_cap(UserDailyCap())
            logger.info("mate-tech-llmgw.user_daily_cap.enabled")
        except Exception as exc:  # noqa: BLE001
            logger.warning("mate-tech-llmgw.user_daily_cap.degraded", error=str(exc))

    logger.info("mate-tech-llmgw.startup", version=app.version)
    try:
        yield
    finally:
        from .resilience.cooldown import set_cooldown

        set_cooldown(None)
        set_cache(None)
        set_cost_recorder(None)
        set_monthly_bucket(None)
        set_user_daily_cap(None)
        # Only clear the quota bucket we own; an externally injected one
        # (dev_server / tests) must survive our shutdown.
        if owned_quota_bucket is not None:
            set_quota_bucket(None)
            if quota_bucket_owns_client:
                try:
                    await owned_quota_bucket.close()
                except Exception:  # noqa: BLE001
                    pass
        await deps.close()


app = FastAPI(
    title="mate-tech-llmgw",
    version="0.1.0",
    description="LLM Gateway: multi-provider routing, quota, cache, fallback",
    lifespan=lifespan,
)

# Hook 1 of 5: install auth middleware (SEC-IAM-01).
install_auth(app)

# Canonical prefix is /api/v1/llmgw/* (per spec). The legacy
# /api/v1/llm/* alias is also wired for one release so existing
# callers (BFF routes, integration tests) keep working while they
# migrate to the spec-compliant path.
app.include_router(llm_router)
app.include_router(legacy_llm_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """ST-5.5.1.2 DoD: health check (anonymous, whitelisted)."""
    return {"status": "ok", "version": app.version}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8008)  # noqa: S104
