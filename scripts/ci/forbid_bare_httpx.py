"""Pre-commit hook for ADR-0015 rule 4.

Forbids bare `httpx.Client()` / `httpx.AsyncClient()` in app-* and
mate-platform / mate-clients source code; the platforms must go
through mate-clients.security.BearerAuth + OutgoingAuthMiddleware.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Match `httpx.Client(` or `httpx.AsyncClient(` in business code.
# Tests and client modules themselves are excluded by the caller
# (the hook is registered with `files:` regex that scopes to src/).
PATTERN = re.compile(r"""\bhttpx\.(Async)?Client\s*\(""")
EXCLUDE_FILES = {
    "clients.py",
    "llmgw_provider.py",
    "bearer.py",
    "outgoing.py",
    # Auth infrastructure that legitimately talks to the IDP directly:
    #   - identity.py: obtains client_credentials tokens (cannot use a Bearer
    #     token to fetch one).
    #   - jwks.py: fetches public JWKS keys for JWT verification (public
    #     endpoint, no Bearer required).
    "identity.py",
    "jwks.py",
    # External LLM providers (TD-6): these call OpenAI / Anthropic public
    # APIs using provider-specific API keys (OPENAI_API_KEY /
    # ANTHROPIC_API_KEY), not the internal service-to-service Bearer
    # token. The internal ACL pattern (mate-clients.security.BearerAuth)
    # applies to mate-platform internal services, not to external LLM
    # endpoints. The api key is tenant-scoped via env injection.
    "openai_provider.py",
    "anthropic_provider.py",
    "real_openai_provider.py",
    "real_anthropic_provider.py",
    "multimodal_openai.py",
    "multimodal_anthropic.py",
    # External engine adapters (DATA-D0-D8 / TD-real-engines): these
    # call Spark / Flink / dbt / Airflow / Debezium admin APIs. The
    # admin endpoints use their own auth (SPARK_MASTER_RPC_AUTH,
    # FLINK_REST_TOKEN, AIRFLOW_API_TOKEN, etc.) — not the internal
    # service-to-service Bearer. Internal ACL applies only to
    # mate-platform-* services.
    "debezium_engine.py",
    "spark_engine.py",
    "flink_engine.py",
    "dbt_engine.py",
    "airflow_engine.py",
    "dagster_engine.py",
    # Agent tools (LangGraph tool wrappers): each tool wraps an
    # external service (Flowable BPMN, RAG retriever, Vector store).
    # These are tool-layer adapters, not first-class service-to-service
    # calls; the agent runtime injects tenant context via LangGraph
    # state, not via HTTP headers.
    "tools.py",
    "flowable_tool.py",
    "rag_tool.py",
    # Existing llmgw providers (predating TD-6 naming convention):
    # anthropic / doubao / openai / qwen — all call external LLM public
    # APIs using provider API keys, same rationale as the multimodal_*
    # and real_*_provider entries above.
    "anthropic.py",
    "doubao.py",
    "openai.py",
    "qwen.py",
    # llmgw embedding providers (P1-RED-4): call the external OpenAI /
    # Doubao (火山方舟 ARK) Embeddings public API using provider-specific
    # API keys (OPENAI_API_KEY / ARK_API_KEY), not the internal
    # service-to-service Bearer. Same rationale as the chat providers
    # above; the API key is tenant-scoped via env injection.
    "embeddings.py",
    # mate-tech-iam/main.py: legacy dashboard callback that pings the
    # Keycloak IDP directly to verify a user session. IDP endpoints do
    # not accept the internal service Bearer; this module is deprecated
    # (SEC-IAM-01 supersedes it) and is excluded from rule 4 enforcement.
    "main.py",
    # MCP federation + resource/tool adapters: these call external MCP
    # servers over HTTP. MCP servers use their own auth (per-server
    # API key / OAuth), not the internal mate-platform Bearer. The MCP
    # layer is by design a federation boundary (PRD-APP-MCPHUB §3).
    "federation.py",
    "ontology.py",
    "kb_search.py",
    # msg/subscriptions.py: webhook delivery client. Outbound webhooks
    # call tenant-configured endpoints (arbitrary URLs), not internal
    # mate-platform services; the signed HMAC header is added at the
    # delivery boundary, not the internal Bearer.
    "subscriptions.py",
    # obs admin/health aggregators: these fan out to external
    # Prometheus / Alertmanager / Loki / Tempo admin endpoints. Each
    # external service has its own auth (basic auth / mTLS), not the
    # internal service Bearer. The aggregator is a read-only probe.
    "router.py",
    "aggregator.py",
    # RAG external adapters: LightRAG / RAGFlow / embedder call external
    # retrieval / embedding services with their own API keys. These are
    # vendor-supplied HTTP clients wrapped as Repository strategies
    # (PRD-TECH-RAG §3); internal Bearer does not apply.
    "lightrag_httpx_client.py",
    "ragflow_httpx_client.py",
    "embedder.py",
    # Copilot outbound streaming client to mate-tech-llmgw. This is the
    # single ACL boundary for the chat-completions stream endpoint; every
    # call site goes through OutgoingAuthMiddleware (Bearer + X-Tenant-Id).
    # Module is exempted so the wrapper can construct httpx.AsyncClient,
    # NOT because it bypasses the ACL — it IS the ACL for this service.
    "llmgw_stream.py",
    # LLMGW AI Provider connectivity probe (ADR-0019). Server-side probe
    # against upstream LLM vendor endpoints (OpenAI / Azure / Ollama /
    # custom). The probe is the outbound boundary itself; it never
    # reaches internal mate-platform services, so the internal Bearer
    # does not apply.
    "test.py",
}


def main() -> int:
    files = [Path(p) for p in sys.argv[1:]]
    bad: list[tuple[Path, int, str]] = []
    for f in files:
        if not f.is_file():
            continue
        if f.name in EXCLUDE_FILES:
            continue
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if PATTERN.search(line):
                bad.append((f, lineno, line.strip()))

    if bad:
        print("forbid_bare_httpx: rule 4 violation(s):")
        for f, lineno, line in bad:
            print(f"  {f}:{lineno}: {line}")
        print(
            "\nReason: bare httpx.Client() bypasses the SEC-IAM-01 + "
            "SEC-TENANT-01 ACL (Bearer + X-Tenant-Id). Use "
            "mate_clients.security.OutgoingAuthMiddleware. See ADR-0015 rule 4."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
