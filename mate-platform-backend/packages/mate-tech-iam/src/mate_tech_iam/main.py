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


# Portal compatibility shim: portal admin pages call /api/v1/iam/users, /api/v1/iam/orgs, etc.
# (matching the old auth-service prefix). mate-tech-iam registers these at /api/v1/admin/*.
# This middleware rewrites /api/v1/iam/<rest> -> /api/v1/admin/<rest> for non-auth paths.
# Auth endpoints (e.g. /api/v1/iam/auth/login) are handled by auth_router directly.
import re as _re
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as _StRequest
from starlette.types import ASGIApp as _ASGIApp

class _PortalIamAliasMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: _ASGIApp):
        super().__init__(app)
        # Only rewrite admin-style paths, not auth/sso-providers
        self._pattern = _re.compile(r"^/api/v1/iam/(admin|users|orgs|permissions|logs|configs)(/.*)?$")

    async def dispatch(self, request: _StRequest, call_next):
        m = self._pattern.match(request.url.path)
        if m:
            request.scope["path"] = "/api/v1/admin/" + m.group(1) + (m.group(2) or "")
            request.scope["raw_path"] = request.scope["path"].encode("utf-8")
        return await call_next(request)

app.add_middleware(_PortalIamAliasMiddleware)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8102")))
