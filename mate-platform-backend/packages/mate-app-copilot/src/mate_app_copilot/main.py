"""mate_app_copilot.main — FastAPI application factory."""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api import router as copilot_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-app-copilot",
        version="0.1.0",
        description="Mate Platform - APP-COPILOT AI business assistant.",
    )
    install_auth(app, extra_anonymous_paths={"/api/v1/copilot/auth/login"})
    app.include_router(copilot_router)
    return app


app = create_app()
