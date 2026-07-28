"""Mate Platform - Tech ONT main entry."""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI

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
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8007")))