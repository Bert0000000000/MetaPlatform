"""mate_app_copilot.main — FastAPI application factory."""
from __future__ import annotations

from fastapi import FastAPI, Response

from mate_platform.auth import install_auth

from .api import router as copilot_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-app-copilot",
        version="0.1.0",
        description="Mate Platform - APP-COPILOT AI business assistant.",
    )
    install_auth(
        app,
        extra_anonymous_paths={"/api/v1/copilot/auth/login", "/healthz"},
    )

    # Initialize PostgreSQL tables
    try:
        from mate_tech_db.base import init_engine, Base
        from mate_app_copilot.repositories.sql_models import ConversationORM, MessageORM  # noqa: F401
        import os
        dsn = os.getenv("MATE_DB_URL") or os.getenv("PG_DSN", "postgresql://meta:meta@postgres:5432/metaplatform")
        init_engine(dsn)
        Base.metadata.create_all(bind=init_engine(dsn))
        import logging
        logging.getLogger("mate_app_copilot").info("PostgreSQL initialized: %s", dsn.split("@")[-1])
    except Exception as e:
        import logging
        logging.getLogger("mate_app_copilot").warning("DB init failed (falling back to in-memory): %s", e)

    @app.get("/healthz")
    async def healthz() -> Response:
        return Response(content='{"status":"ok"}', media_type="application/json")

    app.include_router(copilot_router)
    return app


app = create_app()
