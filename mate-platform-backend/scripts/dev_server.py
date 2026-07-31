"""Unified dev server — mounts all app routers on a single FastAPI instance.

Usage:
    cd mate-platform-backend
    set INSECURE_SKIP_SIGNATURE=1
    set KEYCLOAK_URL=http://localhost:8080
    set SERVICE_CLIENT_SECRET=test-secret
    python scripts/dev_server.py [--port 8100]

All /api/v1/* routes from 6 app packages are served on one port.
"""
from __future__ import annotations

import argparse
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("dev_server")

# Ensure all packages are importable
_base = r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\packages"
for pkg in [
    "mate-platform/src",
    "mate-clients/src",
    "mate-kernel/src",
    "mate-common/src",
    "mate-tech-db/src",
    "mate-tech-iam/src",
    "mate-app-hub/src",
    "mate-app-arch/src",
    "mate-app-copilot/src",
    "mate-app-a2a/src",
]:
    _p = _base + "\\" + pkg
    if _p not in sys.path:
        sys.path.insert(0, _p)

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402


def build_app() -> FastAPI:
    app = FastAPI(title="MetaPlatform Dev Server", version="3.2.1")

    # Health check
    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    # IAM dashboard + admin
    try:
        from mate_platform.auth import install_auth

        install_auth(app, extra_anonymous_paths={
            "/api/v1/iam/auth/login",
            "/api/v1/iam/auth/refresh",
            "/api/v1/iam/sso-providers",
            "/api/v1/dashboard/auth/login",
        })
        logger.info("Auth middleware installed (with login anonymous paths)")
    except Exception as e:
        logger.warning("Auth install failed: %s", e)

    # Mount routers
    routers = [
        ("copilot", "mate_app_copilot.api", "router"),
        ("a2a", "mate_app_a2a.api", "router"),
        ("arch", "mate_app_arch.api", "router"),
        ("apphub", "mate_app_hub.api", "router"),
    ]

    for name, module_path, attr in routers:
        try:
            mod = __import__(module_path, fromlist=[attr])
            router = getattr(mod, attr)
            app.include_router(router)
            logger.info("Mounted %s router (%d routes)", name, len(router.routes))
        except Exception as e:
            logger.warning("Failed to mount %s: %s", name, e)

    # IAM routers
    try:
        from mate_tech_iam.api import (
            auth as auth_api,
            dashboard as dashboard_api,
        )
        app.include_router(auth_api.router)
        app.include_router(dashboard_api.router)
        logger.info("Mounted IAM auth + dashboard routers")

        # Initialize IAM database + seed data on startup
        @app.on_event("startup")
        async def _init_iam() -> None:
            try:
                from mate_tech_iam.db import init_db
                await init_db()
                logger.info("IAM database initialized")

                from mate_tech_iam.db import AsyncSessionMaker
                from mate_tech_iam.seed import seed
                async with AsyncSessionMaker() as session:
                    await seed(session)
                    await session.commit()
                logger.info("IAM seed data loaded")
            except Exception as e:
                logger.warning("IAM init/seed failed: %s", e)
    except Exception as e:
        logger.warning("Failed to mount IAM: %s", e)

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    app = build_app()
    logger.info("Starting dev server on %s:%d", args.host, args.port)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
