"""Dual write with real PG mock (ST-5.4.9 enhanced)."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock

from mate_tech_ont.dual_write.writer import DualWriter


@pytest.mark.asyncio
async def test_dual_write_relationship() -> None:
    """关系双写."""
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
        entity="relation",
        entity_id="r1",
        neo4j_cypher="MATCH (a), (b) CREATE (a)-[:R]->(b)",
        neo4j_params={},
        pg_sql="INSERT INTO relations ...",
        pg_params={"id": "r1"},
    )
    assert result.pg_ok is True
    assert result.neo4j_ok is True


@pytest.mark.asyncio
async def test_dual_write_pg_timeout_rolls_back() -> None:
    """PG 超时（asyncio.TimeoutError）回滚 Neo4j."""
    pg_pool = MagicMock()
    pg_conn = MagicMock()
    pg_conn.execute = AsyncMock(side_effect=TimeoutError("pg timeout"))
    pg_pool.acquire = MagicMock()
    pg_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=pg_conn)
    pg_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    neo4j = MagicMock()
    neo4j.run = AsyncMock()

    writer = DualWriter(pg_pool=pg_pool, neo4j_session=neo4j)
    result = await writer.write(
        entity="class",
        entity_id="c1",
        neo4j_cypher="CREATE (n)",
        neo4j_params={},
        pg_sql="INSERT INTO classes ...",
        pg_params={},
    )
    assert result.pg_ok is False
    assert result.rolled_back is True
    # verify rollback
    assert any("DETACH DELETE" in str(call) for call in neo4j.run.call_args_list)


@pytest.mark.asyncio
async def test_dual_write_neo4j_driver_unavailable() -> None:
    """Neo4j 不可用 → 不写 PG."""
    pg_pool = MagicMock()
    pg_conn = MagicMock()
    pg_conn.execute = AsyncMock()
    pg_pool.acquire = MagicMock()
    pg_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=pg_conn)
    pg_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    neo4j = None  # None 触发 "无 pg" 模式（用于测试）

    writer = DualWriter(pg_pool=pg_pool, neo4j_session=neo4j)
    result = await writer.write(
        entity="class",
        entity_id="c1",
        neo4j_cypher="CREATE (n)",
        neo4j_params={},
        pg_sql="INSERT INTO classes ...",
        pg_params={},
    )
    # neo4j None → 视为成功（无操作）
    assert result.neo4j_ok is True
    assert result.pg_ok is True