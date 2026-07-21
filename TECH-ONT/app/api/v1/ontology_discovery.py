"""Ontology auto-discovery endpoints (V15-06)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_llm_client, get_ontology_client
from app.models.schemas import AnalyzeRequest, ImportRequest, SuggestRequest
from app.services.ontology_discovery_service import (
    LlmSuggestionClient,
    OntologyClient,
    analyze_source,
    list_data_sources,
)

router = APIRouter(tags=["ontology-discovery"])


@router.get("/data-sources", summary="列出可选数据源")
async def get_data_sources(
    ctx: RequestContext = Depends(request_context_dep),
) -> dict:
    """Return mock data sources available for ontology discovery."""
    items = list_data_sources()
    return success({"items": items, "total": len(items)}, trace_id=ctx.trace_id)


@router.post("/analyze", summary="分析数据源元数据")
async def analyze(
    body: AnalyzeRequest,
    ctx: RequestContext = Depends(request_context_dep),
) -> dict:
    """Analyze the selected data source and return candidate concepts/relations."""
    result = analyze_source(body.source_id, body.tables)
    return success(result.model_dump(by_alias=True), trace_id=ctx.trace_id)


@router.post("/{source_id}/suggest", summary="AI 命名/语义建议")
async def suggest(
    source_id: str,
    body: SuggestRequest,
    ctx: RequestContext = Depends(request_context_dep),
    llm_client: LlmSuggestionClient = Depends(get_llm_client),
) -> dict:
    """Ask TECH-LLMGW to enrich candidate names and semantics."""
    response = await llm_client.suggest(body)
    return success(
        {
            "sourceId": source_id,
            "concepts": [c.model_dump(by_alias=True) for c in response.concepts],
            "relations": [r.model_dump(by_alias=True) for r in response.relations],
        },
        trace_id=ctx.trace_id,
    )


@router.post("/import", summary="导入候选到本体")
async def import_candidates(
    body: ImportRequest,
    ctx: RequestContext = Depends(request_context_dep),
    ontology_client: OntologyClient = Depends(get_ontology_client),
) -> dict:
    """Create confirmed concepts/attributes/relations in TECH-ONT."""
    result = await ontology_client.import_candidates(body)
    return success(result.model_dump(by_alias=True), trace_id=ctx.trace_id)
