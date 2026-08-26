"""Mate Platform - API Gateway entry.

L7 路由: path 前缀匹配 -> 上游服务
聚合: 多服务结果组合 (后续可加)
限流: Redis 令牌桶 (per-tenant per-minute)
"""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager, suppress
from typing import Any

import httpx
import structlog
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

logger = structlog.get_logger(__name__)


# ---- Service registry (env-overridable) ----
SERVICES: dict[str, str] = {
    "rag":    os.getenv("RAG_URL",    "http://mate-tech-rag:8001"),
    "agent":  os.getenv("AGENT_URL",  "http://mate-tech-agent:8002"),
    "app-kb": os.getenv("APP_KB_URL", "http://mate-app-kb:8003"),
    "llmgw":  os.getenv("LLMGW_URL",  "http://mate-tech-llmgw:8008"),
    "ont":    os.getenv("ONT_URL",    "http://mate-tech-ont:8007"),
    "mcp":    os.getenv("MCP_URL",    "http://mate-tech-mcp:8081"),
    "iam":    os.getenv("IAM_URL",    "http://mate-auth-service:8101"),
    "iam-admin": os.getenv("IAM_ADMIN_URL", "http://mate-tech-iam:8102"),
    "obs":     os.getenv("OBS_URL",     "http://mate-tech-obs:8083"),
    "copilot": os.getenv("COPILOT_URL", "http://mate-app-copilot:8601"),
    "arch":    os.getenv("ARCH_URL",    "http://mate-app-arch:8321"),
    "dw":      os.getenv("DW_URL",      "http://mate-tech-dw:8021"),
    "apphub":  os.getenv("APPHUB_URL",  "http://mate-app-hub:8301"),
    "data":    os.getenv("DATA_URL",    "http://mate-tech-data:8701"),
    "a2a":     os.getenv("A2A_URL",     "http://mate-app-a2a:8502"),
    "orchestrator": os.getenv("ORCH_URL", "http://mate-tech-orchestrator:8505"),
    # Task12: ETL / 调度 / 指标独立服务
    "etl":      os.getenv("ETL_URL",      "http://mate-tech-etl:8022"),
    "scheduler": os.getenv("SCHEDULER_URL", "http://mate-tech-scheduler:8023"),
    "metrics":  os.getenv("METRICS_URL",  "http://mate-tech-metrics:8024"),
}

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "600"))
UPSTREAM_TIMEOUT_SEC = float(os.getenv("UPSTREAM_TIMEOUT_SEC", "60"))

# Path prefix -> upstream service name
ROUTE_MAP: list[tuple[str, str]] = [
    ("/api/v1/rag/",  "rag"),
    ("/api/v1/agent/", "agent"),
    ("/api/v1/llm/",  "llmgw"),
    ("/api/v1/llmgw/", "llmgw"),
    ("/api/v1/kb/",   "app-kb"),
    ("/api/v1/ont/",  "ont"),
    ("/api/v1/mcp/",  "mcp"),
    ("/api/v1/dw/",   "dw"),        # DW (digital workforce) routes served by mate-tech-dw
    ("/api/v1/dashboard/", "iam"),   # GOVERN-02-FIX: dashboard 41 routes on mate-auth-service
    ("/api/v1/admin/operations/", "obs"),
    ("/api/v1/admin/", "iam"),       # GOVERN-02-FIX: admin users/orgs/permissions/logs/configs/models on mate-auth-service
    ("/api/v1/iam/auth/login", "iam"),   # Keycloak password grant on mate-auth-service
    ("/api/v1/iam/auth/refresh", "iam"),
    ("/api/v1/iam/auth/logout", "iam"),
    ("/api/v1/iam/",  "iam-admin"),  # legacy /iam/* (sso, /me) still on deprecated mate-tech-iam until 2026-12-31 sunset
    ("/api/v1/copilot/", "copilot"),
    ("/api/v1/superai/", "copilot"),
    ("/api/v1/arch/", "arch"),
    ("/api/v1/apphub/", "apphub"),
    ("/api/v1/marketplace/", "apphub"),
    ("/api/v1/data/", "data"),
    ("/api/v1/etl/", "etl"),          # Task12: 独立 ETL 服务
    ("/api/v1/scheduler/", "scheduler"),  # Task12: 独立调度服务
    ("/api/v1/metrics/", "metrics"),  # Task12: 独立指标服务
    ("/api/v1/metrics", "metrics"),   # Task12: 裸 /metrics（list 端点无尾斜杠）
    ("/api/v1/a2a/", "a2a"),
    ("/api/v1/orchestrator/", "orchestrator"),
    # v1.0 order-review public contract is served by the orchestrator.
    ("/api/v1/action-proposals/", "orchestrator"),
    ("/api/v1/action-proposals", "orchestrator"),
    ("/api/v1/review-cases/", "orchestrator"),
    ("/api/v1/review-cases", "orchestrator"),
    ("/api/v1/orders/", "orchestrator"),
    ("/api/v1/orders", "orchestrator"),
]


# ---- Lifespan: shared httpx.AsyncClient + Redis ----
@asynccontextmanager
async def lifespan(app: FastAPI):
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
    app.state.client = httpx.AsyncClient(
        timeout=httpx.Timeout(UPSTREAM_TIMEOUT_SEC, connect=5.0),
        limits=httpx.Limits(max_connections=200, max_keepalive_connections=50),
    )
    try:
        import redis.asyncio as aioredis
        app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        await app.state.redis.ping()
        logger.info("redis.connected", url=REDIS_URL)
    except Exception as exc:
        logger.warning("redis.connect_failed", error=str(exc))
        app.state.redis = None
    logger.info("mate-api-gateway.startup", services=list(SERVICES.keys()))
    yield
    await app.state.client.aclose()
    if app.state.redis is not None:
        with suppress(Exception):
            await app.state.redis.aclose()
    logger.info("mate-api-gateway.shutdown")


app = FastAPI(
    title="mate-api-gateway",
    version="0.1.0",
    description="API Gateway: L7 routing + aggregation + rate limiting",
    lifespan=lifespan,
)


# ---- Health ----
@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": app.version}


@app.get("/readyz")
async def readyz() -> dict[str, Any]:
    services_status: dict[str, str] = {}
    overall_ok = True
    for name, url in SERVICES.items():
        try:
            r = await app.state.client.get(f"{url}/healthz", timeout=2.0)
            ok = r.status_code == 200
            services_status[name] = "up" if ok else f"degraded:{r.status_code}"
            overall_ok = overall_ok and ok
        except Exception as exc:
            services_status[name] = f"down:{type(exc).__name__}"
            overall_ok = False
    return {
        "status": "ok" if overall_ok else "degraded",
        "redis": "up" if app.state.redis else "down",
        "services": services_status,
    }


# ---- Rate limit middleware (per-tenant, sliding minute bucket) ----
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Use getattr so the middleware does not crash if redis was never initialized
    # (e.g. local dev without Redis). In that case it acts as a no-op pass-through.
    if getattr(app.state, "redis", None) is None or not request.url.path.startswith("/api/"):
        return await call_next(request)
    tenant = (
        request.headers.get("X-Tenant-Id")
        or (request.client.host if request.client else "anon")
    )
    minute_bucket = int(time.time()) // 60
    bucket_key = f"rl:{tenant}:{minute_bucket}"
    try:
        n = await app.state.redis.incr(bucket_key)
        if n == 1:
            await app.state.redis.expire(bucket_key, 65)
        if n > RATE_LIMIT_PER_MIN:
            return JSONResponse(
                status_code=429,
                content={
                    "code": "E429_RATE_LIMIT",
                    "message": f"Rate limit {RATE_LIMIT_PER_MIN}/min exceeded for tenant '{tenant}'",
                },
                headers={"Retry-After": "60"},
            )
    except Exception as exc:
        logger.warning("rate_limit.error", error=str(exc))
    return await call_next(request)


# ---- Catch-all proxy ----
PROXY_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]


def _build_target_url(target_base: str, path: str) -> httpx.URL:
    """Build an upstream URL while preserving colon command separators.

    Some ASGI servers expose an encoded colon in ``request.url.path`` even
    though the public command contract uses paths such as ``:confirm``.  If
    that value is passed to HTTPX as a string, it remains ``%3A`` on the wire
    and Starlette does not match the command route in the upstream service.
    Decode only this reserved character; decoding other escapes could change
    path-segment boundaries or alter the route's security semantics.
    """
    target_url = httpx.URL(f"{target_base}{path}")
    raw_path = target_url.raw_path.replace(b"%3A", b":").replace(b"%3a", b":")
    if raw_path == target_url.raw_path:
        return target_url
    return target_url.copy_with(raw_path=raw_path)


@app.api_route("/api/v1/{path:path}", methods=PROXY_METHODS)
async def proxy(path: str, request: Request) -> Response:
    """Match longest prefix in ROUTE_MAP and forward to upstream.
    with open('D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.tmp-gw-debug.log', "a") as f:
        f.write(f"[PROXY] HIT path={path} url={request.url.path} method={request.method}\n")

    Injects X-Forwarded-* headers, preserves body and query string.
    """
    matched_service: str | None = None
    for prefix, svc in sorted(ROUTE_MAP, key=lambda x: -len(x[0])):
        if request.url.path.startswith(prefix):
            matched_service = svc
            break
    if matched_service is None:
        return JSONResponse(
            status_code=404,
            content={
                "code": "E404_NO_ROUTE",
                "message": f"No route matched {request.url.path}",
            },
        )

    target_base = SERVICES[matched_service]
    target_url = _build_target_url(target_base, request.url.path)

    # Forward headers, drop hop-by-hop
    skip = {"host", "content-length", "connection", "keep-alive",
            "proxy-authenticate", "proxy-authorization", "te", "trailers",
            "transfer-encoding", "upgrade"}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in skip}
    headers["X-Forwarded-By"] = "mate-api-gateway"
    headers["X-Forwarded-Host"] = request.headers.get("host", "")
    headers["X-Real-IP"] = request.client.host if request.client else ""

    body = await request.body()
    start = time.perf_counter()
    # Build a client on-demand if lifespan did not run (tests / fresh import).
    client = getattr(app.state, 'client', None)
    if client is None:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(UPSTREAM_TIMEOUT_SEC, connect=5.0),
            limits=httpx.Limits(max_connections=200, max_keepalive_connections=50),
        )
    try:
        upstream = await client.request(
            method=request.method,
            url=target_url,
            params=request.url.query,
            headers=headers,
            content=body,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)
        logger.info(
            "proxy.forward",
            method=request.method,
            path=request.url.path,
            upstream=matched_service,
            status=upstream.status_code,
            latency_ms=latency_ms,
        )
        # Drop hop-by-hop from upstream response too
        resp_headers = {
            k: v for k, v in upstream.headers.items()
            if k.lower() not in skip
        }
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers=resp_headers,
        )
    except httpx.TimeoutException:
        logger.error("proxy.timeout", upstream=matched_service, url=target_url)
        return JSONResponse(
            status_code=504,
            content={"code": "E504_TIMEOUT", "message": f"Upstream {matched_service} timeout"},
        )
    except Exception as exc:
        logger.error("proxy.error", upstream=matched_service, url=target_url, error=str(exc))
        return JSONResponse(
            status_code=502,
            content={"code": "E502_UPSTREAM", "message": f"Upstream {matched_service} error: {exc}"},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8100")))



