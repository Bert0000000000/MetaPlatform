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

import json
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from mate_platform.runtime import is_production_profile
from mate_platform.tenancy import (
    RequestContext,
    TenantAccessError,
    assert_same_tenant,
    require_tenant,
)
from pydantic import BaseModel, Field

from ..stream.sse import make_streaming_response
from .chat import ChatMessage
from .router import chat as router_chat

logger = structlog.get_logger(__name__)

# P3-W9: management API helpers (cache / quota / cost singletons).
from mate_platform.observability import journey_span  # noqa: E402

from ..quota.bucket import QuotaExceededError  # noqa: E402
from ..router import (  # noqa: E402
    get_cache,
    get_cost_recorder,
    get_monthly_bucket,
    get_quota_bucket,
    get_user_daily_cap,
)


# ADR-0018 §2.4: monthly token ceiling.
async def _enforce_monthly_ceiling(req: ChatRequest | RealChatRequest) -> None:
    bucket = get_monthly_bucket()
    if bucket is None:
        return
    estimated_tokens = 0
    for msg in req.messages or []:
        content = getattr(msg, "content", "") or ""
        estimated_tokens += max(len(content) // 4, 1)
    try:
        await bucket.check_and_record(
            tenant_id=req.tenant_id or "default",
            estimated_tokens=estimated_tokens,
        )
    except QuotaExceededError as e:
        logger.warning(
            "llmgw.quota.exceeded.monthly",
            tenant_id=req.tenant_id,
            retry_after=e.retry_after,
        )
        raise HTTPException(
            status_code=429,
            detail="monthly token quota exceeded",
            headers={"Retry-After": str(e.retry_after)},
        ) from e


# ADR-0018 §2.4: per-user daily cost cap.
def _enforce_user_daily_cap(req: ChatRequest | RealChatRequest, *, user_id: str) -> None:
    from ..cost.ceiling import UserDailyCapExceeded

    cap = get_user_daily_cap()
    if cap is None:
        return
    estimated_tokens = 0
    for msg in req.messages or []:
        content = getattr(msg, "content", "") or ""
        estimated_tokens += max(len(content) // 4, 1)
    # 4 chars ~ 1 token,模型价格取保守上限 $0.015/1k completion。
    estimated_cost_usd = max(estimated_tokens, 0) / 1000.0 * 0.015
    try:
        cap.check_and_record(
            tenant_id=req.tenant_id or "default",
            user_id=user_id,
            cost_usd=estimated_cost_usd,
        )
    except UserDailyCapExceeded as e:
        logger.warning(
            "llmgw.user_daily_cap.exceeded",
            tenant_id=req.tenant_id,
            user_id=user_id,
            retry_after=e.retry_after,
        )
        raise HTTPException(
            status_code=429,
            detail="user daily cost cap exceeded; using stub provider",
            headers={"Retry-After": str(e.retry_after)},
        ) from e

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
    await _enforce_monthly_ceiling(req)
    with journey_span(
        "llmgw.chat",
        tenant_id=req.tenant_id or "default",
        attributes={"llmgw.model": req.model, "llmgw.endpoint": "chat"},
    ):
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
        except RuntimeError as e:
            raise HTTPException(
                status_code=503,
                detail="LLM provider unavailable; synthetic fallback is disabled",
            ) from e
        except Exception as e:
            logger.error("llmgw.chat.error", error=str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


async def _mock_stream(*, messages=None, model=None, temperature=1.0, **kwargs):
    """ST-5.5.7 配套:mock token 流(实际生产应替换为 provider 的 stream 接口)."""
    user_text = ""
    if messages:
        # Get the last user message content for a slightly personalized reply
        for msg in reversed(messages):
            if msg.role == "user":
                user_text = msg.content[:50]
                break
    reply = f"收到您的消息: {user_text or '(无内容)'}。我是 Mate Platform 数字员工助手。"
    for i, word in enumerate(reply):
        yield {"type": "token", "data": {"text": word, "index": i}}
    yield {"type": "final", "data": {"finish_reason": "stop"}}


@router.post("/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """ST-5.5.7: SSE 流式 chat 端点."""
    if is_production_profile():
        raise HTTPException(
            status_code=503,
            detail="LLM streaming provider is unavailable; synthetic stream is disabled",
        )
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
    # 显式覆盖（优先于后台配置）；缺省时由后台 AI Provider 配置解析。
    base_url: str | None = Field(default=None, description="OpenAI 兼容 base URL 覆盖")
    api_key: str | None = Field(default=None, description="API Key 覆盖")


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


async def _run_embeddings(req: EmbeddingRequest, request: Request | None = None) -> EmbeddingResponse:
    """共享 embedding 执行逻辑 (canonical + legacy 复用，保证 body 一致).

    Provider 解析优先级：请求显式 base_url/api_key > 后台 AI Provider 配置
    (ai.embedding.default_provider) > 按 model 推断的 provider (env key)。
    无 key / 网络失败时 provider 自动回退到确定性 hash 向量，调用方永远拿到回复。
    """
    from ..providers.embeddings import (
        build_configured_embedding_provider,
        get_embedding_provider,
        resolve_effective_embedding,
    )

    # 1) 后台配置解析（仅在请求未显式带 base_url/api_key 时）。
    resolved: dict[str, str] = {}
    if request is not None and not req.base_url:
        try:
            resolved = await resolve_effective_embedding(request, req.tenant_id)
        except Exception:  # noqa: BLE001
            resolved = {}

    if resolved or req.base_url:
        # 显式请求值覆盖后台解析值；后台配置的 model 是单一事实源，优先于
        # 调用方(如 mate-tech-rag)发送的默认 model。
        base_url = req.base_url or resolved.get("base_url")
        api_key = req.api_key or resolved.get("api_key", "")
        model = resolved.get("model") or req.model
        provider = build_configured_embedding_provider(
            base_url=base_url or "", api_key=api_key or "", model=model or "",
        )
        effective_model = model or req.model
    else:
        provider_name = _infer_embedding_provider(req.model, req.provider)
        provider = get_embedding_provider(provider_name)
        effective_model = req.model

    data: list[dict[str, Any]] = []
    total_tokens = 0
    for i, text in enumerate(req.input):
        result = await provider.embed(
            text, model=effective_model, tenant_id=req.tenant_id
        )
        data.append({"index": i, "embedding": result.embedding})
        total_tokens += result.usage.get("prompt_tokens", 0)

    dimensions = len(data[0]["embedding"]) if data else 0
    return EmbeddingResponse(
        model=effective_model,
        dimensions=dimensions,
        data=data,
        usage={"prompt_tokens": total_tokens},
    )


@router.post("/embeddings", response_model=EmbeddingResponse)
async def embeddings_endpoint(req: EmbeddingRequest, request: Request) -> EmbeddingResponse:
    """/embeddings 端点 — 路由到真实 embedding provider (openai/doubao/local).

    provider 按 ``req.provider`` 选择，缺省时按 ``req.model`` 推断；当请求未
    显式带 base_url/api_key 时，优先用后台 AI Provider 配置
    (ai.embedding.default_provider)。无 API key / 网络失败时自动回退到确定性 hash 向量。
    """
    try:
        return await _run_embeddings(req, request)
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail="Embedding provider unavailable; synthetic fallback is disabled",
        ) from e


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
        ..., description="openai | anthropic | custom — selects the real backend"
    )
    model: str = Field(
        default="", description="模型名 (defaults to provider default)"
    )
    messages: list[ChatMessage]
    temperature: float = 1.0
    max_tokens: int | None = None
    tenant_id: str = Field(default="", description="租户 ID (for tenant-scoped API key)")
    # 后台 AI Provider 配置（openai 兼容端点）透传：base_url + api_key
    # 由 copilot 从 IAM ai.provider.* 读取，优先于环境变量。
    base_url: str | None = Field(
        default=None, description="OpenAI 兼容 base URL（如 MiniMax / DeepSeek 等第三方）"
    )
    api_key: str | None = Field(
        default=None, description="第三方 API Key（如用户后台配置的 MiniMax key）"
    )
    tools: list[dict[str, Any]] | None = Field(
        default=None, description="function-calling tools, forwarded to OpenAI-compatible providers"
    )


class RealChatResponseAPI(BaseModel):
    """``/chat/real`` 响应体."""

    content: str
    model: str
    reasoning_content: str | None = None
    finish_reason: str | None = None
    usage: dict[str, int] = {}
    provider: str = ""
    fallback: bool = False
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


@router.post("/chat/real", response_model=RealChatResponseAPI)
async def real_chat_endpoint(req: RealChatRequest) -> RealChatResponseAPI:
    """TD-6: route to a real OpenAI / Anthropic provider with stub fallback.

    The ``provider`` field selects the backend. Each provider resolves
    its API key from the environment (tenant-scoped or global). On any
    failure the provider returns a deterministic stub response so the
    caller always gets a reply.
    """
    await _enforce_monthly_ceiling(req)
    with journey_span(
        "llmgw.chat.real",
        tenant_id=req.tenant_id or "default",
        attributes={"llmgw.provider": req.provider, "llmgw.endpoint": "chat/real"},
    ):
        from ..providers.real_anthropic_provider import RealAnthropicProvider
        from ..providers.real_openai_provider import RealOpenAIProvider

        if req.provider == "anthropic":
            model = req.model or "claude-3-5-sonnet-20241022"
            provider = RealAnthropicProvider(
                model=model, allow_fallback=not is_production_profile()
            )
        elif req.provider in ("openai", "custom"):
            # custom = OpenAI 兼容第三方（MiniMax/DeepSeek 等），base_url/api_key 透传
            model = req.model or "gpt-4o-mini"
            provider = RealOpenAIProvider(
                model=model,
                base_url=req.base_url,
                api_key=req.api_key,
                allow_fallback=not is_production_profile(),
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"unknown provider: {req.provider!r} (expected 'openai', 'anthropic', or 'custom')",
            )

        try:
            resp = await provider.chat(
                req.messages,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                tenant_id=req.tenant_id,
                tools=req.tools,
            )
        except RuntimeError as exc:
            raise HTTPException(
                status_code=503,
                detail="LLM provider unavailable; synthetic fallback is disabled",
            ) from exc
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
            reasoning_content=resp.reasoning_content or None,
            finish_reason=resp.finish_reason,
            usage=resp.usage,
            provider=req.provider,
            fallback=is_fallback,
            tool_calls=resp.tool_calls,
        )


@router.post("/chat/real/stream")
async def real_chat_stream_endpoint(req: RealChatRequest):
    """Streaming function-calling decision turn (SuperAI agent loop).

    Same request shape as ``/chat/real`` but streams the provider deltas
    as SSE events so callers see reasoning tokens in real time:

      data: {"type": "token", "content", "reasoning_content", "tool_calls"}
      data: {"type": "done", "content", "reasoning_content", "tool_calls",
             "finish_reason", "usage"}
    """
    await _enforce_monthly_ceiling(req)
    if req.provider not in ("openai", "custom"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"streaming only supports openai/custom providers, got "
                f"{req.provider!r}"
            ),
        )
    from ..providers.real_openai_provider import RealOpenAIProvider

    model = req.model or "gpt-4o-mini"
    provider = RealOpenAIProvider(
        model=model,
        base_url=req.base_url,
        api_key=req.api_key,
        allow_fallback=not is_production_profile(),
    )

    stream = provider.stream_chat(
        req.messages,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        tools=req.tools,
        tenant_id=req.tenant_id,
    )
    try:
        first_event = await stream.__anext__()
    except RuntimeError as exc:
        await provider.aclose()
        raise HTTPException(
            status_code=503,
            detail="LLM provider unavailable; synthetic fallback is disabled",
        ) from exc
    except StopAsyncIteration as exc:
        await provider.aclose()
        raise HTTPException(
            status_code=503, detail="LLM provider returned no stream"
        ) from exc

    async def _event_stream():
        try:
            yield f"data: {json.dumps(first_event, ensure_ascii=False)}\n\n"
            async for event in stream:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            await provider.aclose()

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X_Accel_Buffering": "no",
        },
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
    if is_production_profile():
        raise HTTPException(
            status_code=503,
            detail="Multimodal provider unavailable; synthetic fallback is disabled",
        )

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
def _require_same_tenant_management_access(request: Request, tenant_id: str) -> str:
    ctx = getattr(request.state, "ctx", None)
    if not isinstance(ctx, RequestContext):
        raise HTTPException(status_code=403, detail="tenant access denied")
    try:
        require_tenant(ctx)
        assert_same_tenant(tenant_id, ctx)
    except TenantAccessError as exc:
        logger.warning(
            "llmgw.management.cross_tenant_denied",
            requested_tenant_id=tenant_id,
            request_tenant_id=ctx.tenant_id,
            reason=str(exc),
        )
        raise HTTPException(status_code=403, detail="tenant access denied") from exc
    return tenant_id


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
async def cache_clear_endpoint(tenant_id: str, request: Request) -> dict[str, Any]:
    """清除某租户的缓存."""
    tenant_id = _require_same_tenant_management_access(request, tenant_id)
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
async def quota_status_endpoint(tenant_id: str, request: Request) -> dict[str, Any]:
    """返回某租户配额状态(RPM/TPM used/limit)."""
    tenant_id = _require_same_tenant_management_access(request, tenant_id)
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
async def usage_endpoint(tenant_id: str, request: Request) -> dict[str, Any]:
    """返回某租户成本用量摘要(total_tokens / total_cost / by_model)."""
    tenant_id = _require_same_tenant_management_access(request, tenant_id)
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
    if is_production_profile():
        raise HTTPException(
            status_code=503,
            detail="LLM streaming provider is unavailable; synthetic stream is disabled",
        )
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
async def legacy_embeddings(req: EmbeddingRequest, response: Response, request: Request) -> EmbeddingResponse:
    response.headers.update(_deprecation_header())
    return await _run_embeddings(req, request)


# ---------------------------------------------------------------------------
# ADR-0019: AI Provider connectivity probe.
#
# UI (AIProvidersPage) used to call the upstream provider directly, which
# failed with net::ERR_FAILED (CORS). The endpoint below probes upstream
# on behalf of the user; the API key is sent in the request body and is
# never persisted (see ADR-0019 §2.2).
# ---------------------------------------------------------------------------
class ProviderTestRequest(BaseModel):
    """``POST /api/v1/llmgw/providers/test`` request body."""

    provider: str = Field(
        ...,
        description="openai / azure / ollama / custom",
    )
    base_url: str = Field(
        ...,
        description="Provider base URL (no trailing slash required)",
    )
    api_key: str | None = Field(
        default=None,
        description="Optional API key; never persisted server-side",
    )
    api_version: str | None = Field(
        default=None,
        description="Azure OpenAI api-version (only used when provider=azure)",
    )
    timeout_sec: float = Field(
        default=10.0,
        description="Probe timeout in seconds (1-30, default 10)",
    )


class ProviderTestResponseAPI(BaseModel):
    """``POST /api/v1/llmgw/providers/test`` response body."""

    ok: bool
    status: int
    latency_ms: int
    provider: str
    message: str
    hint: str | None = None
    error: str | None = None
    probe_url: str | None = None


_ALLOWED_PROVIDERS: frozenset[str] = frozenset({"openai", "azure", "ollama", "custom"})


@router.post("/providers/test", response_model=ProviderTestResponseAPI)
async def providers_test_endpoint(req: ProviderTestRequest) -> ProviderTestResponseAPI:
    """ADR-0019: server-side AI provider connectivity probe.

    The endpoint resolves the probe URL (per provider) and runs a
    server-side GET against it. OK semantics: 200/401/403 all
    count as "endpoint reachable". Any other status or transport
    failure produces an ``ok: false`` body with a short error code.
    """
    provider = req.provider.lower().strip()
    if provider not in _ALLOWED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"unknown provider: {provider!r} (expected one of: sorted ..)",
        )
    from ..providers.test import probe as _probe  # local import to avoid cycle

    timeout_sec = max(1.0, min(req.timeout_sec, 30.0))
    result = await _probe(
        provider=provider,  # type: ignore[arg-type]
        base_url=req.base_url,
        api_key=req.api_key,
        timeout_sec=timeout_sec,
    )
    return ProviderTestResponseAPI(
        ok=result.ok,
        status=result.status,
        latency_ms=result.latency_ms,
        provider=provider,
        message=result.message,
        hint=result.hint,
        error=result.error,
        probe_url=(
            f"{req.base_url.rstrip('/')}"
            + (
                "/openai/deployments?api-version="
                + (req.api_version or "2024-02-01")
                if provider == "azure"
                else "/models" if provider != "ollama" else "/api/tags"
            )
        ),
    )


# ---------------------------------------------------------------------------
# 拉取 provider 模型清单（后台「获取模型」按钮）。
#
# 复用 providers/test 的 probe 逻辑 GET 上游 /models，解析响应里的模型
# 列表返回给前端，由前端批量写入 IAM ai_model 表。
# ---------------------------------------------------------------------------
class ProviderModelsRequest(BaseModel):
    """``POST /api/v1/llmgw/providers/models`` request body."""

    provider: str = Field(..., description="openai / azure / ollama / custom")
    base_url: str = Field(..., description="Provider base URL")
    api_key: str | None = Field(default=None, description="Optional API key")
    api_version: str | None = Field(default=None, description="Azure api-version")
    timeout_sec: float = Field(default=10.0, description="Probe timeout")


class ProviderModelsResponse(BaseModel):
    ok: bool
    provider: str
    models: list[str] = Field(default_factory=list)
    display_names: dict[str, str] = Field(default_factory=dict)
    message: str = ""


@router.post("/providers/models", response_model=ProviderModelsResponse)
async def providers_models_endpoint(req: ProviderModelsRequest) -> ProviderModelsResponse:
    """获取上游 provider 的模型清单（OpenAI 兼容 /models、Ollama /api/tags、Azure deployments）。

    API key 在请求体传入，从不持久化（同 ADR-0019）。解析失败时返回空清单。
    """
    provider = req.provider.lower().strip()
    if provider not in _ALLOWED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"unknown provider: {provider!r}",
        )
    import httpx as _httpx

    from ..providers.test import default_probe_url

    timeout_sec = max(1.0, min(req.timeout_sec, 30.0))
    url = default_probe_url(provider, req.base_url)  # type: ignore[arg-type]
    headers = {"accept": "application/json"}
    if req.api_key:
        headers["authorization"] = f"Bearer {req.api_key}"

    try:
        async with _httpx.AsyncClient(timeout=timeout_sec) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return ProviderModelsResponse(
                ok=False,
                provider=provider,
                message=f"HTTP {resp.status_code}",
            )
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001
        return ProviderModelsResponse(
            ok=False,
            provider=provider,
            message=f"获取失败: {type(exc).__name__}",
        )

    models: list[str] = []
    display_names: dict[str, str] = {}
    if isinstance(payload, dict):
        # OpenAI 兼容: {"data": [{"id": "gpt-4o", ...}]}
        data = payload.get("data")
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("id"):
                    mid = str(item["id"])
                    models.append(mid)
                    name = item.get("name") or item.get("display_name")
                    if name:
                        display_names[mid] = str(name)
        # Ollama: {"models": [{"name": "llama3.2:latest", ...}]}
        ol = payload.get("models")
        if isinstance(ol, list):
            for item in ol:
                if isinstance(item, dict) and item.get("name"):
                    models.append(str(item["name"]))
        # Azure deployments: {"value": [{"id": "...", "model": "..."}]}
        val = payload.get("value")
        if isinstance(val, list):
            for item in val:
                if isinstance(item, dict) and item.get("model"):
                    models.append(str(item["model"]))
    elif isinstance(payload, list):
        for item in payload:
            if isinstance(item, str):
                models.append(item)
            elif isinstance(item, dict) and item.get("id"):
                models.append(str(item["id"]))

    # 去重保序
    seen: set[str] = set()
    deduped = [m for m in models if not (m in seen or seen.add(m))]
    return ProviderModelsResponse(
        ok=True,
        provider=provider,
        models=deduped,
        display_names={k: v for k, v in display_names.items() if k in seen},
    )
