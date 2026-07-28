"""Neo4j repo tests (ST-5.4.2)."""
from __future__ import annotations

import pytest

from mate_tech_ont.repos.neo4j_repo import (
    GraphEdge,
    GraphNode,
    Neo4jGraphRepository,
    create_neo4j_repository,
)


def test_create_factory() -> None:
    r = create_neo4j_repository()
    assert r._uri == "bolt://localhost:7687"
    assert r._user == "neo4j"
    assert r._password == "mate-pass"


def test_repository_defaults() -> None:
    r = Neo4jGraphRepository()
    assert r._driver is None


def test_node_dataclass() -> None:
    n = GraphNode(id="1", label="Concept", properties={"name": "X"})
    assert n.id == "1"
    assert n.label == "Concept"
    assert n.properties == {"name": "X"}


def test_edge_dataclass() -> None:
    e = GraphEdge(id="e1", type="subclass_of", src_id="1", dst_id="2")
    assert e.id == "e1"
    assert e.type == "subclass_of"