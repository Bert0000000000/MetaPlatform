"""Embedding providers (P1-RED-4).

``EmbeddingProvider`` 抽象 + ``OpenAIEmbeddingProvider`` (real OpenAI
Embeddings API + 确定性 hash fallback) + ``LocalEmbeddingProvider``
(纯离线 hash 向量)。

设计对齐 ``real_openai_provider.py`` (TD-6):

  * **Tenant-scoped API key**: 优先解析 ``OPENAI_API_KEY_{TENANT}``
    (大写、连字符转下划线)，回退到全局 ``OPENAI_API_KEY``。
    满足硬规则 12 (secret 不进 git) + 租户隔离 (硬规则 3)。
  * **Stub fallback**: 真实调用失败 (无 key / 超时 / HTTP 错误) 时，
    返回基于 SHA-256 的确定性 384 维向量，调用方永远拿到回复，
    并通过 structlog 发出 warning (硬规则 9 lineage)。
  * **Doubao 兼容**: 火山方舟 ARK 的 embedding 接口是 OpenAI 兼容
    协议，因此 ``openai`` provider 同时覆盖 ``doubao``。

外部 LLM 公共 API 使用 provider API key，不走内部服务间 Bearer
(mate-clients.security.BearerAuth 仅适用于 mate-platform 内部服务)，
故在 ``scripts/ci/forbid_bare_httpx.py`` 的 EXCLUDE_FILES 中豁免，
与 ``openai.py`` / ``doubao.py`` / ``real_openai_provider.py`` 同理。
"""
from __future__ import annotations

import hashlib
import math
import os
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

import httpx
import structlog

logger = structlog.get_logger(__name__)

_OPENAI_BASE_URL = "https://api.openai.com/v1"
_DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
_DEFAULT_MODEL = "text-embedding-3-small"
# 离线 hash fallback 固定 384 维 (轻量、确定性、足够区分文本)。
_DEFAULT_DIM = 384


@dataclass(frozen=True, slots=True)
class EmbeddingResult:
    """单条文本嵌入结果."""

    embedding: list[float]
    model: str
    usage: dict[str, int] = field(default_factory=dict)


def _hash_embedding(text: str, dim: int = _DEFAULT_DIM) -> list[float]:
    """确定性 hash-based embedding (离线 fallback).

    基于 SHA-256 派生 ``dim`` 维向量并做 L2 归一化。
    相同文本 → 相同向量；不同文本 → (概率上) 不同向量。
    """
    blocks: list[bytes] = []
    counter = 0
    while len(blocks) * 32 < dim * 4:
        blocks.append(
            hashlib.sha256(f"{counter}:{text}".encode("utf-8")).digest()
        )
        counter += 1
    raw = b"".join(blocks)
    vals = [
        int.from_bytes(raw[i * 4 : (i + 1) * 4], "big") / 0xFFFFFFFF * 2 - 1
        for i in range(dim)
    ]
    norm = math.sqrt(sum(v * v for v in vals)) or 1.0
    return [v / norm for v in vals]


def _estimate_tokens(text: str) -> int:
    """粗略 token 估算 (~4 chars/token，最少 1)."""
    return max(1, len(text) // 4)


@runtime_checkable
class EmbeddingProvider(Protocol):
    """统一的 Embedding Provider 接口 — 所有 provider 必须实现."""

    model: str

    async def embed(
        self,
        text: str,
        *,
        model: str | None = None,
        tenant_id: str = "",
    ) -> EmbeddingResult:
        """异步 embedding 调用."""
        ...

    @property
    def dim(self) -> int:
        """provider 支持的 embedding 维度."""
        ...

    async def aclose(self) -> None:
        """释放底层 HTTP 客户端(如有)."""
        ...


class OpenAIEmbeddingProvider:
    """OpenAI Embeddings provider (real API + 确定性 hash fallback).

    同时覆盖 ``openai`` 与 ``doubao`` (火山方舟 ARK 为 OpenAI 兼容协议)。
    """

    provider_type = "openai-embedding"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = _DEFAULT_MODEL,
        base_url: str | None = None,
        timeout: float = 30.0,
        dim: int = _DEFAULT_DIM,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self._base_url = base_url or os.getenv("OPENAI_BASE_URL", _OPENAI_BASE_URL)
        self._timeout = timeout
        self._dim = dim
        self._client: httpx.AsyncClient | None = None

    def _resolve_api_key(self, tenant_id: str) -> str:
        """解析租户 API key.

        优先级: 显式 ``api_key`` > ``OPENAI_API_KEY_{TENANT}`` >
        ``OPENAI_API_KEY``。
        """
        if self._api_key:
            return self._api_key
        if tenant_id:
            tenant_key = f"OPENAI_API_KEY_{tenant_id.upper().replace('-', '_')}"
            val = os.getenv(tenant_key, "")
            if val:
                return val
        return os.getenv("OPENAI_API_KEY", "")

    async def _get_client(self, api_key: str) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={"Authorization": f"Bearer {api_key}"},
            )
        return self._client

    async def embed(
        self,
        text: str,
        *,
        model: str | None = None,
        tenant_id: str = "",
    ) -> EmbeddingResult:
        """调 OpenAI Embeddings API，失败时回退到确定性 hash 向量."""
        target_model = model or self.model
        api_key = self._resolve_api_key(tenant_id)
        tokens = _estimate_tokens(text)
        if not api_key:
            logger.warning(
                "llmgw.embedding.openai.no_key",
                tenant_id=tenant_id,
                model=target_model,
            )
            return EmbeddingResult(
                embedding=_hash_embedding(text, self._dim),
                model=target_model,
                usage={"prompt_tokens": tokens, "total_tokens": tokens},
            )

        payload: dict[str, Any] = {"model": target_model, "input": text}
        try:
            client = await self._get_client(api_key)
            resp = await client.post("/embeddings", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning(
                "llmgw.embedding.openai.timeout",
                tenant_id=tenant_id,
                model=target_model,
            )
            return EmbeddingResult(
                embedding=_hash_embedding(text, self._dim),
                model=target_model,
                usage={"prompt_tokens": tokens, "total_tokens": tokens},
            )
        except httpx.HTTPError as e:
            logger.warning(
                "llmgw.embedding.openai.error",
                tenant_id=tenant_id,
                model=target_model,
                error=str(e),
            )
            return EmbeddingResult(
                embedding=_hash_embedding(text, self._dim),
                model=target_model,
                usage={"prompt_tokens": tokens, "total_tokens": tokens},
            )

        try:
            embedding: list[float] = [
                float(x) for x in data["data"][0]["embedding"]
            ]
        except (KeyError, IndexError, TypeError, ValueError) as e:
            logger.warning(
                "llmgw.embedding.openai.bad_payload",
                tenant_id=tenant_id,
                model=target_model,
                error=str(e),
            )
            return EmbeddingResult(
                embedding=_hash_embedding(text, self._dim),
                model=target_model,
                usage={"prompt_tokens": tokens, "total_tokens": tokens},
            )

        usage = data.get("usage", {})
        return EmbeddingResult(
            embedding=embedding,
            model=data.get("model", target_model),
            usage={
                "prompt_tokens": usage.get("prompt_tokens", tokens),
                "total_tokens": usage.get("total_tokens", tokens),
            },
        )

    @property
    def dim(self) -> int:
        return self._dim

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


class LocalEmbeddingProvider:
    """纯离线 embedding provider — 始终返回确定性 hash 向量，无网络.

    用于本地开发 / CI / 隐私敏感场景 (``provider=local``)。
    """

    provider_type = "local-embedding"

    def __init__(self, *, model: str = _DEFAULT_MODEL, dim: int = _DEFAULT_DIM) -> None:
        self.model = model
        self._dim = dim

    async def embed(
        self,
        text: str,
        *,
        model: str | None = None,
        tenant_id: str = "",
    ) -> EmbeddingResult:
        target_model = model or self.model
        tokens = _estimate_tokens(text)
        return EmbeddingResult(
            embedding=_hash_embedding(text, self._dim),
            model=target_model,
            usage={"prompt_tokens": tokens, "total_tokens": tokens},
        )

    @property
    def dim(self) -> int:
        return self._dim

    async def aclose(self) -> None:
        """无网络客户端，no-op."""


# ---------------------------------------------------------------------------
# Provider 注册表 (懒加载单例，对齐 router._providers 模式)
# ---------------------------------------------------------------------------
_embedding_providers: dict[str, EmbeddingProvider] = {}


def get_embedding_provider(name: str) -> EmbeddingProvider:
    """按名称获取 embedding provider 实例 (懒加载 + 单例).

    支持的 ``name``: ``openai`` / ``doubao`` (OpenAI 兼容) / ``local``
    (离线 hash)。未知名称回退到 ``openai``。
    """
    key = (name or "").lower().strip()
    if key in _embedding_providers:
        return _embedding_providers[key]

    if key in ("", "openai"):
        provider: EmbeddingProvider = OpenAIEmbeddingProvider()
    elif key == "doubao":
        # 火山方舟 ARK embedding 接口为 OpenAI 兼容协议
        provider = OpenAIEmbeddingProvider(
            base_url=os.getenv("ARK_BASE_URL", _DOUBAO_BASE_URL),
        )
    elif key == "local":
        provider = LocalEmbeddingProvider()
    else:
        # 未知 provider 回退到 openai (best-effort)
        provider = OpenAIEmbeddingProvider()

    _embedding_providers[key] = provider
    logger.info("llmgw.embedding.provider.initialized", name=key or "openai")
    return provider


def reset_embedding_providers() -> None:
    """测试辅助: 清除 embedding provider 缓存."""
    _embedding_providers.clear()
    _configured_provider_cache.clear()


# ---------------------------------------------------------------------------
# Admin-configured provider (后台 AI Provider 页 → ai.embedding.default_provider)
# ---------------------------------------------------------------------------
_configured_provider_cache: dict[tuple[str, str, str], OpenAIEmbeddingProvider] = {}


async def _fetch_iam_configs(request, tenant_id: str) -> dict[str, str]:
    """Read the tenant's IAM SystemConfig key→value map.

    Two paths:
    1. In-process reader (dev server injects ``app.state.iam_config_reader``),
       so the unified dev server reads the shared IAM store directly without
       needing Keycloak service-identity round-trips.
    2. HTTP + service identity (production, service-to-service) — mirrors
       ``mate_app_copilot.clients.base.get_provider_config``.
    """
    app_state = getattr(getattr(request, "app", None), "state", None)
    reader = getattr(app_state, "iam_config_reader", None)
    if reader is not None:
        try:
            items = await reader(tenant_id or "default")
            return {str(it.get("key", "")): str(it.get("value") or "") for it in items}
        except Exception as e:  # noqa: BLE001
            logger.warning("llmgw.embedding.resolve_config.inprocess_failed", error=str(e))
            return {}

    iam_url = os.environ.get("IAM_URL", "http://localhost:8100").rstrip("/")
    url = f"{iam_url}/api/v1/admin/configs?pageSize=200"
    headers = {"X-Tenant-Id": tenant_id or "default"}
    auth_obj = getattr(app_state, "service_identity", None)
    try:
        import httpx
        from mate_clients.security import OutgoingAuthMiddleware

        if auth_obj is not None:
            client = httpx.AsyncClient(
                auth=OutgoingAuthMiddleware(auth_obj, tenant_id=tenant_id or "default"),
                timeout=10.0,
            )
        else:
            client = httpx.AsyncClient(timeout=10.0)
        async with client as c:
            resp = await c.get(url, headers=headers)
        resp.raise_for_status()
        body = resp.json()
        data = body.get("data", body)
        items = data.get("items", []) if isinstance(data, dict) else []
        return {str(it.get("key", "")): str(it.get("value") or "") for it in items}
    except Exception as e:  # noqa: BLE001 — any failure → fallback path
        logger.warning("llmgw.embedding.resolve_config.failed", error=str(e))
        return {}


async def resolve_effective_embedding(request, tenant_id: str) -> dict[str, str]:
    """Resolve the tenant's effective embedding provider config from IAM.

    Reads ``ai.embedding.default_provider`` from the IAM admin config store,
    then that provider's ``base_url`` / ``api_key`` / ``embedding_model``.
    Returns ``{}`` when embedding is disabled, unconfigured, or unreadable —
    the caller then falls back to the request/env provider path.
    """
    cfg = await _fetch_iam_configs(request, tenant_id)
    pid = cfg.get("ai.embedding.default_provider", "")
    if not pid or pid == "disabled":
        return {}
    prefix = f"ai.provider.{pid}."
    base_url = cfg.get(f"{prefix}base_url", "")
    if not base_url:
        return {}
    return {
        "provider": pid,
        "base_url": base_url,
        "api_key": cfg.get(f"{prefix}api_key", ""),
        "model": cfg.get(f"{prefix}embedding_model", "") or cfg.get(f"{prefix}default_model", ""),
    }


def build_configured_embedding_provider(
    *, base_url: str, api_key: str, model: str
) -> OpenAIEmbeddingProvider:
    """Build (cached) OpenAIEmbeddingProvider from admin-resolved config.

    Cached by (base_url, api_key-prefix, model) so the underlying httpx client
    is reused across the many per-chunk /embeddings calls in one ingest.
    """
    cache_key = (base_url, api_key[:4] if api_key else "", model or _DEFAULT_MODEL)
    cached = _configured_provider_cache.get(cache_key)
    if cached is not None:
        return cached
    provider = OpenAIEmbeddingProvider(
        api_key=api_key or None,
        base_url=base_url,
        model=model or _DEFAULT_MODEL,
    )
    _configured_provider_cache[cache_key] = provider
    logger.info(
        "llmgw.embedding.provider.configured",
        base_url=base_url,
        model=model or _DEFAULT_MODEL,
    )
    return provider
