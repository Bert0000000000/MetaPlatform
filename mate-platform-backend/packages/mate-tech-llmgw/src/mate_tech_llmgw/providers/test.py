"""Server-side AI provider connectivity probe (ADR-0019).

Browsers cannot make cross-origin requests to most LLM providers
(OpenAI / Azure / Anthropic / Ollama / MiniMax / Doubao / etc.) so
the AIProvidersPage UI calls a server-side endpoint that performs
the connectivity test on the user's behalf. The API key is sent
in the request body and is never persisted (see ADR-0019 §2.2).

OK semantics (intentionally lenient): HTTP 200, 401, or 403 all
count as "endpoint reachable", because 401/403 prove the address
resolves but credentials are wrong (which is exactly the
distinction the UI wants to surface).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Literal

import httpx
import structlog

logger = structlog.get_logger(__name__)


ProviderId = Literal["openai", "azure", "ollama", "custom"]


# Default probe path per provider. ``url`` is appended to the user's
# ``base_url`` after stripping trailing slash. Keep the table small
# so it can be maintained by hand and audited in code review.
_PROBE_PATHS: dict[ProviderId, str] = {
    "openai": "/models",
    "azure": "/openai/deployments?api-version=2024-02-01",
    "ollama": "/api/tags",
    "custom": "/models",
}


@dataclass(frozen=True, slots=True)
class ProbeResult:
    """Result of a connectivity probe.

    Attributes:
        ok: True when the endpoint is reachable (200/401/403 all count).
        status: HTTP status code (0 = no response).
        latency_ms: Round-trip time in milliseconds.
        message: Short human-readable summary (Chinese for UI labels).
        hint: Optional troubleshooting hint surfaced to the UI.
        error: Short error category when the request does not return a
            response (e.g. "connect_timeout", "tls_error", "dns_error").
    """

    ok: bool
    status: int
    latency_ms: int
    message: str
    hint: str | None = None
    error: str | None = None


def default_probe_url(provider: ProviderId, base_url: str) -> str:
    """Return the default probe URL for ``provider`` + ``base_url``.

    The result is what the AIProvidersPage UI would otherwise fetch
    directly (and get blocked by CORS). The UI can choose to call
    this endpoint without supplying its own URL; this keeps the
    provider-specific path table in one place.
    """
    base = base_url.rstrip("/")
    return base + _PROBE_PATHS[provider]


def _mask_api_key(api_key: str | None) -> str | None:
    """Return a never-log-safe form of the API key.

    Truncates to first 4 characters + ``***``. The function is the
    single place where an AK touches a log line; every code path that
    emits a log MUST call this first.
    """
    if not api_key:
        return None
    return api_key[:4] + "***"


async def probe(
    *,
    provider: ProviderId,
    base_url: str,
    api_key: str | None = None,
    timeout_sec: float = 10.0,
) -> ProbeResult:
    """Probe an upstream LLM endpoint.

    Hard rule 4: we use bare ``httpx.AsyncClient`` here because the
    call is the outbound boundary itself; the file is registered in
    ``scripts/ci/forbid_bare_httpx.py`` EXCLUDE_FILES.
    """
    if not base_url:
        return ProbeResult(
            ok=False,
            status=0,
            latency_ms=0,
            message="参数缺失",
            hint="请填写 Base URL",
            error="missing_base_url",
        )

    timeout_sec = max(1.0, min(timeout_sec, 30.0))
    url = default_probe_url(provider, base_url)
    headers: dict[str, str] = {"accept": "application/json"}
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout_sec, follow_redirects=False) as client:
            resp = await client.get(url, headers=headers)
    except httpx.TimeoutException:
        return ProbeResult(
            ok=False,
            status=0,
            latency_ms=int((time.monotonic() - start) * 1000),
            message="连接超时",
            hint="检查 Base URL 与网络连通性",
            error="connect_timeout",
        )
    except httpx.ConnectError as exc:
        logger.warning(
            "llmgw.providers.test.connect_error",
            provider=provider,
            url_host=httpx.URL(base_url).host,
            error=type(exc).__name__,
            api_key=_mask_api_key(api_key),
        )
        return ProbeResult(
            ok=False,
            status=0,
            latency_ms=int((time.monotonic() - start) * 1000),
            message="无法连接",
            hint="检查 Base URL 与网络连通性",
            error="connect_error",
        )
    except httpx.HTTPError as exc:  # broad fallback for TLS / DNS errors
        logger.warning(
            "llmgw.providers.test.transport_error",
            provider=provider,
            url_host=httpx.URL(base_url).host,
            error=type(exc).__name__,
            api_key=_mask_api_key(api_key),
        )
        return ProbeResult(
            ok=False,
            status=0,
            latency_ms=int((time.monotonic() - start) * 1000),
            message="传输错误",
            hint="检查 TLS 证书与 DNS",
            error="transport_error",
        )

    latency_ms = int((time.monotonic() - start) * 1000)
    if resp.status_code == 200:
        return ProbeResult(
            ok=True,
            status=resp.status_code,
            latency_ms=latency_ms,
            message="端点可达",
        )
    if resp.status_code in (401, 403):
        return ProbeResult(
            ok=True,
            status=resp.status_code,
            latency_ms=latency_ms,
            message="端点可达 (鉴权失败, 请检查 API Key)",
        )
    # 404 / 405 / 5xx — endpoint resolved but did not accept the probe path.
    return ProbeResult(
        ok=False,
        status=resp.status_code,
        latency_ms=latency_ms,
        message=f"HTTP {resp.status_code}",
        hint="Base URL 可能正确, 但 /models 路径不通; Advanced API 路径可能需要调整",
        error="bad_status",
    )