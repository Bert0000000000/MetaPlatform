"""mate_app_arch.main — FastAPI application factory."""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api import router as arch_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-app-arch",
        version="0.1.0",
        description="Mate Platform - APP-ARCH architecture center.",
    )
    install_auth(app)
    app.include_router(arch_router)
    return app


app = create_app()
