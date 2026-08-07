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
    triples: list[tuple[str, str, str]] = []
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
    tokens = [t.strip().rstrip(";").rstrip(".") for t in line.split()]
    tokens = [t for t in tokens if t]
    if len(tokens) >= 3:
        return tokens[0], tokens[1], tokens[2]
    return None


def _term_value(term: str) -> str:
    """Strip URI brackets / literal quotes from a concrete term."""
    if term.startswith("<") and term.endswith(">"):
        return term[1:-1]
    if term.startswith('"') and term.endswith('"'):
        return term[1:-1]
    return term


def _is_variable(term: str) -> bool:
    return term.startswith("?")


def _bind_term(pattern: str, value: str, binding: dict[str, str]) -> bool:
    """Try to bind a triple-pattern term against a concrete value.

    Updates *binding* in place when the pattern is a variable.
    Returns True on match, False otherwise.
    """
    if _is_variable(pattern):
        var = pattern[1:]
        if var in binding:
            return binding[var] == value
        binding[var] = value
        return True
    return _term_value(pattern) == value


def _instance_to_triples(inst: Any) -> list[tuple[str, str, str]]:
    """Expand an Instance into RDF-like (s, p, o) candidate triples."""
    triples: list[tuple[str, str, str]] = [(inst.id, "rdf:type", inst.class_id)]
    for key, val in inst.properties.items():
        triples.append((inst.id, key, str(val)))
    return triples


def _match_pattern(
    s_pat: str,
    p_pat: str,
    o_pat: str,
    candidates: list[tuple[str, str, str]],
    binding: dict[str, str],
) -> bool:
    """Try to match a single triple pattern against candidate triples.

    Updates *binding* on success. Returns True/False.
    """
    for cs, cp, co in candidates:
        trial = dict(binding)
        if _bind_term(s_pat, cs, trial) and _bind_term(p_pat, cp, trial) and _bind_term(o_pat, co, trial):
            binding.update(trial)
            return True
    return False


def _execute_inmemory(parsed: ParsedQuery, ctx: Any) -> list[dict[str, str]]:
    """In-memory SPARQL SELECT execution against InstanceStore.

    GOVERN-03 (2026-08-07): ``ctx`` is required — the module-level
    InstanceStore singleton is no longer accepted. Reads/writes are
    filtered by ``f"ont.{ctx.tenant_id}."`` namespace prefix; payload
    namespace fields cannot be used to forge a foreign tenant.
    """
    from mate_tech_ont.instances.store import (
        TenantAccessError,
    )
    from mate_tech_ont.instances.store import (
        store as instance_store,
    )

    if ctx is None:
        raise TenantAccessError("sparql requires tenant context")

    if not hasattr(ctx, "tenant_id") or not getattr(ctx, "tenant_id", None):
        raise TenantAccessError("sparql requires tenant_id on ctx")

    tenant_prefix = f"ont.{ctx.tenant_id}."

    instances = instance_store.list_instances(ctx)

    # GOVERN-03: defence in depth — even if InstanceStore ever relaxed
    # its tenant filter, the in-memory result is re-projected through
    # the canonical ``ont.<tenant>.`` prefix.
    instances = [i for i in instances if i.namespace.startswith(tenant_prefix)]

    results: list[dict[str, str]] = []
    for inst in instances:
        candidates = _instance_to_triples(inst)
        binding: dict[str, str] = {}
        matched = True
        for s_pat, p_pat, o_pat in parsed.triples:
            if not _match_pattern(s_pat, p_pat, o_pat, candidates, binding):
                matched = False
                break
        if matched and binding:
            # Project only the SELECT variables (or all if SELECT *)
            if parsed.variables:
                projected = {v: binding[v] for v in parsed.variables if v in binding}
                if projected:
                    results.append(projected)
            else:
                results.append(binding)

    if parsed.limit is not None:
        results = results[: parsed.limit]
    return results


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


def execute_sparql(
    sparql: str,
    ctx: Any,
    neo4j_session: Any | None = None,
) -> list[dict[str, str]]:
    """Execute a SPARQL query.

    GOVERN-03 (2026-08-07): ``ctx`` is **required**. The legacy
    ``tenant_id`` keyword argument has been removed; callers must pass
    the request :class:`RequestContext`. The ``payload.tenant_id``
    field is ignored — only ``ctx.tenant_id`` is trusted.

    When *neo4j_session* is available, delegates to Neo4j (future).
    Otherwise falls back to in-memory pattern matching against
    ``InstanceStore``.
    """
    if ctx is None:
        from mate_tech_ont.instances.store import TenantAccessError

        raise TenantAccessError("sparql requires tenant context")

    parsed = parse_sparql(sparql)

    # Neo4j execution path (future).  When a real session is wired,
    # translate to Cypher and run it.  For now always use in-memory.
    if neo4j_session is not None:
        try:
            cypher = sparql_to_cypher(parsed)
            logger.info("sparql.executed.neo4j", cypher=cypher[:80])
            # Placeholder: when neo4j driver is connected, run cypher here.
        except Exception:
            logger.warning("sparql.neo4j_failed_fallback_inmemory")

    logger.info("sparql.executed.inmemory", qtype=parsed.query_type, triples=len(parsed.triples))
    if parsed.query_type != "SELECT":
        return []
    return _execute_inmemory(parsed, ctx)
