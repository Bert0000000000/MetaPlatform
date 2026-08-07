"""Neo4j repo tests (ST-5.4.2).

GOVERN-03 (2026-08-07): every public method must emit a
``DeprecationWarning``. We exercise the warning machinery without
needing a live Neo4j instance by calling the deprecation helper
directly and via the (mocked) public methods.
"""
from __future__ import annotations

import warnings

import pytest

from mate_tech_ont.repos.neo4j_repo import (
    GraphEdge,
    GraphNode,
    Neo4jGraphRepository,
    _deprecated_neo4j_method,
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


def test_deprecation_helper_emits_warning() -> None:
    """The internal ``_deprecated_neo4j_method`` helper is the single
    source of the DeprecationWarning + structlog warning."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        _deprecated_neo4j_method("create_node")
    assert any(
        issubclass(w.category, DeprecationWarning) for w in caught
    ), [str(w.message) for w in caught]
    assert any("create_node" in str(w.message) for w in caught)
    assert any("2026-12-31" in str(w.message) for w in caught)


def test_create_node_method_emits_deprecation() -> None:
    """Even without a live driver, the public method's wrapper runs.

    We patch ``_session`` so the test does not require a Neo4j instance
    but still triggers the deprecation branch.
    """
    import asyncio

    r = Neo4jGraphRepository()

    async def _fake_session(self):  # noqa: ANN001
        raise RuntimeError("no driver in test; only the wrapper should run")

    # Replace the async method; the deprecation wrapper is the FIRST line.
    r._session = _fake_session.__get__(r)  # type: ignore[method-assign]

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        with pytest.raises(RuntimeError):
            asyncio.run(r.create_node("Concept", {"k": "v"}))
    assert any(
        issubclass(w.category, DeprecationWarning) for w in caught
    ), [str(w.message) for w in caught]


def test_edge_dataclass() -> None:
    e = GraphEdge(id="e1", type="subclass_of", src_id="1", dst_id="2")
    assert e.id == "e1"
    assert e.type == "subclass_of"
