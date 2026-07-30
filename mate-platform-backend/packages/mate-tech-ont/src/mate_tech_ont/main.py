"""Mate Platform - Tech ONT main entry."""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, HTTPException

from .api.ontology import router as ontology_router
from .instances.api import router as instances_router
from .repos.neo4j_repo import create_neo4j_repository
from .sparql.api import router as sparql_router
from .sparql.explain import router as explain_router

logger = structlog.get_logger(__name__)

neo4j = create_neo4j_repository()

app = FastAPI(
    title="mate-tech-ont",
    version="0.1.0",
    description="Ontology service: Neo4j + OWL + SPARQL",
)

    # Hook 1 of 5: install auth middleware (SEC-IAM-01).
    install_auth(app)

    @app.middleware('http')
    async def _enforce_tenant_per_request(request, call_next):
        # Hook 2 of 5: tenant guard. Equivalent to the per-handler
        # `require_tenant(ctx)` call but applied globally so the
        # 4 sub-routers (ontology, instances, sparql, explain) do not
        # each need a manual decorator.
        path = request.url.path
        if not path.startswith('/healthz') and not path.startswith('/openapi'):
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

    def _require_ctx(request: Request):
        # Defence in depth: install_auth populates ctx or returns 401.
        ctx = getattr(request.state, 'ctx', None)
        if ctx is None:
            raise HTTPException(status_code=401, detail='no auth context')
        return ctx

app.include_router(ontology_router)
app.include_router(instances_router)
app.include_router(sparql_router)
app.include_router(explain_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": app.version}


@app.on_event("startup")
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
    logger.info("mate-tech-ont.startup", version=app.version)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await neo4j.close()


if __name__ == "__main__":
    import uvicorn

# BUSINESS-SLICES P2 wave: hooks 1, 2 (auth + tenant).
from fastapi import Request
from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import require_tenant, TenantAccessError
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8007")))
