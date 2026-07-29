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
                # Portal admin pages call /api/v1/iam/<svc>/<rest>; rewrite to
        # /api/v1/admin/<svc>/<rest>. The portal also uses legacy service
        # names the new admin router exposes under different prefixes
        # (e.g. audit-logs -> logs/audit, departments -> orgs/tree); the
        # _svc_aliases mapping handles those.
        self._pattern = _re.compile(
            r"^/api/v1/iam/("
            r"users(?:/[^/]+)?|/users/[^/]+/departments|/users/me/password|"
            r"orgs(?:/[^/]+)?|/orgs/positions|/orgs/transfer|/orgs/[^/]+|/org/[^/]+|"
            r"roles(?:/[^/]+)?|/role/[^/]+|/roles/[^/]+/permissions|"
            r"permissions(?:/[^/]+)?|/permission/[^/]+|"
            r"logs(?:/[^/]+)?|/logs/audit|/logs/audit/\d+|/logs/audit/export|/logs/modules|"
            r"audit-logs(?:/[^/]+)?|/audit-logs/[^/]+|/audit-logs/statistics|/audit-logs/export|"
            r"departments(?:/[^/]+)?|/departments/[^/]+|/departments/tree|"
            r"api-keys(?:/[^/]+)?|/api-keys/[^/]+|/api-keys/[^/]+/revoke|"
            r"sso(?:/.*)?|/sso-providers(?:/[^/]+)?|/sso-providers/[^/]+/authorize|/sso-providers/[^/]+/callback|"
            r"configs(?:/[^/]+)?"
            r")(/.*)?$",
        )
        # legacy_iam_segment -> current_admin_segment
        self._svc_aliases = {
            "audit-logs": "logs/audit",
            "audit-logs/statistics": "logs/modules",
            "departments": "orgs/tree",
            "departments/tree": "orgs/tree",
            "roles": "permissions/roles",
            "permissions": "permissions/catalog",
            "logs": "logs/audit",
            "logs/audit": "logs/audit",          # identity (alias already has trailing segment)
            "logs/modules": "logs/modules",
            "logs/audit/export": "logs/audit/export",
            "orgs/positions": "orgs/positions",
            "orgs/transfer": "orgs/transfer",
            "orgs/[^/]+": "orgs",
            "api-keys": "api-keys",
            "sso": "sso",
            "sso-providers": "sso-providers",
        }

    async def dispatch(self, request: _StRequest, call_next):
        m = self._pattern.match(request.url.path)
        if not m:
            return await call_next(request)
        legacy_svc = m.group(1)
        tail = m.group(2) or ""
        # Longest-prefix alias lookup so detail paths fall back correctly:
        #   "audit-logs/statistics" -> alias key "audit-logs/statistics" -> "logs/modules"
        #   "audit-logs/123"       -> alias key "audit-logs"          -> "logs/audit/123"
        #   "roles/3"               -> alias key "roles"              -> "permissions/roles/3"
        alias_key = None
        for k in sorted(self._svc_aliases.keys(), key=len, reverse=True):
            if legacy_svc == k or legacy_svc.startswith(k + "/"):
                alias_key = k
                break
        if alias_key is not None:
            admin_prefix = self._svc_aliases[alias_key]
            remainder = legacy_svc[len(alias_key):]
            new_path = "/api/v1/admin/" + admin_prefix + remainder + tail
        else:
            # No alias matched: keep the legacy segment as-is.
            new_path = "/api/v1/admin/" + legacy_svc + tail
        request.scope["path"] = new_path
        request.scope["raw_path"] = new_path.encode("utf-8")
        return await call_next(request)

app.add_middleware(_PortalIamAliasMiddleware)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8102")))
