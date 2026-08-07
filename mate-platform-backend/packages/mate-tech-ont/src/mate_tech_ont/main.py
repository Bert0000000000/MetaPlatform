"""Mate Platform - Tech ONT main entry.

GOVERN-03 (2026-08-07): v1 ontology routers are DEPRECATED. The KERNEL-01
v2 router (``v2_kernel/api.py``) is the supported surface (12 primitives
+ Action + ObjectSet + Manager, ADR-0021). Sunset: 2026-12-31.

During the transition window, v1 endpoints respond with three headers:

* ``Deprecation: true``
* ``Sunset: Wed, 31 Dec 2026 23:59:59 GMT``
* ``Link: </api/v1/ont/v2/...>; rel="successor-version"``

v2_kernel routes pass through unchanged. See
``evidence/MP-ONT-V1-SUNSET-NOTICE.md``.
"""
from __future__ import annotations

import os
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, HTTPException, Request, Response

# TECH-SERVICES / BUSINESS-SLICES: hooks 1, 2 (auth + tenant).
from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import TenantAccessError, require_tenant

from .api.ontology import router as ontology_router
from .federation import router as federation_router
from .inference.api import router as inference_router
from .inference.shacl_api import router as shacl_router
from .instances.api import router as instances_router
from .repos.neo4j_repo import create_neo4j_repository
from .sparql.api import router as sparql_router
from .sparql.explain import router as explain_router
from .v2_kernel.api import router as v2_kernel_router
from .versioning.api import router as versioning_router

# v1 router prefixes that emit Deprecation/Sunset headers.
# Keep in sync with the eight `prefix="/api/v1/ont/..."` declarations.
_V1_PREFIXES = (
    "/api/v1/ont",  # api/ontology.py — but see V1_DEPRECATED_PREFIXES below
    "/api/v1/ont/instances",
    "/api/v1/ont/sparql",
    "/api/v1/ont/explain",
    "/api/v1/ont/versions",
    "/api/v1/ont/inference",
    "/api/v1/ont/shacl",
    "/api/v1/ont/federation",
)
# The ontology router itself uses prefix="/api/v1/ont" (overlapping) and
# carries its own classes/relations endpoints. We mark only the v2_kernel
# paths as the supported ones; v1 ontology router is fully deprecated.
_DEPRECATION_HEADERS = {
    "Deprecation": "true",
    "Sunset": "Wed, 31 Dec 2026 23:59:59 GMT",
    "Link": '</api/v1/ont/v2/>; rel="successor-version"',
}
_TENANT_WHITELIST_EXACT = {"/healthz", "/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect"}
_TENANT_WHITELIST_PREFIXES = ("/openapi",)

logger = structlog.get_logger(__name__)

neo4j = create_neo4j_repository()

app = FastAPI(
    title="mate-tech-ont",
    version="0.1.0",
    description="Ontology service: Neo4j + OWL + SPARQL",
)

# Hook 2 of 5: tenant guard. Equivalent to the per-handler
# `require_tenant(ctx)` call but applied globally so the
# 4 sub-routers (ontology, instances, sparql, explain) do not
# each need a manual decorator.
#
# Defined BEFORE install_auth(app) so that AuthMiddleware (added last
# via add_middleware, which prepends to position 0) becomes the
# outermost middleware and runs first — populating request.state.ctx
# before this guard checks it.
@app.middleware('http')
async def _enforce_tenant_per_request(  # pyright: ignore[reportUnusedFunction]
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    path = request.url.path
    # GOVERN-03: tenant guard whitelist expanded for /docs / /redoc and
    # the OpenAPI browser surface; these endpoints must remain reachable
    # without an authenticated tenant context so that operators can read
    # the contract during the v1 → v2 transition window.
    if (
        path in _TENANT_WHITELIST_EXACT
        or any(path.startswith(p) for p in _TENANT_WHITELIST_PREFIXES)
    ):
        return await call_next(request)
    ctx = getattr(request.state, 'ctx', None)
    if ctx is None:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={'detail': 'no auth context'})
    try:
        require_tenant(ctx)
    except TenantAccessError as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=403, content={'detail': str(exc)})
    return await call_next(request)


# Hook 1 of 5: install auth middleware (SEC-IAM-01).
install_auth(app)


@app.middleware('http')
async def _deprecation_headers(  # pyright: ignore[reportUnusedFunction]
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Emit Deprecation/Sunset/Link headers on v1 ontology routes.

    Only fires on v1 paths; v2_kernel routes pass through unchanged.
    Runs AFTER the auth+tenant middlewares so 401/403 responses are not
    decorated (clients shouldn't be told about deprecation before being
    authenticated).
    """
    response = await call_next(request)
    path = request.url.path
    if any(path.startswith(prefix) for prefix in _V1_PREFIXES):
        for k, v in _DEPRECATION_HEADERS.items():
            response.headers.setdefault(k, v)
    return response


def _require_ctx(request: Request):  # pyright: ignore[reportUnusedFunction]
    # Defence in depth: install_auth populates ctx or returns 401.
    ctx = getattr(request.state, 'ctx', None)
    if ctx is None:
        raise HTTPException(status_code=401, detail='no auth context')
    return ctx


app.include_router(ontology_router)
app.include_router(instances_router)
app.include_router(sparql_router)
app.include_router(explain_router)
app.include_router(versioning_router)
app.include_router(inference_router)
app.include_router(shacl_router)
app.include_router(federation_router)
app.include_router(v2_kernel_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": app.version}


@app.on_event("startup")  # pyright: ignore[reportDeprecated]
async def on_startup() -> None:
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
    try:
        await neo4j.connect()
    except Exception as e:
        logger.warning("neo4j.connect_failed", error=str(e))

    # GOVERN-03: Neo4jGraphRepository is deprecated (ADR-0021 / 12
    # primitives). Surface a single WARN log on startup so operators see
    # the Sunset warning in the boot transcript; the methods themselves
    # emit DeprecationWarning + structlog warning on every call.
    logger.warning(
        "neo4j_repo.deprecated",
        sunset="2026-12-31",
        replacement="v2_kernel.pg_repo",
        message=(
            "Neo4jGraphRepository is deprecated. New ontology traffic must "
            "use v2_kernel router (12 KERNEL-01 primitives via pg_repo)."
        ),
    )

    # RUNTIME-HTTP-01: 根据 KERNEL_BACKEND env 选择 kernel repo
    #  - "memory"（默认 dev） → InMemoryOntologyRepository（MAT-KERNEL/01）
    #  - "pg"（prod）         → PgOntologyRepository（待 RUNTIME-PG-03）
    backend = os.getenv("KERNEL_BACKEND", "memory").lower()
    if backend == "memory":
        from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
        app.state.kernel_repo = InMemoryOntologyRepository()
        logger.info("kernel_repo.initialized", backend="memory")
    elif backend == "pg":
        from .v2_kernel.pg_repo import PgOntologyRepository
        dsn = os.getenv("KERNEL_PG_DSN", "postgresql://localhost/ontology")
        app.state.kernel_repo = PgOntologyRepository(dsn=dsn)
        logger.info("kernel_repo.initialized", backend="pg")
    else:
        raise RuntimeError(f"unknown KERNEL_BACKEND={backend!r}")

    # /goal 端到端验收：ONT_SEED_DEMO=1 时注入员工请假审批 demo 数据（幂等）。
    if os.getenv("ONT_SEED_DEMO", "0") == "1":
        from .v2_kernel.seed import seed_demo
        created = seed_demo(app.state.kernel_repo)
        logger.info("kernel_seed.demo", created=created)

    logger.info("mate-tech-ont.startup", version=app.version)


@app.on_event("shutdown")  # pyright: ignore[reportDeprecated]
async def on_shutdown() -> None:
    await neo4j.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8007")))
