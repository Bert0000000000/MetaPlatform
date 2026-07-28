"""Explain 端点 (ST-5.4.5)."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .cypher import parse_sparql, sparql_to_cypher

router = APIRouter(prefix="/api/v1/ont/explain", tags=["sparql"])


class ExplainRequest(BaseModel):
    query: str


class ExplainResponse(BaseModel):
    cypher: str
    plan: str
    estimated_rows: int
    variables: list[str] = Field(default_factory=list)


@router.post("", response_model=ExplainResponse)
async def explain_endpoint(req: ExplainRequest) -> ExplainResponse:
    """ST-5.4.5: SPARQL EXPLAIN."""
    parsed = parse_sparql(req.query)
    cypher = sparql_to_cypher(parsed)

    # 伪 plan（实际应调 neo4j EXPLAIN / PROFILE）
    plan = (
        f"Operator: MATCH (n:Class)\n"
        f"  - Triple count: {len(parsed.triples)}\n"
        f"  - Variables: {parsed.variables or '(none)'}\n"
        f"  - Limit: {parsed.limit or 'unlimited'}\n"
    )

    # 伪 estimated_rows
    estimated_rows = max(1, len(parsed.triples) * 10)

    return ExplainResponse(
        cypher=cypher,
        plan=plan,
        estimated_rows=estimated_rows,
        variables=parsed.variables,
    )