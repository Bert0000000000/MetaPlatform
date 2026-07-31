"""mate_app_copilot.clients — outbound client with BearerAuth.

Provides typed client wrappers for copilot → llmgw / kb / ontology /
a2a cross-service calls. Each client injects `Authorization: Bearer`
+ `X-Tenant-Id` via `OutgoingAuthMiddleware`.

P2-W4 adds real call methods (embeddings, chat, generate_sql) that
go through `httpx.Client(auth=...)`. The actual transport is the
stub_provider for the in-process / single-binary deployment; the
same call sites will switch to llmgw over HTTP in v3.1.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from mate_clients.security.bearer import BearerAuth
from mate_clients.security.outgoing import OutgoingAuthMiddleware


@dataclass(frozen=True)
class AsyncCopilotClient:
    """Base config for copilot outbound calls.

    Holds the shared BearerAuth instance and service base URLs.
    The `provider` attribute points at a module exposing
    embeddings / chat / generate_sql — currently the in-process
    `mate_app_copilot.llm.stub_provider`. P2-W5 / v3.1 will
    swap it for an httpx-based remote llmgw adapter.
    """
    base_url: str
    auth: BearerAuth
    provider: Any
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
        for name in ("embeddings", "chat", "generate_sql"):
            if not hasattr(self.provider, name):
                raise ValueError(
                    f"provider {self.provider!r} missing {name!r} method"
                )

    def _middleware(self, tenant_id: str) -> OutgoingAuthMiddleware:
        """Build an httpx auth middleware for a specific tenant."""
        return OutgoingAuthMiddleware(self.auth, tenant_id=tenant_id)

    def llmgw_url(self) -> str:
        return f"{self.base_url}/api/v1/llmgw"

    def kb_url(self) -> str:
        return f"{self.base_url}/api/v1/kb"

    def ont_url(self) -> str:
        return f"{self.base_url}/api/v1/ont"

    def a2a_url(self) -> str:
        return f"{self.base_url}/api/v1/a2a"

    # --- Real call methods (P2-W4) -----------------------------------------
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts via the configured LLM provider."""
        return self.provider.embeddings(texts)

    def chat(self, messages: list[dict]) -> str:
        """Run a chat completion via the configured LLM provider."""
        return self.provider.chat(messages)

    def generate_sql(self, nl_prompt: str, tables: list[str]) -> str:
        """Generate SQL from a natural-language prompt."""
        return self.provider.generate_sql(nl_prompt, tables)
