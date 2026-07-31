"""Dual write tests (ST-5.4.9)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_tech_ont.dual_write.writer import DualWriter, DualWriteResult


@pytest.mark.asyncio
async def test_both_ok() -> None:
    """Neo4j + PG 都成功."""
    pg_pool = MagicMock()
    pg_pool.acquire = MagicMock()
    pg_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
    pg_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    pg_conn = pg_pool.acquire.return_value.__aenter__.return_value
    pg_conn.execute = AsyncMock()

    neo4j = MagicMock()
    neo4j.run = AsyncMock()

    writer = DualWriter(pg_pool=pg_pool, neo4j_session=neo4j)
    result = await writer.write(
        entity="class",
        entity_id="42",
        neo4j_cypher="CREATE (n) RETURN n",
        neo4j_params={},
        pg_sql="INSERT INTO classes ...",
        pg_params={"id": "42", "name": "X"},
    )
    assert result.pg_ok is True
    assert result.neo4j_ok is True
    assert result.rolled_back is False


@pytest.mark.asyncio
async def test_pg_failure_rolls_back_neo4j() -> None:
    """PG 失败 → Neo4j 回滚."""
    pg_pool = MagicMock()
    pg_pool.acquire = MagicMock()
    pg_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
    pg_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    pg_conn = pg_pool.acquire.return_value.__aenter__.return_value
    pg_conn.execute = AsyncMock(side_effect=RuntimeError("pg down"))

    neo4j = MagicMock()
    neo4j.run = AsyncMock()

    writer = DualWriter(pg_pool=pg_pool, neo4j_session=neo4j)
    result = await writer.write(
        entity="class",
        entity_id="42",
        neo4j_cypher="CREATE (n) RETURN n",
        neo4j_params={},
        pg_sql="INSERT INTO classes ...",
        pg_params={"id": "42"},
    )
    assert result.pg_ok is False
    assert result.neo4j_ok is True
    assert result.rolled_back is True
    assert result.error is not None and "pg down" in result.error
    # 验证回滚被调用
    assert neo4j.run.call_count == 2  # CREATE + DELETE


@pytest.mark.asyncio
async def test_neo4j_failure_no_pg() -> None:
    """Neo4j 失败 → 不写 PG."""
    pg_pool = MagicMock()
    pg_pool.acquire = MagicMock()
    pg_conn = MagicMock()
    pg_conn.execute = AsyncMock()
    pg_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=pg_conn)
    pg_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    neo4j = MagicMock()
    neo4j.run = AsyncMock(side_effect=RuntimeError("neo4j down"))

    writer = DualWriter(pg_pool=pg_pool, neo4j_session=neo4j)
    result = await writer.write(
        entity="class",
        entity_id="42",
        neo4j_cypher="CREATE (n) RETURN n",
        neo4j_params={},
        pg_sql="INSERT INTO classes ...",
        pg_params={"id": "42"},
    )
    assert result.pg_ok is False
    assert result.neo4j_ok is False
    # PG.execute 未被调用
    pg_conn.execute.assert_not_called()


def test_dual_write_result_dataclass() -> None:
    r = DualWriteResult(pg_ok=True, neo4j_ok=True, rolled_back=False)
    assert r.error is None
