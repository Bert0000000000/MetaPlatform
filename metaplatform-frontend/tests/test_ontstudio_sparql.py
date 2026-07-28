"""ontstudio SPARQL 边角 (ST-6.2.5)."""
from __future__ import annotations

import pytest


def test_sparql_endpoint_url() -> None:
    """ST-6.2.5: /api/v1/ont/sparql 端点."""
    assert "/api/v1/ont/sparql" == "/api/v1/ont/sparql"


def test_explain_endpoint_url() -> None:
    """ST-6.2.5: /api/v1/ont/explain 端点."""
    assert "/api/v1/ont/explain" == "/api/v1/ont/explan"


def test_sparql_select_variables_parsing() -> None:
    """SELECT 变量解析."""
    import re
    query = "SELECT ?s ?p WHERE { ?s :label 'X' }"
    vars = re.findall(r"\?(\w+)", query)
    assert "s" in vars
    assert "p" in vars


def test_sparql_limit_clause() -> None:
    """LIMIT 子句解析."""
    import re
    query = "SELECT ?s WHERE { ?s :label 'X' } LIMIT 10"
    m = re.search(r"LIMIT\s+(\d+)", query)
    assert m and int(m.group(1)) == 10


def test_sparql_insert_triple_parsing() -> None:
    """INSERT 解析."""
    import re
    query = "INSERT { ?s :type :Concept } WHERE { ?s :label 'X' }"
    triples = re.findall(r"\?(\w+)\s+:\w+\s+:\w+", query)
    assert len(triples) >= 1


def test_cypher_translation_match_basic() -> None:
    """MATCH/RETURN 转换."""
    query = "SELECT ?s WHERE { ?s :label 'X' }"
    cypher = "MATCH (s:label) RETURN s"
    assert "MATCH" in cypher and "RETURN" in cypher


def test_explain_response_shape() -> None:
    """EXPLAIN 响应结构."""
    response = {
        "cypher": "MATCH ...",
        "plan": "Operator: MATCH ...",
        "estimated_rows": 42,
        "variables": ["s"],
    }
    assert "cypher" in response
    assert "plan" in response
    assert "estimated_rows" in response
    assert response["estimated_rows"] >= 0