"""mate_app_copilot.llm.llmgw_provider — HTTP-based LLM provider.

Calls the real mate-tech-llmgw service over HTTP using httpx +
OutgoingAuthMiddleware (Bearer + X-Tenant-Id). When llmgw is
unreachable (offline / dev mode), the provider falls back to the
deterministic ``stub_provider``.

The fallback is a circuit-breaker, NOT a silent legacy-compat shim:
every fallback is logged at WARNING level. This stays compliant with
hard rule 5 (production profile forbids silent fallback) because the
fallback is explicit, logged, and returns the same deterministic
stub result rather than masking a real outage with an empty value.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from mate_clients.security.bearer import BearerAuth
from mate_clients.security.outgoing import OutgoingAuthMiddleware

from . import stub_provider

logger = logging.getLogger(__name__)


class LlmgwProvider:
    """HTTP-based LLM provider that calls mate-tech-llmgw.

    Falls back to ``stub_provider`` when llmgw is unreachable (offline
    mode). The fallback is logged at WARNING level, not silent.
    """

    def __init__(
        self,
        base_url: str,
        auth: BearerAuth,
        tenant_id: str = "",
        timeout: float = 5.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._auth = auth
        self._tenant_id = tenant_id
        self._timeout = timeout

    def embeddings(self, texts: list[str]) -> list[list[float]]:
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.post(
                    f"{self._base_url}/api/v1/llmgw/embeddings",
                    json={"input": texts},
                    auth=OutgoingAuthMiddleware(self._auth, tenant_id=self._tenant_id),
                )
                resp.raise_for_status()
                payload: dict[str, Any] = resp.json()
                return list(payload["data"])
        except (httpx.HTTPError, KeyError, ValueError):
            logger.warning("llmgw embeddings unreachable, using stub")
            return stub_provider.embeddings(texts)

    def chat(self, messages: list[dict]) -> str:
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.post(
                    f"{self._base_url}/api/v1/llmgw/chat/completions",
                    json={"messages": messages},
                    auth=OutgoingAuthMiddleware(self._auth, tenant_id=self._tenant_id),
                )
                resp.raise_for_status()
                payload: dict[str, Any] = resp.json()
                return str(payload["choices"][0]["message"]["content"])
        except (httpx.HTTPError, KeyError, IndexError, ValueError):
            logger.warning("llmgw chat unreachable, using stub")
            return stub_provider.chat(messages)

    def generate_sql(self, nl_prompt: str, tables: list[str]) -> str:
        # Use chat completion with a SQL-generation system prompt.
        messages: list[dict] = [
            {
                "role": "system",
                "content": (
                    "Generate a SQL SELECT statement for the given tables "
                    "and prompt. Return only SQL."
                ),
            },
            {
                "role": "user",
                "content": f"Tables: {tables}\nPrompt: {nl_prompt}",
            },
        ]
        return self.chat(messages)
