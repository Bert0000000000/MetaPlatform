"""Wrap LLMGWClient.chat / stream_chat / embed to inject a JWT bearer token.

This file is intended to be preloaded via ``PYTHONSTARTUP`` before
``TECH-AGENT/main.py`` runs. It mutates the LLMGWClient methods in place so
that every cross-service call carries ``Authorization: Bearer <jwt>`` derived
from the ``TECH_LLMGW_BEARER`` environment variable (or a freshly minted
token if absent).

The intent is to enable Phase 2 acceptance E2E without modifying business
source. Behavior is identical to the upstream client when the env var is
empty; with the env var set, only the ``Authorization`` header is added.
"""

from __future__ import annotations

import os
from typing import Any, AsyncIterator, Dict, List, Optional


def _mint_token() -> str:
    """Mint a short-lived HS256 JWT compatible with TECH-LLMGW."""

    import datetime as dt

    import jwt

    secret = os.environ.get("TECH_LLMGW_JWT_SECRET", "metaplatform-jwt-secret-key-2026")
    now = dt.datetime.now(dt.timezone.utc)
    claims = {
        "sub": "tech-agent-bridge",
        "username": "tech-agent-bridge",
        "tenantId": os.environ.get("TECH_LLMGW_TENANT_ID", "tenant-m2v01"),
        "roles": ["PLATFORM_ADMIN", "AGENT_USER"],
        "type": "USER",
        "iat": now,
        "exp": now + dt.timedelta(hours=2),
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def install() -> None:
    token = os.environ.get("TECH_LLMGW_BEARER") or _mint_token()

    from app.clients import llmgw as _llmgw_mod

    _orig_chat = _llmgw_mod.LLMGWClient.chat
    _orig_stream = _llmgw_mod.LLMGWClient.stream_chat
    _orig_embed = _llmgw_mod.LLMGWClient.embed

    async def _chat(self, model_id, messages, **kwargs):  # type: ignore[override]
        # Inject Authorization by swapping headers at call time.
        from app.clients import llmgw as inner
        import httpx

        if not self._base_url:
            return inner.LLMGWClient._mock_chat(self, model_id, messages, kwargs.get("functions"))

        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
        trace_id = kwargs.get("trace_id")
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
        }
        if kwargs.get("max_tokens") is not None:
            payload["maxTokens"] = kwargs["max_tokens"]
        if kwargs.get("functions"):
            payload["functions"] = kwargs["functions"]

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/api/v1/llmgw/chat/completions",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                return resp.json()["data"]
        except httpx.HTTPError as exc:
            from app.common.errors import LLMGWUnavailableError
            raise LLMGWUnavailableError(
                f"LLM Gateway 调用失败: {exc}",
                data={"model": model_id},
            ) from exc

    async def _stream(self, model_id, messages, **kwargs):  # type: ignore[override]
        from app.clients import llmgw as inner
        import httpx

        if not self._base_url:
            async for chunk in inner.LLMGWClient._mock_stream(self, model_id, messages):
                yield chunk
            return

        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
        trace_id = kwargs.get("trace_id")
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "stream": True,
        }
        if kwargs.get("max_tokens") is not None:
            payload["maxTokens"] = kwargs["max_tokens"]

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/api/v1/llmgw/chat/completions",
                    json=payload,
                    headers=headers,
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        import json
                        data = json.loads(line[6:])
                        if data.get("choices"):
                            choice = data["choices"][0]
                            yield {
                                "delta": choice.get("delta", {}).get("content", ""),
                                "finish_reason": choice.get("finish_reason"),
                            }
        except httpx.HTTPError as exc:
            from app.common.errors import LLMGWUnavailableError
            raise LLMGWUnavailableError(
                f"LLM Gateway 流式调用失败: {exc}",
                data={"model": model_id},
            ) from exc

    async def _embed(self, model_id, texts, **kwargs):  # type: ignore[override]
        from app.clients import llmgw as inner
        import httpx

        if not self._base_url:
            return inner.LLMGWClient._mock_embed(self, model_id, texts)

        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
        trace_id = kwargs.get("trace_id")
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload = {"model": model_id, "input": texts}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/api/v1/llmgw/embeddings",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                return [item["embedding"] for item in data.get("embeddings", [])]
        except httpx.HTTPError as exc:
            from app.common.errors import LLMGWUnavailableError
            raise LLMGWUnavailableError(
                f"LLM Gateway Embedding 调用失败: {exc}",
                data={"model": model_id},
            ) from exc

    _llmgw_mod.LLMGWClient.chat = _chat
    _llmgw_mod.LLMGWClient.stream_chat = _stream
    _llmgw_mod.LLMGWClient.embed = _embed
    print("[r2-patch-llmgw-jwt] installed Authorization header injection", flush=True)


install()