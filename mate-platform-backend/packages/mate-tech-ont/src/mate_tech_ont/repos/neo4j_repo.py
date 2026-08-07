"""Neo4j GraphRepository (ST-5.4.2).

实现 W2-3.5 Protocol：节点 / 边 CRUD + 简单查询。

GOVERN-03 (2026-08-07): deprecated. v3.1 ontology now writes through
``v2_kernel.pg_repo`` (PostgreSQL-only) using the 12 KERNEL-01 primitives
(ADR-0021). Neo4j remains as a read-only legacy adaptor and is gated by
the ``legacy-ont`` compose profile. The methods below emit a
``DeprecationWarning`` on every call so production traffic is visible
during the Sunset window (2026-12-31).
"""
from __future__ import annotations

import os
import warnings
from dataclasses import dataclass
from typing import Any

import structlog
from neo4j import AsyncGraphDatabase

logger = structlog.get_logger(__name__)


def _deprecated_neo4j_method(method_name: str) -> None:
    """Emit a DeprecationWarning for a Neo4jGraphRepository method.

    GOVERN-03: v3.1 ontology persists through KERNEL-01 v2_kernel.pg_repo
    (ADR-0021). Neo4jGraphRepository is kept only as a legacy adaptor and
    will be removed in the Sunset window end (2026-12-31).
    """
    warnings.warn(
        f"Neo4jGraphRepository.{method_name} is deprecated; use mate-tech-ont "
        f"v2_kernel router / pg_repo (ADR-0021 + GOVERN-03). Sunset 2026-12-31.",
        DeprecationWarning,
        stacklevel=3,
    )
    logger.warning(
        "neo4j_repo.deprecated_call",
        method=method_name,
        sunset="2026-12-31",
        replacement="v2_kernel.pg_repo",
    )


@dataclass(frozen=True, slots=True)
class GraphNode:
    id: str
    label: str
    properties: dict[str, Any]


@dataclass(frozen=True, slots=True)
class GraphEdge:
    id: str
    type: str
    src_id: str
    dst_id: str
    properties: dict[str, Any] = None


class Neo4jGraphRepository:
    def __init__(
        self,
        uri: str | None = None,
        user: str | None = None,
        password: str | None = None,
    ) -> None:
        self._uri = uri or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self._user = user or os.getenv("NEO4J_USER", "neo4j")
        self._password = password or os.getenv("NEO4J_PASSWORD", "mate-pass")
        self._driver: Any | None = None

    async def connect(self) -> None:
        if self._driver is not None:
            return
        self._driver = AsyncGraphDatabase.driver(
            self._uri, auth=(self._user, self._password)
        )
        logger.info("neo4j.connected", uri=self._uri)

    async def close(self) -> None:
        if self._driver is not None:
            await self._driver.close()
            self._driver = None

    async def _session(self) -> Any:
        assert self._driver is not None
        return self._driver.session()

    async def create_node(self, label: str, properties: dict[str, Any]) -> GraphNode:
        _deprecated_neo4j_method("create_node")
        async with await self._session() as session:
            result = await session.run(
                "CREATE (n:$label $props) RETURN id(n) AS id",
                label=label,
                props=properties,
            )
            records = [r.data() async for r in result]
            node_id = str(records[0]["id"]) if records else ""
        logger.info("neo4j.node.created", label=label, id=node_id)
        return GraphNode(id=node_id, label=label, properties=properties)

    async def get_node(self, node_id: str) -> GraphNode | None:
        _deprecated_neo4j_method("get_node")
        async with await self._session() as session:
            result = await session.run(
                "MATCH (n) WHERE id(n) = $id RETURN n, labels(n) AS labels",
                id=int(node_id),
            )
            records = [r.data() async for r in result]
            if not records:
                return None
            data = records[0]
            return GraphNode(
                id=node_id,
                label=data["labels"][0] if data["labels"] else "",
                properties=dict(data["n"]),
            )

    async def create_edge(
        self,
        type_: str,
        src_id: str,
        dst_id: str,
        properties: dict[str, Any] | None = None,
    ) -> GraphEdge:
        _deprecated_neo4j_method("create_edge")
        async with await self._session() as session:
            result = await session.run(
                """
                MATCH (s), (d)
                WHERE id(s) = $src AND id(d) = $dst
                CREATE (s)-[r:$type $props]->(d)
                RETURN id(r) AS id
                """,
                type=type_,
                src=int(src_id),
                dst=int(dst_id),
                props=properties or {},
            )
            records = [r.data() async for r in result]
            edge_id = str(records[0]["id"]) if records else ""
        logger.info(
            "neo4j.edge.created", type=type_, src=src_id, dst=dst_id, id=edge_id
        )
        return GraphEdge(
            id=edge_id, type=type_, src_id=src_id, dst_id=dst_id,
            properties=properties or {},
        )

    async def find_path(
        self, src_id: str, dst_id: str, *, max_depth: int = 5
    ) -> list[list[str]]:
        _deprecated_neo4j_method("find_path")
        async with await self._session() as session:
            result = await session.run(
                """
                MATCH p = shortestPath(
                    (s)-[*..$max_depth]-(d)
                )
                WHERE id(s) = $src AND id(d) = $dst
                RETURN [n IN nodes(p) | toString(id(n))] AS path
                """,
                src=int(src_id),
                dst=int(dst_id),
                max_depth=max_depth,
            )
            return [r.data()["path"] async for r in result]


def create_neo4j_repository() -> Neo4jGraphRepository:
    return Neo4jGraphRepository()
