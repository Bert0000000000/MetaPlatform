"""Mate Platform - TECH-IAM main entry."""
from __future__ import annotations

import os
import traceback
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import (auth_router, configs_router, logs_router, orgs_router, permissions_router, users_router)
from .db import AsyncSessionMaker, db_health, init_db
from .seed import seed

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(__import__("logging"), log_level)),
    )
    logger.info("mate-tech-iam.startup", port=os.getenv("PORT", "8102"))
    await init_db()
    async with AsyncSessionMaker() as session:
        await seed(session)
    yield
    logger.info("mate-tech-iam.shutdown")


app = FastAPI(
    title="mate-tech-iam",
    version="0.1.0",
    description="TECH-IAM admin service",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Pass-through for HTTPException so 401/403/404 etc. return correctly under uvicorn."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "version": app.version}


@app.get("/readyz")
async def readyz() -> dict[str, Any]:
    return {"status": "ok", "version": app.version, "database": await db_health()}


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(permissions_router)
app.include_router(orgs_router)
app.include_router(logs_router)
app.include_router(configs_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8102")))
