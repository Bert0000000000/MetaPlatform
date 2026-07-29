"""Shared pytest fixtures for mate-tech-iam tests."""
from __future__ import annotations

import os
import tempfile
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Force in-memory SQLite and disable telemetry BEFORE app import.
os.environ.setdefault("IAM_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("IAM_DATA_DIR", tempfile.mkdtemp(prefix="mate-iam-test-"))
os.environ.setdefault("IAM_DEV_JWT_SECRET", "test-secret")
os.environ.setdefault("LOG_LEVEL", "WARNING")

from mate_tech_iam.db import AsyncSessionMaker, engine, init_db
from mate_tech_iam.main import app
from mate_tech_iam.seed import seed
from mate_tech_iam.services.deps import (
    JWT_SECRET,
)


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    await init_db()
    async with AsyncSessionMaker() as session:
        await seed(session)
        yield session
    # Drop tables for next test.
    from sqlmodel import SQLModel

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """AsyncClient wrapping the FastAPI app, with dev headers pre-set."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={
            "x-mate-tenant-id": "tenant-default",
            "x-mate-dev-user": "admin",
            "x-mate-roles": "PLATFORM_SUPER_ADMIN,PLATFORM_ADMIN",
        },
    ) as ac:
        yield ac


def make_token(sub: str, roles: list[str], tenant: str = "tenant-default") -> str:
    """Helper to build a JWT compatible with deps.parse_token."""
    import jwt

    return jwt.encode(
        {"sub": sub, "roles": roles, "tenant_id": tenant},
        JWT_SECRET,
        algorithm="HS256",
    )
