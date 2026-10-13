"""Issue #131: explicit legacy syntax errors and real tenant-scoped HTTP reads."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.instances.store import Instance, store
from mate_tech_ont.main import app
from mate_tech_ont.security.tenant import TenantContext
from mate_tech_ont.sparql.cypher import execute_sparql, parse_sparql, sparql_to_cypher

_UNSUPPORTED = [
    ("SELECT ?s WHERE { ?s rdf:type ?o . FILTER(?o = 'x') }", "FILTER"),
    ("SELECT ?s WHERE { ?s rdf:type ?o . filter (?o = 'x') }", "FILTER"),
    ("SELECT ?s WHERE { ?s rdf:type ?o . FiLtEr(?o = 'x') }", "FILTER"),
    ("SELECT ?s WHERE { ?s rdf:type ?o .FILTER(?o = 'x') }", "FILTER"),
    ("SELECT ?s WHERE { ?s rdf:type ?o . OPTIONAL { ?s label ?v } }", "OPTIONAL"),
    ("SELECT ?s WHERE { ?s rdf:type ?o . optional{ ?s label ?v } }", "OPTIONAL"),
    ("SELECT ?s WHERE { ?s rdf:type ?o . OpTiOnAl { ?s label ?v } }", "OPTIONAL"),
    (
        "SELECT ?s WHERE { ?s rdf:type ?o . # harmless FILTER\nOPTIONAL { ?s label ?v } }",
        "OPTIONAL",
    ),
    ("SELECT ?s WHERE { ?s rdf:type ?o . # harmless OPTIONAL\rFILTER(?o = 'x') }", "FILTER"),
    ('SELECT ?s WHERE { ?s label "OPTIONAL" . FILTER(?s = ?s) }', "FILTER"),
    ("SELECT ?s WHERE { ?s <urn:FILTER#OPTIONAL> ?o . OPTIONAL { ?s label ?v } }", "OPTIONAL"),
    ('SELECT ?s WHERE { ?s label "# comment" . FILTER(?s = ?s) }', "FILTER"),
    ("SELECT ?s WHERE { ?s label 'x' . FILTER(?s < 5 && ?s > 0) }", "FILTER"),
]

_KEYWORD_TEXT = [
    'SELECT ?s WHERE { ?s label "FILTER" }',
    "SELECT ?s WHERE { ?s label 'OPTIONAL' }",
    'SELECT ?s WHERE { ?s label "FILTER OPTIONAL" }',
    r'SELECT ?s WHERE { ?s label "escaped \" FILTER OPTIONAL" }',
    r"SELECT ?s WHERE { ?s label 'escaped \' OPTIONAL FILTER' }",
    'SELECT ?s WHERE { ?s label """FILTER\nOPTIONAL""" }',
    "SELECT ?s WHERE { ?s label '''OPTIONAL\nFILTER''' }",
    'SELECT ?s WHERE { ?s label """one " FILTER \' OPTIONAL""" }',
    "SELECT ?s WHERE { ?s <urn:FILTER> ?o }",
    "SELECT ?s WHERE { ?s <https://example.test/OPTIONAL/FILTER> ?o }",
    "SELECT ?s WHERE { ?s <urn:example#FILTER> ?o }",
    "SELECT ?FILTER WHERE { ?FILTER rdf:type ?OPTIONAL }",
    "SELECT ?s WHERE { $OPTIONAL rdf:type $FILTER }",
    "SELECT ?s WHERE { ?s :FILTER :OPTIONAL }",
    "SELECT ?s WHERE { ?s ex:FILTER ex:OPTIONAL }",
    "SELECT ?s WHERE { ?s FILTER:label OPTIONAL:Thing }",
    "SELECT ?s WHERE { ?s ex:some.FILTER ex:some-OPTIONAL }",
    r"SELECT ?s WHERE { ?s ex:some\~FILTER ex:some\-OPTIONAL }",
    "SELECT ?s WHERE { ?s rdf:type ?o } # FILTER OPTIONAL",
    "SELECT ?s WHERE { ?s rdf:type ?o . # FILTER OPTIONAL\n }",
    "SELECT ?s WHERE { ?s rdf:type ?o . # FILTER OPTIONAL\r }",
    "SELECT ?s WHERE { ?s FILTERED OPTIONALLY }",
]


@pytest.mark.parametrize(("query", "keyword"), _UNSUPPORTED)
def test_parser_rejects_unsupported_syntax(query: str, keyword: str) -> None:
    with pytest.raises(ValueError, match=f"^Unsupported SPARQL syntax: {keyword}$"):
        parse_sparql(query)


@pytest.mark.parametrize("query", _KEYWORD_TEXT)
def test_parser_does_not_reject_keyword_text(query: str) -> None:
    assert parse_sparql(query).query_type == "SELECT"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def sample_instances() -> tuple[Instance, Instance, Instance]:
    own_ctx = TenantContext(tenant_id="tenant-acme", user_id="u-1", roles=("editor",))
    foreign_ctx = TenantContext(tenant_id="issue131-foreign", user_id="other", roles=("editor",))
    first = store.create_instance(own_ctx, "Issue131", {"label": "FILTER"})
    second = store.create_instance(own_ctx, "Issue131", {"label": "OPTIONAL"})
    foreign = store.create_instance(foreign_ctx, "Issue131", {"label": "FILTER"})
    return first, second, foreign


@pytest.mark.parametrize(("query", "keyword"), _UNSUPPORTED)
def test_http_rejects_unsupported_syntax_without_mutations(
    client: TestClient,
    auth_headers: dict[str, str],
    sample_instances: tuple[Instance, Instance, Instance],
    query: str,
    keyword: str,
) -> None:
    before = dict(store._instances)
    response = client.post("/api/v1/ont/sparql", json={"query": query}, headers=auth_headers)
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == f"Parse failed: Unsupported SPARQL syntax: {keyword}"
    assert store._instances == before
    assert len(before) == len(sample_instances)


def test_http_select_limit_reads_only_authenticated_tenant(
    client: TestClient,
    auth_headers: dict[str, str],
    sample_instances: tuple[Instance, Instance, Instance],
) -> None:
    first, second, foreign = sample_instances
    query = "SELECT ?s WHERE { ?s rdf:type Issue131 } LIMIT 1"
    response = client.post(
        "/api/v1/ont/sparql",
        json={"query": query, "tenant_id": "issue131-foreign"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["bindings"] == [{"s": first.id}]
    assert execute_sparql(query, TenantContext(tenant_id="issue131-foreign", user_id="other")) == [
        {"s": foreign.id}
    ]
    assert (
        store.get_instance(TenantContext(tenant_id="tenant-acme", user_id="u-1"), second.id)
        == second
    )


@pytest.mark.parametrize("label", ["FILTER", "OPTIONAL"])
def test_http_keyword_literal_remains_queryable(
    client: TestClient,
    auth_headers: dict[str, str],
    sample_instances: tuple[Instance, Instance, Instance],
    label: str,
) -> None:
    first, second, _ = sample_instances
    expected = first if label == "FILTER" else second
    response = client.post(
        "/api/v1/ont/sparql",
        json={"query": f'SELECT ?s WHERE {{ ?s label "{label}" }} LIMIT 1'},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["bindings"] == [{"s": expected.id}]


@pytest.mark.parametrize("query", [_UNSUPPORTED[0][0], "SELECT ?s WHERE { ?s rdf:type ?o }"])
def test_http_requires_authentication_before_parsing(client: TestClient, query: str) -> None:
    assert client.post("/api/v1/ont/sparql", json={"query": query}).status_code == 401


def test_delete_translation_preserves_subject_variable() -> None:
    parsed = parse_sparql("DELETE { ?s :type :Concept } WHERE { ?s :label 'X' }")
    assert sparql_to_cypher(parsed) == "MATCH (s:label) DELETE s"
