"""SPARQL HTTP 端点 (ST-5.4.4).

GOVERN-03 (2026-08-07): tenant context is taken **exclusively** from
``request.state.ctx``. Payload fields (``req.tenant_id`` / similar) are
not trusted; the AuthMiddleware in ``main.py`` is the single source of
truth.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from mate_tech_ont.instances.store import TenantAccessError

from .cypher import execute_sparql, parse_sparql, sparql_to_cypher

router = APIRouter(prefix="/api/v1/ont/sparql", tags=["sparql"])


class SparqlRequest(BaseModel):
    query: str = Field(..., description="SPARQL 查询字符串")
    format: str = Field("json", description="返回格式: json | xml | csv")


class SparqlResponse(BaseModel):
    cypher: str
    bindings: list[dict[str, object]] = []
    took_ms: float = 0.0


def _require_ctx(request: Request):
    """Read the auth middleware's RequestContext from ``request.state``.

    GOVERN-03: a missing ctx is a 401, not a permissive fallback. We
    deliberately do NOT look at ``payload.tenant_id``.
    """
    ctx = getattr(request.state, "ctx", None)
    if ctx is None or not getattr(ctx, "tenant_id", None):
        raise HTTPException(status_code=401, detail="missing tenant context")
    return ctx


@router.post("", response_model=SparqlResponse)
async def sparql_endpoint(req: SparqlRequest, request: Request) -> SparqlResponse:
    """ST-5.4.4: SPARQL → Cypher → 执行."""
    import time
    start = time.time()

    ctx = _require_ctx(request)

    try:
        parsed = parse_sparql(req.query)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse failed: {e}") from e

    try:
        cypher = sparql_to_cypher(parsed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        bindings = execute_sparql(req.query, ctx, neo4j_session=None)
    except TenantAccessError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e

    return SparqlResponse(
        cypher=cypher,
        bindings=bindings,
        took_ms=(time.time() - start) * 1000,
    )
