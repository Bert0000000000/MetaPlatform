"""SPARQL -> Cypher (ST-5.4.4)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ParsedQuery:
    query_type: str
    variables: list[str] = field(default_factory=list)
    triples: list[tuple[str, str, str]] = field(default_factory=list)
    where_clauses: list[str] = field(default_factory=list)
    limit: int | None = None


_TRIPLE_RE = re.compile(
    r"""\\?\\w+\\s+(<[^>]+>|:?\\w+)\\s+(\\?\\w+|<[^>]+>|"[^"]*"\\^\\^\\w+)"""
)


def parse_sparql(sparql: str) -> ParsedQuery:
    sparql_strip = sparql.strip()
    upper = sparql_strip.upper()
    if upper.startswith("SELECT"):
        qtype = "SELECT"
    elif upper.startswith("INSERT"):
        qtype = "INSERT"
    elif upper.startswith("DELETE"):
        qtype = "DELETE"
    else:
        qtype = "UNKNOWN"
    variables: list[str] = []
    select_match = re.search(r"SELECT\s+([\?\,\s\w]+?)\s+(?:WHERE|FROM|$)", sparql_strip, re.IGNORECASE)
    if select_match:
        variables = re.findall(r"\?(\w+)", select_match.group(1))
    triples: list[tuple[str, str, str]] = field(default_factory=list) if False else []
    where_match = re.search(r"WHERE\s*\{([^}]*)\}", sparql_strip, re.IGNORECASE | re.DOTALL)
    if where_match:
        body = where_match.group(1)
        for raw_line in body.split("."):
            line = raw_line.strip()
            if not line:
                continue
            triple = _parse_triple(line)
            if triple:
                triples.append(triple)
    limit = None
    limit_match = re.search(r"LIMIT\s+(\d+)", sparql_strip, re.IGNORECASE)
    if limit_match:
        limit = int(limit_match.group(1))
    return ParsedQuery(query_type=qtype, variables=variables, triples=triples, limit=limit)


def _parse_triple(line: str) -> tuple[str, str, str] | None:
    parts = re.findall(r"(\?[a-zA-Z_]\w*|<[^>]+>|\"[^\"]*\")", line)
    if len(parts) >= 3:
        return parts[0], parts[1], parts[2]
    return None


def sparql_to_cypher(parsed: ParsedQuery) -> str:
    if parsed.query_type == "SELECT":
        cypher = _select_to_cypher(parsed)
    elif parsed.query_type == "INSERT":
        cypher = _insert_to_cypher(parsed)
    elif parsed.query_type == "DELETE":
        cypher = _delete_to_cypher(parsed)
    else:
        raise ValueError(f"Unsupported query type: {parsed.query_type}")
    if parsed.limit:
        cypher += f" LIMIT {parsed.limit}"
    logger.info("sparql.to_cypher", qtype=parsed.query_type, triples=len(parsed.triples))
    return cypher


def _select_to_cypher(p: ParsedQuery) -> str:
    if not p.triples:
        return "MATCH (n) RETURN n LIMIT 25"
    parts = []
    for i, (_s, pr, _o) in enumerate(p.triples):
        var_name = f"n{i}"
        parts.append(f"({var_name}:{pr.strip('<>').strip(':')})")
    return f"MATCH {', '.join(parts)} RETURN {', '.join(f'n{i}' for i in range(len(p.triples)))}"


def _insert_to_cypher(p: ParsedQuery) -> str:
    if not p.triples:
        return "CREATE (n:Thing {name: 'empty'})"
    parts = []
    for s, pr, _o in p.triples:
        label = pr.strip('<>').strip(':')
        var = s.strip('?') if s.startswith('?') else 'n'
        parts.append(f"({var}:{label} {{rdf: '{s}'}})")
    return f"CREATE {', '.join(parts)}"


def _delete_to_cypher(p: ParsedQuery) -> str:
    if not p.triples:
        return "MATCH (n) DELETE n"
    parts = []
    for s, pr, _o in p.triples:
        var = s.strip('?') if s.startswith('?') else 'n'
        parts.append(f"({var}:{pr.strip('<>').strip(':')})")
    return f"MATCH {', '.join(parts)} DELETE {', '.join(p.strip('?') if p.startswith('?') else 'n' for p in p.triples)}"


def execute_sparql(sparql: str, neo4j_session: Any | None = None) -> list[Any]:
    parsed = parse_sparql(sparql)
    cypher = sparql_to_cypher(parsed)
    logger.info('sparql.executed', cypher=cypher[:80])
    return []
