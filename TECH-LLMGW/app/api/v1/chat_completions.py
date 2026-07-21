"""OpenAI-compatible chat completions endpoint.

Phase 2 acceptance fix: the LLM Gateway used to expose only
``/chat/multimodal`` which expects a vision payload. TECH-AGENT and any
OpenAI-style client call ``/chat/completions`` with a plain ``messages``
array. This thin wrapper accepts that contract and routes through the
existing ``ChatService.text_chat`` so the path is uniform.

P3 fix: rate-limit guard is now invoked before the model call so that
configured RPM/TPM rules actually take effect.
"""

from __future__ import annotations

import time
from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, model_validator

from app.chat.service import ChatService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import (
    AllProvidersFailedError,
    InvalidParamError,
    ModelNotAvailableError,
    RateLimitExceededError,
)
from app.deps import get_chat_service, get_rate_limit_guard, get_routing_optimizer
from app.ratelimits.schemas import RateLimitScope, RateLimitType
from app.routing.schemas import OptimizationStrategy, RoutingRequest
from app.routing.service import ModelRoutingOptimizer

router = APIRouter(tags=["chat-completions"])


class ChatCompletionMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = Field(default=None)  # 允许 autoRoute 时为空
    messages: List[ChatCompletionMessage] = Field(min_length=1, max_length=64)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=8192)
    system: Optional[str] = None
    autoRoute: bool = Field(default=False)
    strategy: Optional[str] = Field(default="balanced")  # cheapest / balanced / best_quality
    requiredCapabilities: Optional[List[str]] = Field(default=None)

    @model_validator(mode="after")
    def check_model_or_auto_route(self):
        if not self.model and not self.autoRoute:
            raise ValueError("model 与 autoRoute 必须指定其一")
        return self


def _flatten_text(messages: List[ChatCompletionMessage], system: Optional[str]) -> str:
    parts: list[str] = []
    if system:
        parts.append(f"[system]\n{system}")
    for m in messages:
        parts.append(f"[{m.role}]\n{m.content}")
    return "\n\n".join(parts)


@router.post("/chat/completions", summary="OpenAI 兼容纯文本对话")
async def chat_completions(
    request: Request,
    body: ChatCompletionRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: ChatService = Depends(get_chat_service),
    guard = Depends(get_rate_limit_guard),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
) -> dict:
    """Thin OpenAI-compatible wrapper.

    Accepts ``{model, messages, temperature, max_tokens, system}`` and
    returns a minimal ``{id, model, choices, usage}`` envelope that
    matches the OpenAI ChatCompletion shape. Internally routes through
    ``ChatService.text_chat`` so multimodal/vision capabilities remain
    available; if the model is not a CHAT/MULTIMODAL the existing
    ``ModelNotAvailableError`` is propagated as 422.

    When ``autoRoute`` is true (or ``model`` is omitted), the request is
    routed through ``ModelRoutingOptimizer`` to pick the best model for
    the configured strategy.
    """

    text = _flatten_text(body.messages, body.system)
    if not text.strip():
        raise InvalidParamError("messages 内容不能为空")

    model_id = body.model
    if body.autoRoute or not model_id:
        strategy = OptimizationStrategy(body.strategy or "balanced")
        caps = body.requiredCapabilities or ["CHAT"]
        prompt_tokens = max(1, len(text) // 4)
        rec = await optimizer.recommend(
            ctx.tenant_id,
            RoutingRequest(
                promptTokens=prompt_tokens,
                completionTokens=body.max_tokens or 256,
                requiredCapabilities=caps,
                strategy=strategy,
            ),
        )
        model_id = rec.recommendedModelId

    # Rate limit check: RPM per model
    if guard is not None:
        decision = guard.check_and_increment(
            ctx.tenant_id,
            RateLimitScope.MODEL,
            model_id,
            RateLimitType.RPM,
        )
        if not decision.allowed:
            raise RateLimitExceededError(
                f"RPM 限流: model={model_id}, limit={decision.limit}",
                data=decision.to_dict(),
            )

    start = time.monotonic()
    resp = await service.text_chat(
        ctx.tenant_id,
        model_id,
        text,
        system_prompt=body.system,
        temperature=body.temperature,
        max_tokens=body.max_tokens if body.max_tokens is not None else 1024,
    )
    elapsed_ms = resp.latencyMs + int((time.monotonic() - start) * 1000)

    return success(
        {
            "id": resp.id,
            "model": model_id,
            "provider": resp.provider,
            "autoRouted": body.autoRoute or not body.model,
            "recommendedModelId": model_id,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": resp.content},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "promptTokens": resp.usage.promptTokens,
                "completionTokens": resp.usage.completionTokens,
                "totalTokens": resp.usage.totalTokens,
            },
            "latencyMs": elapsed_ms,
        },
        trace_id=ctx.trace_id,
    )
