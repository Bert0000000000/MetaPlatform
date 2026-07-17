"""Context assembly endpoint (P1-RAG-09)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_context_assembly_service, get_event_service
from app.models.schemas import ContextAssemblyRequest
from app.services.context_assembly_service import ContextAssemblyService
from app.services.event_service import EventService

router = APIRouter(tags=["context"])


@router.post(
    "/context/assemble",
    summary="多源上下文融合（RAG+Ontology+历史对话）",
)
async def assemble_context(
    body: ContextAssemblyRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ContextAssemblyService = Depends(get_context_assembly_service),
    event_service: EventService = Depends(get_event_service),
) -> dict:
    """Assemble unified context from RAG, ontology, and conversation history."""

    # Publish event.
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="CONTEXT_ASSEMBLY_REQUESTED",
        payload={
            "query": body.query,
            "kbIds": body.knowledgeBaseIds,
            "ontologyConceptIds": body.ontologyConceptIds,
            "maxTokens": body.contextConfig.maxTokens,
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    result = await service.assemble(
        tenant_id=ctx.tenant_id,
        query=body.query,
        kb_ids=body.knowledgeBaseIds,
        conversation_history=[
            t.model_dump() for t in body.conversationHistory
        ],
        ontology_concept_ids=body.ontologyConceptIds,
        context_config=body.contextConfig.model_dump(),
    )

    # Publish completion event.
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="CONTEXT_ASSEMBLY_COMPLETED",
        payload={
            "sourceCount": len(result.get("sources", [])),
            "tokenCount": result.get("tokenCount", 0),
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    return success(result, trace_id=ctx.trace_id)
