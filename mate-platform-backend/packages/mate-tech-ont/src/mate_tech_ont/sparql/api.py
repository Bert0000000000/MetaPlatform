"""SPARQL HTTP 端点 (ST-5.4.4)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .cypher import execute_sparql, parse_sparql, sparql_to_cypher

router = APIRouter(prefix="/api/v1/ont/sparql", tags=["sparql"])


class SparqlRequest(BaseModel):
    query: str = Field(..., description="SPARQL 查询字符串")
    format: str = Field("json", description="返回格式: json | xml | csv")


class SparqlResponse(BaseModel):
    cypher: str
    bindings: list[dict[str, object]] = []
    took_ms: float = 0.0


@router.post("", response_model=SparqlResponse)
async def sparql_endpoint(req: SparqlRequest) -> SparqlResponse:
    """ST-5.4.4: SPARQL → Cypher → 执行."""
    import time
    start = time.time()

    try:
        parsed = parse_sparql(req.query)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse failed: {e}") from e

    try:
        cypher = sparql_to_cypher(parsed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # 实际应调 neo4j — mock 返回空
    bindings = execute_sparql(req.query, neo4j_session=None)

    return SparqlResponse(
        cypher=cypher,
        bindings=bindings,
        took_ms=(time.time() - start) * 1000,
    )
