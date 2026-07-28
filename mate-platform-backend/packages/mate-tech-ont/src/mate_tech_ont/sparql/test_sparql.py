"""SPARQL tests (ST-5.4.4 + ST-5.4.5)."""
from __future__ import annotations

import pytest

from mate_tech_ont.sparql.cypher import (
    parse_sparql,
    sparql_to_cypher,
)


def test_parse_select_basic() -> None:
    """ST-5.4.4: SELECT ?x ?y."""
    q = "SELECT ?x ?y WHERE { ?x :label ?y }"
    parsed = parse_sparql(q)
    assert parsed.query_type == "SELECT"
    assert "x" in parsed.variables
    assert "y" in parsed.variables
    assert len(parsed.triples) == 1


def test_parse_insert() -> None:
    q = "INSERT { ?s :type :Concept } WHERE { ?s :label 'X' }"
    parsed = parse_sparql(q)
    assert parsed.query_type == "INSERT"


def test_parse_delete() -> None:
    q = "DELETE { ?s :type :Concept } WHERE { ?s :label 'X' }"
    parsed = parse_sparql(q)
    assert parsed.query_type == "DELETE"


def test_parse_with_limit() -> None:
    q = "SELECT ?x WHERE { ?x :label 'Y' } LIMIT 10"
    parsed = parse_sparql(q)
    assert parsed.limit == 10


def test_select_to_cypher() -> None:
    parsed = parse_sparql("SELECT ?s WHERE { ?s :label 'X' }")
    cypher = sparql_to_cypher(parsed)
    assert "MATCH" in cypher
    assert "RETURN" in cypher


def test_insert_to_cypher() -> None:
    parsed = parse_sparql("INSERT { ?s :type :Concept } WHERE { ?s :label 'X' }")
    cypher = sparql_to_cypher(parsed)
    assert "CREATE" in cypher


def test_delete_to_cypher() -> None:
    parsed = parse_sparql("DELETE { ?s :type :Concept } WHERE { ?s :label 'X' }")
    cypher = sparql_to_cypher(parsed)
    assert "DELETE" in cypher


def test_limit_in_cypher() -> None:
    parsed = parse_sparql("SELECT ?s WHERE { ?s :label 'X' } LIMIT 5")
    cypher = sparql_to_cypher(parsed)
    assert "LIMIT 5" in cypher


def test_parsed_query_dataclass() -> None:
    from mate_tech_ont.sparql.cypher import ParsedQuery
    p = ParsedQuery(query_type="SELECT", variables=["x"], triples=[])
    assert p.query_type == "SELECT"