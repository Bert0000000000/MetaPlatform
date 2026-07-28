"""双写策略 (ST-5.4.9).

CRUD 同时写 PG 元数据 + Neo4j 关系，失败回滚。
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class DualWriteResult:
    """双写结果."""

    pg_ok: bool
    neo4j_ok: bool
    rolled_back: bool
    error: str | None = None


class DualWriter:
    """PG + Neo4j 双写器.

    写顺序：先 Neo4j（primary）后 PG（metadata）
    失败 → 同步回滚 Neo4j
    """

    def __init__(
        self,
        pg_pool: Any | None = None,
        neo4j_session: Any | None = None,
    ) -> None:
        self._pg = pg_pool
        self._neo4j = neo4j_session

    async def write(
        self,
        *,
        entity: str,
        entity_id: str,
        neo4j_cypher: str,
        neo4j_params: dict[str, Any],
        pg_sql: str,
        pg_params: dict[str, Any],
    ) -> DualWriteResult:
        """双写 Neo4j + PG；任一失败回滚.

        Args:
            entity: 实体名（class / instance / relation）
            entity_id: 实体 ID
            neo4j_cypher: Cypher 语句
            neo4j_params: Cypher 参数
            pg_sql: PG SQL
            pg_params: PG 参数
        """
        neo4j_ok = False
        try:
            # 1. 先写 Neo4j
            if self._neo4j is not None:
                await self._neo4j.run(neo4j_cypher, **neo4j_params)
            neo4j_ok = True

            # 2. 写 PG
            pg_ok = False
            try:
                if self._pg is not None:
                    async with self._pg.acquire() as conn:
                        await conn.execute(pg_sql, *pg_params.values())
                pg_ok = True
                logger.info(
                    "dual_write.ok",
                    entity=entity,
                    id=entity_id,
                )
                return DualWriteResult(pg_ok=True, neo4j_ok=True, rolled_back=False)

            except Exception as e:
                # PG 失败 → 回滚 Neo4j
                logger.error("dual_write.pg_failed.rolling_back_neo4j", error=str(e))
                if neo4j_ok and self._neo4j is not None:
                    try:
                        await self._neo4j.run(
                            "MATCH (n) WHERE id(n) = $id DETACH DELETE n",
                            id=int(entity_id),
                        )
                    except Exception as re_:
                        logger.error("dual_write.rollback_failed", error=str(re_))
                        return DualWriteResult(
                            pg_ok=False,
                            neo4j_ok=True,
                            rolled_back=False,
                            error=f"PG failed + rollback failed: {re_}",
                        )
                return DualWriteResult(
                    pg_ok=False,
                    neo4j_ok=True,
                    rolled_back=True,
                    error=str(e),
                )

        except Exception as e:
            logger.error("dual_write.neo4j_failed", entity=entity, error=str(e))
            return DualWriteResult(
                pg_ok=False,
                neo4j_ok=False,
                rolled_back=False,
                error=str(e),
            )