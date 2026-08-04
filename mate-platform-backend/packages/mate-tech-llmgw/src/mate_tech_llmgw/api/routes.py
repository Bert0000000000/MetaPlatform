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

# P3-W9: management API helpers (cache / quota / cost singletons).
from ..quota.bucket import QuotaExceededError  # noqa: E402
from ..router import get_cache, get_cost_recorder, get_quota_bucket  # noqa: E402

# Canonical prefix per the spec.
router = APIRouter(prefix="/api/v1/llmgw", tags=["llmgw"])

# Legacy prefix is the deprecated alias of /api/v1/llmgw.
_DEPRECATION_HEADER_VALUE = 'true; target="/api/v1/llmgw"'
legacy_router = APIRouter(prefix="/api/v1/llm", tags=["llmgw-deprecated"], deprecated=True)


class ChatRequest(BaseModel):
    """ST-5.5.9.1: /chat 请求体."""

    model: str = Field(..., description="模型名(gpt-4o, claude-3-5-sonnet-20241022, etc.)")
    messages: list[ChatMessage]
    temperature: float = 1.0
    max_tokens: int | None = None
    tools: list[dict[str, Any]] | None = None
    tenant_id: str = Field(default="default", description="租户 ID")


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
            tenant_id=req.tenant_id,
        )
        return ChatResponseAPI(**resp.__dict__)
    except HTTPException:
        raise
    except (NotImplementedError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("llmgw.chat.error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _mock_stream(req: ChatRequest):
    """ST-5.5.7 配套:mock token 流(实际生产应替换为 provider 的 stream 接口)."""
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
    provider: str = Field(
        default="",
        description="embedding provider: openai | doubao | local (默认按 model 推断)",
    )
    tenant_id: str = Field(default="default", description="租户 ID")


class EmbeddingResponse(BaseModel):
    """/embeddings 响应体 (OpenAI 兼容格式)."""

    model: str
    dimensions: int = 0
    data: list[dict[str, Any]]
    usage: dict[str, int] = {}


def _infer_embedding_provider(model: str, explicit: str) -> str:
    """根据 model 名推断 embedding provider (openai / doubao / local)."""
    if explicit:
        return explicit
    lower = (model or "").lower()
    if lower.startswith("doubao") or lower.startswith("bge-"):
        return "doubao"
    return "openai"


async def _run_embeddings(req: EmbeddingRequest) -> EmbeddingResponse:
    """共享 embedding 执行逻辑 (canonical + legacy 复用，保证 body 一致).

    通过 ``get_embedding_provider`` 路由到真实 provider；无 API key /
    网络失败时 provider 自动回退到确定性 hash 向量，调用方永远拿到回复。
    """
    from ..providers.embeddings import get_embedding_provider

    provider_name = _infer_embedding_provider(req.model, req.provider)
    provider = get_embedding_provider(provider_name)

    data: list[dict[str, Any]] = []
    total_tokens = 0
    for i, text in enumerate(req.input):
        result = await provider.embed(
            text, model=req.model, tenant_id=req.tenant_id
        )
        data.append({"index": i, "embedding": result.embedding})
        total_tokens += result.usage.get("prompt_tokens", 0)

    dimensions = len(data[0]["embedding"]) if data else 0
    return EmbeddingResponse(
        model=req.model,
        dimensions=dimensions,
        data=data,
        usage={"prompt_tokens": total_tokens},
    )


@router.post("/embeddings", response_model=EmbeddingResponse)
async def embeddings_endpoint(req: EmbeddingRequest) -> EmbeddingResponse:
    """/embeddings 端点 — 路由到真实 embedding provider (openai/doubao/local).

    provider 按 ``req.provider`` 选择，缺省时按 ``req.model`` 推断。
    无 API key / 网络失败时自动回退到确定性 hash 向量。
    """
    return await _run_embeddings(req)


# ---------------------------------------------------------------------------
# Real provider chat (TD-6 — P3-W7 real LLM provider with fallback)
#
# ``POST /api/v1/llmgw/chat/real`` routes to a real OpenAI or Anthropic
# provider based on the ``provider`` field. When the real call fails
# (no API key, timeout, HTTP error) the provider automatically falls
# back to a deterministic stub response and emits a structlog warning.
# ---------------------------------------------------------------------------
class RealChatRequest(BaseModel):
    """``/chat/real`` 请求体 (TD-6)."""

    provider: str = Field(
        ..., description="openai | anthropic — selects the real backend"
    )
    model: str = Field(
        default="", description="模型名 (defaults to provider default)"
    )
    messages: list[ChatMessage]
    temperature: float = 1.0
    max_tokens: int | None = None
    tenant_id: str = Field(default="", description="租户 ID (for tenant-scoped API key)")


class RealChatResponseAPI(BaseModel):
    """``/chat/real`` 响应体."""

    content: str
    model: str
    finish_reason: str | None = None
    usage: dict[str, int] = {}
    provider: str = ""
    fallback: bool = False


@router.post("/chat/real", response_model=RealChatResponseAPI)
async def real_chat_endpoint(req: RealChatRequest) -> RealChatResponseAPI:
    """TD-6: route to a real OpenAI / Anthropic provider with stub fallback.

    The ``provider`` field selects the backend. Each provider resolves
    its API key from the environment (tenant-scoped or global). On any
    failure the provider returns a deterministic stub response so the
    caller always gets a reply.
    """
    from ..providers.real_anthropic_provider import RealAnthropicProvider
    from ..providers.real_openai_provider import RealOpenAIProvider

    if req.provider == "anthropic":
        model = req.model or "claude-3-5-sonnet-20241022"
        provider = RealAnthropicProvider(model=model)
    elif req.provider == "openai":
        model = req.model or "gpt-4o-mini"
        provider = RealOpenAIProvider(model=model)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"unknown provider: {req.provider!r} (expected 'openai' or 'anthropic')",
        )

    try:
        resp = await provider.chat(
            req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            tenant_id=req.tenant_id,
        )
    finally:
        await provider.aclose()

    # Detect fallback by checking for the stub marker in content
    is_fallback = "[stub-fallback]" in resp.content
    if is_fallback:
        logger.warning(
            "llmgw.chat.real.fallback",
            provider=req.provider,
            tenant_id=req.tenant_id,
        )

    return RealChatResponseAPI(
        content=resp.content,
        model=resp.model,
        finish_reason=resp.finish_reason,
        usage=resp.usage,
        provider=req.provider,
        fallback=is_fallback,
    )


# ---------------------------------------------------------------------------
# Multimodal chat — simplified engine (v3.2 W2)
#
# ``POST /api/v1/llmgw/chat/multimodal`` accepts a flattened body
# (prompt + images + audio + model) and delegates to the
# :class:`~mate_tech_llmgw.multimodal.engine.MultimodalEngine`.
# Quota and cost reuse the same singletons as the text chat path
# (``get_quota_bucket`` / ``get_cost_recorder``), so multimodal calls
# are subject to the same per-tenant RPM/TPM limits and cost metering.
# ---------------------------------------------------------------------------
class MultimodalApiRequest(BaseModel):
    """``/chat/multimodal`` simplified request body (v3.2 W2)."""

    prompt: str = Field(..., description="文本提示")
    images: list[str] = Field(default_factory=list, description="base64 data URI 或 URL")
    audio: list[str] = Field(default_factory=list, description="base64 data URI 或 URL")
    model: str = Field("gpt-4o-mini", description="多模态模型名")
    tenant_id: str = Field(default="default", description="租户 ID")


class MultimodalApiResponse(BaseModel):
    """``/chat/multimodal`` response body."""

    content: str
    model: str
    usage: dict[str, Any] = {}


@router.post("/chat/multimodal", response_model=MultimodalApiResponse)
async def multimodal_chat_endpoint(req: MultimodalApiRequest) -> MultimodalApiResponse:
    """v3.2 W2: simplified multimodal chat (text + image + audio → text).

    Quota and cost reuse the same singletons as the text chat path
    (``get_quota_bucket()`` / ``get_cost_recorder()``), so multimodal
    calls are subject to the same per-tenant RPM/TPM limits and cost
    metering.
    """
    from ..multimodal.engine import MultimodalEngine, MultimodalRequest

    # --- 1. Quota check (mirrors router.chat semantics) ---
    bucket = get_quota_bucket()
    if bucket is not None:
        estimated_tokens = max(1, len(req.prompt) // 4) + 100 * (
            len(req.images) + len(req.audio)
        )
        try:
            await bucket.acquire(
                tenant_id=req.tenant_id, estimated_tokens=estimated_tokens
            )
        except QuotaExceededError as e:
            raise HTTPException(
                status_code=429,
                detail=f"Quota exceeded for tenant '{req.tenant_id}'; retry after {e.retry_after}s",
                headers={"Retry-After": str(e.retry_after)},
            ) from e
        except Exception as e:
            logger.warning(
                "llmgw.multimodal.quota.degraded", tenant=req.tenant_id, error=str(e)
            )

    # --- 2. Engine call ---
    engine = MultimodalEngine()
    request = MultimodalRequest(
        prompt=req.prompt,
        images=list(req.images),
        audio=list(req.audio),
        model=req.model,
    )
    try:
        resp = await engine.chat(request)
    except Exception as e:
        logger.error("llmgw.multimodal.chat.error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e

    # --- 3. Cost record ---
    recorder = get_cost_recorder()
    if recorder is not None:
        try:
            await recorder.record(
                model=req.model, tenant_id=req.tenant_id, usage=resp.usage
            )
        except Exception as e:
            logger.warning("llmgw.multimodal.cost.record_failed", error=str(e))

    return MultimodalApiResponse(content=resp.content, model=resp.model, usage=resp.usage)


# ---------------------------------------------------------------------------
# P3-W9: Management API — cache / quota / cost 运维端点
# ---------------------------------------------------------------------------
@router.get("/providers")
async def list_providers_endpoint() -> dict[str, Any]:
    """列出所有支持的 LLM provider (name → description)."""
    from ..router import SUPPORTED_PROVIDERS

    return {"providers": SUPPORTED_PROVIDERS}


@router.get("/cache/stats")
async def cache_stats_endpoint() -> dict[str, Any]:
    """返回缓存命中率统计."""
    cache = get_cache()
    if cache is None:
        return {"hits": 0, "misses": 0, "hit_rate": 0.0, "enabled": False}
    return cache.stats()


@router.delete("/cache/{tenant_id}")
async def cache_clear_endpoint(tenant_id: str) -> dict[str, Any]:
    """清除某租户的缓存."""
    cache = get_cache()
    if cache is None:
        return {"cleared": 0, "tenant_id": tenant_id, "enabled": False}
    try:
        count = await cache.clear_tenant(tenant_id)
    except Exception as e:
        logger.warning("llmgw.cache.clear_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"cleared": count, "tenant_id": tenant_id}


@router.get("/quota/{tenant_id}")
async def quota_status_endpoint(tenant_id: str) -> dict[str, Any]:
    """返回某租户配额状态(RPM/TPM used/limit)."""
    bucket = get_quota_bucket()
    if bucket is None:
        return {
            "tenant_id": tenant_id,
            "rpm_used": 0,
            "rpm_limit": 0,
            "tpm_used": 0,
            "tpm_limit": 0,
            "enabled": False,
        }
    try:
        return await bucket.status(tenant_id)
    except Exception as e:
        logger.warning("llmgw.quota.status_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/usage/{tenant_id}")
async def usage_endpoint(tenant_id: str) -> dict[str, Any]:
    """返回某租户成本用量摘要(total_tokens / total_cost / by_model)."""
    recorder = get_cost_recorder()
    if recorder is None:
        return {
            "tenant_id": tenant_id,
            "total_tokens": 0,
            "total_cost": 0.0,
            "by_model": {},
        }
    return recorder.summary(tenant_id)


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
async def legacy_chat(req: ChatRequest, response: Response) -> ChatResponseAPI:
    try:
        resp = await router_chat(
            req.model,
            req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            tools=req.tools,
            tenant_id=req.tenant_id,
        )
    except HTTPException:
        raise
    except (NotImplementedError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("llmgw.chat.error.legacy", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e
    response.headers.update(_deprecation_header())
    return ChatResponseAPI(**resp.__dict__)


@legacy_router.post(
    "/chat/stream",
    deprecated=True,
)
async def legacy_chat_stream(req: ChatRequest, response: Response):
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
async def legacy_embeddings(req: EmbeddingRequest, response: Response) -> EmbeddingResponse:
    response.headers.update(_deprecation_header())
    return await _run_embeddings(req)