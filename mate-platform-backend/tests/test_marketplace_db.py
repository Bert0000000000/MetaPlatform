"""Marketplace DB schema tests.

Hard rule #3: 必须使用 project 的 DeclarativeBase + 4 张表迁移可逆。
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

# Trigger model import (registers on Base.metadata)
import mate_platform.marketplace.domain.subscription  # noqa: F401
import mate_platform.marketplace.domain.install  # noqa: F401
import mate_platform.marketplace.domain.instance  # noqa: F401

from mate_tech_db.base import Base


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.mark.asyncio
async def test_marketplace_subscription_columns(engine):
    async with engine.connect() as conn:
        cols = await conn.run_sync(
            lambda c: inspect(c).get_columns("marketplace_subscription")
        )
    col_names = {c["name"] for c in cols}
    expected = {
        "id",
        "tenant_id",
        "sku",
        "license_key",
        "status",
        "license_payload",
        "purchased_at",
    }
    assert expected.issubset(col_names), (
        f"marketplace_subscription 缺少字段 {expected - col_names}"
    )


@pytest.mark.asyncio
async def test_marketplace_install_columns_and_indexes(engine):
    async with engine.connect() as conn:
        cols = await conn.run_sync(
            lambda c: inspect(c).get_columns("marketplace_install")
        )
        idx = await conn.run_sync(
            lambda c: inspect(c).get_indexes("marketplace_install")
        )
    col_names = {c["name"] for c in cols}
    expected = {
        "id",
        "tenant_id",
        "kind",
        "artifact_id",
        "version",
        "digest_sha256",
        "state",
        "installed_by",
    }
    assert expected.issubset(col_names)
    # 至少有 kind_artifact 复合索引
    assert any(
        {"kind", "artifact_id"}.issubset(set(i["column_names"]))
        for i in idx
    ), "缺少 ix_marketplace_install_kind_artifact 索引"


@pytest.mark.asyncio
async def test_marketplace_instance_fk_to_install(engine):
    async with engine.connect() as conn:
        fks = await conn.run_sync(
            lambda c: inspect(c).get_foreign_keys("marketplace_instance")
        )
    assert any(
        fk["referred_table"] == "marketplace_install" for fk in fks
    ), "marketplace_instance 缺少到 marketplace_install 的外键"