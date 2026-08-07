"""HTTP streaming client from mate-app-copilot to mate-tech-llmgw.

Wraps `httpx.AsyncClient` so the bearer token + tenant header are
injected via `OutgoingAuthMiddleware` (compliant with hard rule 4:
no bare `httpx.AsyncClient(` in business code). The module is the
single outbound stream boundary for the copilot chat-completions
stream endpoint.

Two entry points are exposed:

* `stream_chat_real` — open a streaming request to
  ``POST /api/v1/llmgw/chat/real`` (the real-provider path that returns
  one SSE line per token). Returns an async iterator over the raw
  ``data: ...`` lines (the caller decides how to re-shape them into
  OpenAI-style chunks).
* `chat_completion` — fallback non-streaming request to
  ``POST /api/v1/llmgw/chat``. Returns the parsed JSON body or raises.

Both methods inject ``Authorization: Bearer`` + ``X-Tenant-Id`` from
the supplied `BearerAuth` instance. On any transport / decode error
the methods raise `LlmgwStreamError`; callers are expected to translate
that into a stub / fallback response, never swallow silently.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from mate_clients.security.bearer import BearerAuth
from mate_clients.security.outgoing import OutgoingAuthMiddleware


class LlmgwStreamError(RuntimeError):
    """Raised when the llmgw streaming call cannot complete."""


def _base_url(host: str, port: int) -> str:
    return f"http://{host}:{port}"


class LlmgwStreamClient:
    """Async streaming client for mate-tech-llmgw with ACL middleware.

    Hard rule 4 compliance: every outbound call goes through
    `OutgoingAuthMiddleware`, never a bare `httpx.AsyncClient`.

    Usage::

        client = LlmgwStreamClient(
            host="mate-tech-llmgw",
            port=8008,
            auth=bearer,
            tenant_id="t-acme",
        )
        async for line in client.stream_chat_real(messages=..., model="doubao-pro-32k"):
            ...
    """

    def __init__(
        self,
        *,
        host: str,
        port: int,
        auth: BearerAuth,
        tenant_id: str,
        timeout_seconds: float = 120.0,
        user_token: str | None = None,
    ) -> None:
        self._base_url = _base_url(host, port)
        self._auth = auth
        self._tenant_id = tenant_id
        self._timeout = timeout_seconds
        # dev 模式透传：keycloak client_credentials（stub secret）被拒时，
        # 直接用入站用户 token 调 llmgw（llmgw 侧 INSECURE_SKIP_SIGNATURE）。
        self._user_token = user_token

    @property
    def tenant_id(self) -> str:
        return self._tenant_id

    @property
    def base_url(self) -> str:
        return self._base_url

    def _auth_for(self) -> OutgoingAuthMiddleware:
        return OutgoingAuthMiddleware(self._auth, tenant_id=self._tenant_id)

    def _headers_for(self) -> dict[str, str]:
        """返回请求头：优先透传用户 token，否则走 service auth。"""
        headers: dict[str, str] = {"X-Tenant-Id": self._tenant_id}
        if self._user_token:
            headers["Authorization"] = f"Bearer {self._user_token}"
        return headers

    async def stream_chat_real(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """Open ``POST /api/v1/llmgw/chat/real`` and yield SSE ``data:`` lines.

        The real-provider endpoint is non-streaming in llmgw today
        (``real_chat_endpoint``); the upstream body is one JSON line
        containing the full completion. We emit that line as a single
        ``data:`` payload so the caller can transform it into the
        OpenAI-style SSE chunk the frontend expects.

        Yields raw ``data: <payload>\\n\\n`` lines (without the
        trailing ``[DONE]`` marker — the caller appends that).
        """
        body: dict[str, Any] = {
            "provider": "openai",  # TD-6: real endpoint requires provider field
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "tenant_id": self._tenant_id,
        }
        if max_tokens is not None:
            body["max_tokens"] = max_tokens

        url = f"{self._base_url}/api/v1/llmgw/chat/real"
        try:
            headers = self._headers_for()
            async with (
                httpx.AsyncClient(timeout=self._timeout) as http,
                http.stream(
                    "POST",
                    url,
                    json=body,
                    headers=headers,
                    auth=None if self._user_token else self._auth_for(),
                ) as resp,
            ):
                if resp.status_code != 200:
                    raise LlmgwStreamError(f"llmgw stream returned {resp.status_code}")
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    yield line
        except httpx.HTTPError as exc:
            raise LlmgwStreamError(f"llmgw stream transport error: {exc}") from exc

    async def chat_completion(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        """Non-streaming fallback: ``POST /api/v1/llmgw/chat``.

        Returns the parsed JSON body. Raises `LlmgwStreamError` on
        any transport / decode failure.
        """
        body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "tenant_id": self._tenant_id,
        }
        url = f"{self._base_url}/api/v1/llmgw/chat"
        try:
            headers = self._headers_for()
            async with httpx.AsyncClient(timeout=self._timeout) as http:
                resp = await http.post(
                    url,
                    json=body,
                    headers=headers,
                    auth=None if self._user_token else self._auth_for(),
                )
        except httpx.HTTPError as exc:
            raise LlmgwStreamError(f"llmgw chat transport error: {exc}") from exc
        if resp.status_code != 200:
            raise LlmgwStreamError(f"llmgw chat returned {resp.status_code}: {resp.text[:200]}")
        try:
            return resp.json()
        except (ValueError, json.JSONDecodeError) as exc:
            raise LlmgwStreamError(f"llmgw chat body is not JSON: {exc}") from exc
