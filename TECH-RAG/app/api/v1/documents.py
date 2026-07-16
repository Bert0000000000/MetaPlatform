"""Document upload & management endpoints (P1-RAG-02)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_chunk_service, get_doc_service, get_embedding_service
from app.models.schemas import (
    DocumentStatus,
    to_chunk_detail,
    to_doc_detail,
    to_doc_list_item,
)
from app.services.chunk_service import ChunkService
from app.services.document_service import DocumentService
from app.services.embedding_service import EmbeddingService

router = APIRouter(tags=["documents"])


def _parse_status(value: Optional[str]) -> Optional[DocumentStatus]:
    if value is None:
        return None
    try:
        return DocumentStatus(value.upper())
    except ValueError:
        return None


@router.post(
    "/knowledge-bases/{kb_id}/documents/upload",
    summary="上传文档",
)
async def upload_document(
    kb_id: str,
    request: Request,
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: DocumentService = Depends(get_doc_service),
) -> dict:
    content = await file.read()
    meta_dict = DocumentService.parse_metadata_json(metadata)
    doc = await service.upload(
        ctx.tenant_id,
        kb_id,
        file.filename or "unnamed",
        content,
        metadata=meta_dict,
    )
    return success(to_doc_detail(doc), trace_id=ctx.trace_id)


@router.get(
    "/knowledge-bases/{kb_id}/documents",
    summary="文档列表(分页)",
)
async def list_documents(
    kb_id: str,
    request: Request,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: DocumentService = Depends(get_doc_service),
) -> dict:
    ss = _parse_status(status)
    items, total = await service.list(
        ctx.tenant_id,
        kb_id,
        status=ss,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [to_doc_list_item(i) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/documents/{doc_id}", summary="文档详情")
async def get_document(
    doc_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DocumentService = Depends(get_doc_service),
) -> dict:
    doc = await service.get(ctx.tenant_id, doc_id)
    return success(to_doc_detail(doc), trace_id=ctx.trace_id)


@router.delete("/documents/{doc_id}", summary="删除文档")
async def delete_document(
    doc_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DocumentService = Depends(get_doc_service),
) -> dict:
    result = await service.delete(ctx.tenant_id, doc_id)
    return success(result, trace_id=ctx.trace_id)


# ----------------------------------------------- POST /documents/{id}/chunk


@router.post("/documents/{doc_id}/chunk", summary="触发文档分块")
async def chunk_document(
    doc_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ChunkService = Depends(get_chunk_service),
) -> dict:
    count = await service.chunk_document(doc_id, ctx.tenant_id)
    return success(
        {"documentId": doc_id, "chunkCount": count},
        trace_id=ctx.trace_id,
    )


# ---------------------------------------------- POST /documents/{id}/embed


@router.post("/documents/{doc_id}/embed", summary="触发Embedding生成")
async def embed_document(
    doc_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: EmbeddingService = Depends(get_embedding_service),
) -> dict:
    count = await service.generate_embeddings(doc_id, ctx.tenant_id)
    return success(
        {"documentId": doc_id, "embeddedCount": count},
        trace_id=ctx.trace_id,
    )


# ------------------------------------------- GET /documents/{id}/chunks


@router.get("/documents/{doc_id}/chunks", summary="查看分块列表")
async def list_chunks(
    doc_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ChunkService = Depends(get_chunk_service),
) -> dict:
    chunks = await service.list_chunks(doc_id, ctx.tenant_id)
    return success(
        [to_chunk_detail(c) for c in chunks],
        trace_id=ctx.trace_id,
    )
