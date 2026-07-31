"""FastAPI routes (ST-5.5.9).

/chat + /chat/stream + /embeddings 三端点集成。

Path alignment (P0 close-out, 2026-07-30):
  - Canonical prefix is now `/api/v1/llmgw/*` to match the spec
    (contracts/openapi/platform.yaml / services/llmgw.yaml).
    The legacy `/api/v1/llm/*` prefix is retained as a DEPRECATED
    alias for one release; both prefixes reach the same handler
    bodies, but the legacy paths emit the RFC 8594 Deprecation
    response header pointing at the canonical prefix.
"""
from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from ..stream.sse import make_streaming_response
from .chat import ChatMessage
from .router import chat as router_chat

logger = structlog.get_logger(__name__)

# Canonical prefix per the spec.
router = APIRouter(prefix="/api/v1/llmgw", tags=["llmgw"])

# Legacy prefix is the deprecated alias of /api/v1/llmgw.
_DEPRECATION_HEADER_VALUE = 'true; target="/api/v1/llmgw"'
legacy_router = APIRouter(prefix="/api/v1/llm", tags=["llmgw-deprecated"], deprecated=True)


class ChatRequest(BaseModel):
    """ST-5.5.9.1: /chat 请求体."""

    model: str = Field(..., description="模型名（gpt-4o, claude-3-5-sonnet-20241022, etc.）")
    messages: list[ChatMessage]
    temperature: float = 1.0
    max_tokens: int | None = None
    tools: list[dict[str, Any]] | None = None


class ChatResponseAPI(BaseModel):
    """/chat 响应体."""

    content: str
    model: str
    finish_reason: str | None = None
    tool_calls: list[dict[str, Any]] = []
    usage: dict[str, int] = {}


@router.post("/chat", response_model=ChatResponseAPI)
async def chat_endpoint(req: ChatRequest) -> ChatResponseAPI:
    """非流式 chat 端点."""
    try:
        resp = await router_chat(
            req.model,
            req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            tools=req.tools,
        )
        return ChatResponseAPI(**resp.__dict__)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.error("llmgw.chat.error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def _mock_stream(req: ChatRequest):
    """ST-5.5.7 配套：mock token 流（实际生产应替换为 provider 的 stream 接口）."""
    for i, word in enumerate(("hello", " ", "world")):
        yield {"type": "token", "data": {"text": word, "index": i}}
    yield {"type": "final", "data": {"finish_reason": "stop"}}


@router.post("/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """ST-5.5.7: SSE 流式 chat 端点."""
    return make_streaming_response(
        _mock_stream,
        messages=req.messages,
        model=req.model,
        temperature=req.temperature,
    )


class EmbeddingRequest(BaseModel):
    """/embeddings 请求体."""

    model: str = Field("text-embedding-3-small", description="embedding 模型")
    input: list[str] = Field(..., description="待嵌入文本")


class EmbeddingResponse(BaseModel):
    """/embeddings 响应体."""

    model: str
    data: list[dict[str, Any]]
    usage: dict[str, int] = {}


@router.post("/embeddings", response_model=EmbeddingResponse)
async def embeddings_endpoint(req: EmbeddingRequest) -> EmbeddingResponse:
    """/embeddings 端点（占位 — 实际实现见 W5-6 tech-rag 嵌入层）."""
    # TODO: 接入实际 embedding provider
    return EmbeddingResponse(
        model=req.model,
        data=[{"index": i, "embedding": [0.0] * 1536} for i in range(len(req.input))],
        usage={"prompt_tokens": sum(len(s.split()) for s in req.input)},
    )


# ---------------------------------------------------------------------------
# Deprecated alias handlers under /api/v1/llm/*  (P0 close-out 2026-07-30)
# These re-emit the canonical handler result with an RFC 8594 Deprecation
# response header pointing at /api/v1/llmgw/*, so existing clients (the
# BFF `bff/src/server.ts` route table and the EmbeddedChat tests) keep
# working for one release while callers migrate.
# ---------------------------------------------------------------------------
def _deprecation_header() -> dict[str, str]:
    return {"Deprecation": _DEPRECATION_HEADER_VALUE}


@legacy_router.post(
    "/chat",
    response_model=ChatResponseAPI,
    deprecated=True,
)
async def _legacy_chat(req: ChatRequest, response: Response) -> ChatResponseAPI:
    try:
        resp = await router_chat(
            req.model,
            req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            tools=req.tools,
        )
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.error("llmgw.chat.error.legacy", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    response.headers.update(_deprecation_header())
    return ChatResponseAPI(**resp.__dict__)


@legacy_router.post(
    "/chat/stream",
    deprecated=True,
)
async def _legacy_chat_stream(req: ChatRequest, response: Response):
    response.headers.update(_deprecation_header())
    return make_streaming_response(
        _mock_stream,
        messages=req.messages,
        model=req.model,
        temperature=req.temperature,
    )


@legacy_router.post(
    "/embeddings",
    response_model=EmbeddingResponse,
    deprecated=True,
)
async def _legacy_embeddings(req: EmbeddingRequest, response: Response) -> EmbeddingResponse:
    response.headers.update(_deprecation_header())
    return EmbeddingResponse(
        model=req.model,
        data=[{"index": i, "embedding": [0.0] * 1536} for i in range(len(req.input))],
        usage={"prompt_tokens": sum(len(s.split()) for s in req.input)},
    )