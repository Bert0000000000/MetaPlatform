"""Dual write integration tests (ST-5.4.12)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_tech_ont.dual_write.writer import DualWriter


@pytest.mark.asyncio
async def test_dual_write_class_entity() -> None:
    """类实体的双写."""
    pg_pool = MagicMock()
    pg_conn = MagicMock()
    pg_conn.execute = AsyncMock()
    pg_pool.acquire = MagicMock()
    pg_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=pg_conn)
    pg_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    neo4j = MagicMock()
    neo4j.run = AsyncMock()

    writer = DualWriter(pg_pool=pg_pool, neo4j_session=neo4j)
    result = await writer.write(
        entity="class",
        entity_id="42",
        neo4j_cypher="CREATE (n:Class {id: $id})",
        neo4j_params={"id": 42},
        pg_sql="INSERT INTO classes (id, name) VALUES ($1, $2)",
        pg_params={"id": "42", "name": "Concept"},
    )
    assert result.pg_ok is True
    assert result.neo4j_ok is True
    assert result.rolled_back is False
    # 验证两个 execute 都被调用
    pg_conn.execute.assert_called_once()
    neo4j.run.assert_called_once()


@pytest.mark.asyncio
async def test_dual_write_instance_entity() -> None:
    """实例实体双写."""
    pg_pool = MagicMock()
    pg_conn = MagicMock()
    pg_conn.execute = AsyncMock()
    pg_pool.acquire = MagicMock()
    pg_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=pg_conn)
    pg_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    neo4j = MagicMock()
    neo4j.run = AsyncMock()

    writer = DualWriter(pg_pool=pg_pool, neo4j_session=neo4j)
    result = await writer.write(
        entity="instance",
        entity_id="100",
        neo4j_cypher="CREATE (n:Instance {id: $id})",
        neo4j_params={"id": 100},
        pg_sql="INSERT INTO instances ...",
        pg_params={"id": "100"},
    )
    assert result.pg_ok is True
    assert result.neo4j_ok is True
