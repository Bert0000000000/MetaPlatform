"""Multimodal chat endpoints (P1-LLMGW-02)."""

from __future__ import annotations

import base64
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.chat.schemas import MultimodalImage, MultimodalRequest, StreamChatRequest
from app.chat.service import ChatService
from app.chat.stream_service import build_multimodal_request, stream_response
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import (
    InvalidFieldValueError,
    InvalidParamError,
    InvalidRequestError,
    UnsupportedModalityError,
)
from app.deps import get_chat_service

router = APIRouter(tags=["chat"])


_ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB raw
_MAX_B64_BYTES = 7 * 1024 * 1024  # ~5MB raw after base64 expansion


def _ensure_image_count(images: List[MultimodalImage]) -> None:
    if not images:
        raise InvalidParamError("images 不能为空")
    if len(images) > 8:
        raise InvalidParamError(
            f"images 数量 {len(images)} 超过上限 8",
            data={"max": 8, "received": len(images)},
        )


@router.post("/chat/multimodal", summary="多模态对话（内联图片）")
async def chat_multimodal(
    request: Request,
    body: MultimodalRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: ChatService = Depends(get_chat_service),
) -> dict:
    _ensure_image_count(body.images)
    resp = service.multimodal(ctx.tenant_id, body)
    return success(
        {
            "id": resp.id,
            "model": resp.model,
            "provider": resp.provider,
            "content": resp.content,
            "finishReason": resp.finishReason,
            "usage": resp.usage.model_dump(),
            "latencyMs": resp.latencyMs,
        },
        trace_id=ctx.trace_id,
    )


@router.post("/chat/multimodal/upload", summary="多模态对话（multipart 上传）")
async def chat_multimodal_upload(
    request: Request,
    modelId: str = Form(...),
    text: str = Form(..., min_length=1, max_length=8192),
    temperature: float = Form(default=0.7),
    maxTokens: int = Form(default=1024, ge=1, le=8192),
    systemPrompt: Optional[str] = Form(default=None),
    image: List[UploadFile] = File(...),
    ctx: RequestContext = Depends(request_context_dep),
    service: ChatService = Depends(get_chat_service),
) -> dict:
    if not image:
        raise InvalidParamError("至少上传 1 张图片")
    if len(image) > 8:
        raise InvalidParamError(
            f"图片数量 {len(image)} 超过上限 8",
            data={"max": 8, "received": len(image)},
        )

    images: List[MultimodalImage] = []
    for idx, f in enumerate(image):
        mime = (f.content_type or "").lower()
        if mime not in _ALLOWED_IMAGE_MIME:
            raise InvalidFieldValueError(
                f"image[{idx}] MIME 类型不支持: {mime}",
                data={"allowed": sorted(_ALLOWED_IMAGE_MIME)},
            )
        data = await f.read()
        if not data:
            raise InvalidParamError(f"image[{idx}] 内容为空")
        if len(data) > _MAX_IMAGE_BYTES:
            raise InvalidParamError(
                f"image[{idx}] 超过 { _MAX_IMAGE_BYTES // (1024 * 1024) }MB 限制"
            )
        b64 = base64.b64encode(data).decode("ascii")
        if len(b64) > _MAX_B64_BYTES:
            raise InvalidParamError(
                f"image[{idx}] base64 编码超过 { _MAX_B64_BYTES // (1024 * 1024) }MB 限制"
            )
        images.append(
            MultimodalImage(
                base64=f"data:{mime};base64,{b64}",
                detail="auto",
            )
        )

    body = MultimodalRequest(
        modelId=modelId,
        text=text,
        images=images,
        temperature=temperature,
        maxTokens=maxTokens,
        systemPrompt=systemPrompt,
    )
    resp = service.multimodal(ctx.tenant_id, body)
    return success(
        {
            "id": resp.id,
            "model": resp.model,
            "provider": resp.provider,
            "content": resp.content,
            "finishReason": resp.finishReason,
            "usage": resp.usage.model_dump(),
            "latencyMs": resp.latencyMs,
        },
        trace_id=ctx.trace_id,
    )


# Re-export to keep module-level imports tidy in __init__.
_ = UnsupportedModalityError  # silence unused-import warning if module is partial


@router.post("/chat/stream", summary="流式对话（SSE）")
async def chat_stream(
    request: Request,
    body: StreamChatRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    if not body.text or not body.text.strip():
        raise InvalidRequestError("消息内容不能为空")

    # Pre-compute the full response so business errors (404, 422, …) are
    # raised *before* the StreamingResponse sends its 200 headers.
    mm_request = build_multimodal_request(body)
    resp = service.multimodal(ctx.tenant_id, mm_request)

    return StreamingResponse(
        stream_response(resp),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Trace-Id": ctx.trace_id,
        },
    )