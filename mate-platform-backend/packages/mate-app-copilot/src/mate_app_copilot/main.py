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
        import os

        from mate_app_copilot.repositories.outbox import SqlOutboxWriter
        from mate_app_copilot.repositories.sql_models import (  # noqa: F401
            ConversationORM,
            MessageORM,
            OutboxEventORM,
        )
        from mate_tech_db.base import Base, init_engine

        dsn = (
            os.getenv("MATE_DB_URL")
            or os.getenv("DATABASE_URL")
            or "postgresql://meta:meta@postgres:5432/metaplatform"
        )
        init_engine(dsn)
        Base.metadata.create_all(bind=init_engine(dsn))
        app.state.outbox_writer = SqlOutboxWriter()
        import logging

        logging.getLogger("mate_app_copilot").info("PostgreSQL initialized: %s", dsn.split("@")[-1])
    except Exception as e:
        import logging

        logging.getLogger("mate_app_copilot").warning(
            "DB init failed (falling back to in-memory): %s", e
        )
    if not hasattr(app.state, "outbox_writer"):
        from mate_platform.messaging.outbox import InMemoryOutboxWriter

        app.state.outbox_writer = InMemoryOutboxWriter()

    @app.get("/healthz")
    async def healthz() -> Response:
        return Response(content='{"status":"ok"}', media_type="application/json")

    app.include_router(copilot_router)
    return app


app = create_app()
