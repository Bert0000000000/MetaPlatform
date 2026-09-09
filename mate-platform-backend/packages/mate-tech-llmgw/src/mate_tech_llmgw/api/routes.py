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
import os
import time
from collections.abc import Mapping
from dataclasses import asdict, is_dataclass
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from mate_platform.runtime import is_production_profile
from mate_platform.tenancy import (
    RequestContext,
    TenantAccessError,
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
    from ..tokens import estimate_messages_tokens

    estimated_tokens = estimate_messages_tokens(req.messages)
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
    from ..tokens import estimate_messages_tokens

    estimated_tokens = estimate_messages_tokens(req.messages)
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


def _ctx_user_id(request: Request | None) -> str:
    """Authenticated user id from the request context, 'anonymous' fallback.

    ctx 缺失（无 auth 中间件的测试 app / dev_server 匿名路径）时返回
    "anonymous"，绝不抛错 — 与 quota bucket 的软依赖降级语义一致。
    """
    if request is None:
        return "anonymous"
    ctx = getattr(request.state, "ctx", None)
    user_id = getattr(ctx, "user_id", None)
    return str(user_id) if user_id else "anonymous"


def _apply_request_tenant(request: Request | None, req: BaseModel) -> None:
    """P4 tenant enforcement (hard rule #3 alignment).

    Authenticated ctx (USER/SERVICE/API_KEY):
      - body tenant_id empty/"default" (the unset sentinel) → backfill
        from the JWT tenant
      - body tenant_id set and ≠ ctx tenant → 403 (cross-tenant spoof)
    Missing request, missing ctx, or anonymous ctx (dev_server anonymous
    paths, test apps without the auth middleware): keep the body value
    unchanged — this is what keeps test_llmgw_path_alias green.
    """
    if request is None:
        return
    ctx = getattr(request.state, "ctx", None)
    if ctx is None or not getattr(ctx, "is_authenticated", False):
        return
    ctx_tenant = str(getattr(ctx, "tenant_id", "") or "")
    if not ctx_tenant:
        return
    body_tenant = str(getattr(req, "tenant_id", "") or "")
    if not body_tenant or body_tenant == "default":
        try:
            req.tenant_id = ctx_tenant  # type: ignore[misc]
        except Exception:  # noqa: BLE001 — frozen models keep old behavior
            pass
        return
    if body_tenant != ctx_tenant:
        logger.warning(
            "llmgw.tenant.mismatch_denied",
            body_tenant=body_tenant,
            ctx_tenant=ctx_tenant,
        )
        raise HTTPException(status_code=403, detail="tenant access denied")


# P1: tenant soft/max budget guard (rebuilt when the recorder pool changes).
_budget_guard: Any | None = None
_budget_guard_pool_id: int | None = None


def _get_budget_guard() -> Any | None:
    global _budget_guard, _budget_guard_pool_id
    recorder = get_cost_recorder()
    pool = getattr(recorder, "pool", None) if recorder is not None else None
    if pool is None:
        return None
    if _budget_guard is None or _budget_guard_pool_id != id(pool):
        from ..cost.budget import TenantBudgetGuard

        _budget_guard = TenantBudgetGuard(pool)
        _budget_guard_pool_id = id(pool)
    return _budget_guard


async def _enforce_tenant_budget(req: ChatRequest | RealChatRequest) -> None:
    """P1: soft 预算告警 / max 预算 429（LiteLLM BudgetTable 语义）."""
    from ..cost.budget import BudgetExceededError

    guard = _get_budget_guard()
    if guard is None:
        return
    from ..tokens import estimate_messages_tokens

    estimated_tokens = estimate_messages_tokens(req.messages)
    estimated_cost_usd = estimated_tokens / 1000.0 * 0.015
    try:
        await guard.check(req.tenant_id or "default", estimated_cost_usd=estimated_cost_usd)
    except BudgetExceededError as e:
        logger.warning(
            "llmgw.budget.exceeded",
            tenant_id=req.tenant_id,
            spent_usd=e.spent_usd,
            max_usd=e.max_usd,
        )
        raise HTTPException(
            status_code=429,
            detail="tenant budget exceeded",
            headers={"Retry-After": "3600"},
        ) from e


async def _enforce_api_key_limits(
    request: Request | None, *, model: str, estimated_tokens: int
) -> None:
    """P5: virtual-key limits (models whitelist / rpm+tpm / budget window).

    No-op for JWT traffic (only the API_KEY verifier stashes a record)
    and for direct unit-test calls without a request.
    """
    if request is None:
        return
    record = getattr(request.state, "llmgw_api_key", None)
    if record is None:
        return
    from ..security.api_keys import enforce_key_limits, get_api_key_redis
    from ..quota.bucket import QuotaExceededError

    try:
        await enforce_key_limits(
            record,
            model=model,
            estimated_tokens=estimated_tokens,
            redis_client=get_api_key_redis(),
        )
    except QuotaExceededError as e:
        raise HTTPException(
            status_code=429,
            detail=f"api key rate limit exceeded; retry after {e.retry_after}s",
            headers={"Retry-After": str(e.retry_after)},
        ) from e


def _messages_estimated_tokens(messages: list[Any]) -> int:
    from ..tokens import estimate_messages_tokens

    return estimate_messages_tokens(messages)


async def _record_cost(
    *,
    model: str,
    tenant_id: str,
    usage: dict[str, int],
    user_id: str = "anonymous",
    provider: str = "",
    request_id: str = "",
    duration_ms: int = 0,
    cache_hit: bool = False,
    status: str = "success",
) -> None:
    """Fire cost metering through the recorder singleton (soft dependency)."""
    recorder = get_cost_recorder()
    if recorder is None or not usage:
        return
    try:
        await recorder.record(
            model=model,
            tenant_id=tenant_id or "default",
            usage=usage,
            user_id=user_id,
            provider=provider,
            request_id=request_id,
            duration_ms=duration_ms,
            cache_hit=cache_hit,
            status=status,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("llmgw.cost.record_failed", error=str(e))


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
    # Sprint 3（真实 LLM 收口）：请求级 OpenAI 兼容 base_url/api_key 覆盖。
    # 设置时绕过 router，直接走 OpenAI 兼容 provider（如 ARK Plan / MiniMax）。
    base_url: str | None = Field(default=None, description="OpenAI 兼容 base URL 覆盖")
    api_key: str | None = Field(default=None, description="API Key 覆盖")


class ChatResponseAPI(BaseModel):
    """/chat 响应体."""

    content: str
    model: str
    finish_reason: str | None = None
    tool_calls: list[dict[str, Any]] = []
    usage: dict[str, int] = {}


def _chat_response_payload(response: Any) -> dict[str, Any]:
    """Normalize provider responses before validating the public API model.

    The production router returns the frozen, slotted ``ChatResponse``
    dataclass. Tests and third-party adapters may return a mapping or a small
    compatibility object instead, so serialization must not depend on either
    ``__dict__`` or dataclass-only behavior.
    """
    if is_dataclass(response) and not isinstance(response, type):
        return asdict(response)
    if isinstance(response, Mapping):
        return dict(response)
    model_dump = getattr(response, "model_dump", None)
    if callable(model_dump):
        payload = model_dump()
        if isinstance(payload, dict):
            return payload
    to_dict = getattr(response, "to_dict", None)
    if callable(to_dict):
        payload = to_dict()
        if isinstance(payload, dict):
            return payload
    attributes = getattr(response, "__dict__", None)
    if isinstance(attributes, dict):
        return dict(attributes)
    raise TypeError("unsupported chat response type")


@router.post("/chat", response_model=ChatResponseAPI)
async def chat_endpoint(req: ChatRequest, request: Request) -> ChatResponseAPI:
    """非流式 chat 端点."""
    _apply_request_tenant(request, req)
    await _enforce_api_key_limits(
        request, model=req.model, estimated_tokens=_messages_estimated_tokens(req.messages)
    )
    await _enforce_monthly_ceiling(req)
    _enforce_user_daily_cap(req, user_id=_ctx_user_id(request))
    await _enforce_tenant_budget(req)
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
            return ChatResponseAPI(**_chat_response_payload(resp))
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
async def chat_stream_endpoint(req: ChatRequest, request: Request):
    """ST-5.5.7: SSE 流式 chat 端点."""
    _apply_request_tenant(request, req)
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
    _apply_request_tenant(request, req)
    await _enforce_api_key_limits(
        request, model=req.model, estimated_tokens=sum(len(t) // 4 for t in req.input) or 1
    )
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
async def real_chat_endpoint(req: RealChatRequest, request: Request) -> RealChatResponseAPI:
    """TD-6: route to a real OpenAI / Anthropic provider with stub fallback.

    The ``provider`` field selects the backend. Each provider resolves
    its API key from the environment (tenant-scoped or global). On any
    failure the provider returns a deterministic stub response so the
    caller always gets a reply.
    """
    _apply_request_tenant(request, req)
    user_id = _ctx_user_id(request)
    await _enforce_api_key_limits(
        request,
        model=req.model,
        estimated_tokens=_messages_estimated_tokens(req.messages),
    )
    await _enforce_monthly_ceiling(req)
    _enforce_user_daily_cap(req, user_id=user_id)
    await _enforce_tenant_budget(req)
    with journey_span(
        "llmgw.chat.real",
        tenant_id=req.tenant_id or "default",
        attributes={"llmgw.provider": req.provider, "llmgw.endpoint": "chat/real"},
    ):
        from ..providers.real_anthropic_provider import RealAnthropicProvider
        from ..providers.real_openai_provider import RealOpenAIProvider
        from ..resilience.call import call_with_resilience, load_fallback_chain

        if req.provider == "anthropic":
            model = req.model or "claude-3-5-sonnet-20241022"
            provider = RealAnthropicProvider(
                model=model,
                allow_fallback=not is_production_profile() and not req.tools,
            )
        elif req.provider in ("openai", "custom"):
            # custom = OpenAI 兼容第三方（MiniMax/DeepSeek 等），base_url/api_key 透传
            model = req.model or "gpt-4o-mini"
            provider = RealOpenAIProvider(
                model=model,
                base_url=req.base_url,
                api_key=req.api_key,
                # A request carrying function tools is an Agent decision,
                # not a conversational response.  It must never get a
                # synthetic reply that could be mistaken for a tool result.
                allow_fallback=not is_production_profile() and not req.tools,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"unknown provider: {req.provider!r} (expected 'openai', 'anthropic', or 'custom')",
            )

        def _primary_call():
            return provider.chat(
                req.messages,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                tenant_id=req.tenant_id,
                tools=req.tools,
            )

        # P2: cooldown + bounded retry + env fallback chain.
        candidates: list[tuple[str, Any]] = [(req.provider, _primary_call)]
        for fb_model in load_fallback_chain(model):
            fb_provider = RealOpenAIProvider(
                model=fb_model,
                allow_fallback=not is_production_profile() and not req.tools,
            )

            def _fb_call(p=fb_provider):
                async def _run():
                    try:
                        return await p.chat(
                            req.messages,
                            temperature=req.temperature,
                            max_tokens=req.max_tokens,
                            tenant_id=req.tenant_id,
                            tools=req.tools,
                        )
                    finally:
                        await p.aclose()

                return _run()

            candidates.append(("openai", _fb_call))

        started = time.monotonic()
        try:
            resp = await call_with_resilience(candidates)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=503,
                detail="LLM provider unavailable; synthetic fallback is disabled",
            ) from exc
        finally:
            await provider.aclose()
        duration_ms = int((time.monotonic() - started) * 1000)

        # Detect fallback by checking for the stub marker in content
        is_fallback = "[stub-fallback]" in resp.content
        if is_fallback:
            logger.warning(
                "llmgw.chat.real.fallback",
                provider=req.provider,
                tenant_id=req.tenant_id,
            )

        # P0: meter the copilot hot path (previously unmetered).
        await _record_cost(
            model=resp.model or model,
            tenant_id=req.tenant_id,
            usage=resp.usage,
            user_id=user_id,
            provider=req.provider,
            duration_ms=duration_ms,
            status="fallback" if is_fallback else "success",
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
async def real_chat_stream_endpoint(req: RealChatRequest, request: Request):
    """Streaming function-calling decision turn (SuperAI agent loop).

    Same request shape as ``/chat/real`` but streams the provider deltas
    as SSE events so callers see reasoning tokens in real time:

      data: {"type": "token", "content", "reasoning_content", "tool_calls"}
      data: {"type": "done", "content", "reasoning_content", "tool_calls",
             "finish_reason", "usage"}
    """
    _apply_request_tenant(request, req)
    user_id = _ctx_user_id(request)
    await _enforce_api_key_limits(
        request,
        model=req.model,
        estimated_tokens=_messages_estimated_tokens(req.messages),
    )
    await _enforce_monthly_ceiling(req)
    _enforce_user_daily_cap(req, user_id=user_id)
    await _enforce_tenant_budget(req)
    if req.provider not in ("openai", "custom"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"streaming only supports openai/custom providers, got "
                f"{req.provider!r}"
            ),
        )
    from ..providers.real_openai_provider import RealOpenAIProvider
    from ..resilience.call import call_with_resilience

    model = req.model or "gpt-4o-mini"

    def _open_stream():
        """Create provider + stream and pull the first event (retryable unit).

        Retry/cooldown applies ONLY until the first SSE event — once tokens
        are flowing to the client, restarting would duplicate output.
        """
        async def _run():
            p = RealOpenAIProvider(
                model=model,
                base_url=req.base_url,
                api_key=req.api_key,
                # Tool-driven agent decisions are authorization-relevant.  A
                # synthetic completion can never stand in for a real function
                # call, even in a local profile: surface the upstream failure
                # so Copilot records a fail-closed ``llm_unavailable``
                # decision instead.
                allow_fallback=False,
            )
            s = p.stream_chat(
                req.messages,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                tools=req.tools,
                tenant_id=req.tenant_id,
            )
            try:
                first = await s.__anext__()
            except StopAsyncIteration:
                await p.aclose()
                raise RuntimeError("LLM provider returned no stream") from None
            except Exception:
                await p.aclose()
                raise
            return p, s, first

        return _run()

    try:
        provider, stream, first_event = await call_with_resilience(
            [(req.provider, _open_stream)]
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="LLM provider unavailable; synthetic fallback is disabled",
        ) from exc

    async def _event_stream():
        last_usage: dict[str, int] = {}
        try:
            yield f"data: {json.dumps(first_event, ensure_ascii=False)}\n\n"
            async for event in stream:
                if isinstance(event, dict) and event.get("type") == "done":
                    usage = event.get("usage")
                    if isinstance(usage, dict):
                        last_usage = usage
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            await provider.aclose()
            # P0: meter the streaming hot path once the stream ends
            # (usage is only authoritative on the "done" event).
            if last_usage:
                await _record_cost(
                    model=model,
                    tenant_id=req.tenant_id,
                    usage=last_usage,
                    user_id=user_id,
                    provider=req.provider,
                )

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
    model: str = Field("", description="多模态模型名（空=取 OPENAI_CHAT_MODEL env）")
    tenant_id: str = Field(default="default", description="租户 ID")
    # 请求级 OpenAI 兼容 provider 覆盖（同 /chat 的 base_url/api_key 语义，
    # 例如 ARK Plan /api/plan/v3 + vision 模型）。
    base_url: str | None = Field(default=None, description="OpenAI 兼容 base URL 覆盖")
    api_key: str | None = Field(default=None, description="API Key 覆盖")


class MultimodalApiResponse(BaseModel):
    """``/chat/multimodal`` response body."""

    content: str
    model: str
    usage: dict[str, Any] = {}


class _OpenAIMultimodalBridge:
    """MultimodalEngine provider protocol → ``openai_multimodal_chat`` 适配。

    引擎的简化消息（{"type":"image","image":ref}）桥接为 MultimodalContentPart
    列表，复用既有的 OpenAI-Vision 适配层（真实 /chat/completions 调用）。
    """

    def __init__(self, openai_provider: Any) -> None:
        self._provider = openai_provider

    async def chat(self, messages: list[dict[str, Any]], model: str) -> dict[str, Any]:
        from ..multimodal import MultimodalContentPart, MultimodalMessage
        from ..providers.multimodal_openai import openai_multimodal_chat

        mm_messages = [_to_mm_message(m) for m in messages]
        resp = await openai_multimodal_chat(self._provider, mm_messages)
        return {
            "content": resp.content,
            "model": resp.model or model,
            "usage": dict(resp.usage),
        }


def _to_mm_message(message: dict[str, Any]) -> Any:
    from ..multimodal import MultimodalContentPart, MultimodalMessage

    content = message.get("content")

    def _media_ref(ref: str, *, url_type: str, b64_type: str) -> MultimodalContentPart:
        if ref.startswith("data:"):
            header, _, b64 = ref.partition(",")
            media = header.removeprefix("data:").split(";")[0]
            return MultimodalContentPart(type=b64_type, data=b64, media_type=media or None)
        return MultimodalContentPart(type=url_type, url=ref)

    if not isinstance(content, list):
        return MultimodalMessage(
            role=str(message.get("role", "user")),
            content=[MultimodalContentPart(type="text", text=str(content or ""))],
        )
    parts: list[MultimodalContentPart] = []
    for part in content:
        ptype = str(part.get("type", "")) if isinstance(part, dict) else ""
        if ptype == "image":
            parts.append(_media_ref(
                str(part.get("image", "")), url_type="image_url", b64_type="image_base64",
            ))
        elif ptype == "audio":
            parts.append(_media_ref(
                str(part.get("audio", "")), url_type="audio_url", b64_type="audio_base64",
            ))
        else:
            parts.append(MultimodalContentPart(type="text", text=str(part.get("text", ""))))
    return MultimodalMessage(role=str(message.get("role", "user")), content=parts)


def _resolve_multimodal_provider(req: MultimodalApiRequest) -> tuple[Any, str]:
    """真实 OpenAI 兼容 vision provider 优先；无凭证时退回 dev stub。

    解析优先级：请求显式 base_url/api_key > OPENAI_BASE_URL/OPENAI_API_KEY env
    （MiniMax 等）。模型：req.model > OPENAI_CHAT_MODEL > gpt-4o-mini。
    """
    from ..providers.openai import OpenAIChatProvider

    base_url = req.base_url or os.getenv("OPENAI_BASE_URL") or ""
    api_key = req.api_key or os.getenv("OPENAI_API_KEY") or ""
    model = req.model or os.getenv("OPENAI_CHAT_MODEL") or "gpt-4o-mini"
    if base_url and api_key:
        bridge = _OpenAIMultimodalBridge(
            OpenAIChatProvider(api_key=api_key, base_url=base_url, model=model, timeout=120.0),
        )
        return bridge, model
    return None, model


@router.post("/chat/multimodal", response_model=MultimodalApiResponse)
async def multimodal_chat_endpoint(req: MultimodalApiRequest, request: Request) -> MultimodalApiResponse:
    """v3.2 W2: simplified multimodal chat (text + image + audio → text).

    Quota and cost reuse the same singletons as the text chat path
    (``get_quota_bucket()`` / ``get_cost_recorder()``), so multimodal
    calls are subject to the same per-tenant RPM/TPM limits and cost
    metering.
    """
    _apply_request_tenant(request, req)
    if is_production_profile():
        raise HTTPException(
            status_code=503,
            detail="Multimodal provider unavailable; synthetic fallback is disabled",
        )

    from ..multimodal.engine import MultimodalEngine, MultimodalRequest

    real_provider, model = _resolve_multimodal_provider(req)
    engine = (
        MultimodalEngine(real_provider) if real_provider is not None else MultimodalEngine()
    )

    # --- 1. Quota check (mirrors router.chat semantics) ---
    bucket = get_quota_bucket()
    if bucket is not None:
        from ..tokens import estimate_tokens

        estimated_tokens = estimate_tokens(req.prompt) + 100 * (
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
    request = MultimodalRequest(
        prompt=req.prompt,
        images=list(req.images),
        audio=list(req.audio),
        model=model,
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
                model=model, tenant_id=req.tenant_id, usage=resp.usage
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
        request_tenant_id = require_tenant(ctx)
        if tenant_id != request_tenant_id:
            raise TenantAccessError(
                f"path tenant {tenant_id!r} does not match request tenant {request_tenant_id!r}"
            )
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
    return await recorder.summary(tenant_id)


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
async def legacy_chat(req: ChatRequest, response: Response, request: Request) -> ChatResponseAPI:
    _apply_request_tenant(request, req)
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
    return ChatResponseAPI(**_chat_response_payload(resp))


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
    _apply_request_tenant(request, req)
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
