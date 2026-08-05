"""OCI Distribution Spec v2 数据面拉取器,边下载边校验 sha256。"""
from __future__ import annotations

import hashlib
from typing import AsyncIterator

from .errors import DigestMismatch


class OCIPuller:
    """流式拉 OCI v2 blob + sha256 verify。"""

    def __init__(
        self,
        *,
        transport,
        default_registry: str,
        token_cache=None,
    ) -> None:
        self.transport = transport
        self.default_registry = default_registry.rstrip("/")
        self.token_cache = token_cache

    async def fetch_token(
        self, *, registry: str, kind: str, artifact_id: str
    ) -> str:
        """从 OCI v2 token endpoint 拿短期 token。"""
        if self.token_cache is not None:
            cached = await self.token_cache.get(
                registry, kind, artifact_id
            )
            if cached is not None:
                return cached

        url = f"{registry}/v2/token"
        params = {
            "service": "mate.marketplace",
            "scope": f"repository:{kind}/{artifact_id}:pull",
        }
        resp = await self.transport.get(url, params=params)
        resp.raise_for_status()
        token = resp.json()["token"]

        if self.token_cache is not None:
            await self.token_cache.set(registry, kind, artifact_id, token)
        return token

    async def stream_blob(
        self,
        *,
        kind: str,
        artifact_id: str,
        digest: str,
        expected_digest: str,
        registry: str | None = None,
    ) -> AsyncIterator[bytes]:
        """流式拉 blob;边读边累加 sha256,完成后比对 expected_digest。

        mismatch 抛 DigestMismatch,流终止。
        """
        registry = registry or self.default_registry
        token = await self.fetch_token(
            registry=registry, kind=kind, artifact_id=artifact_id
        )
        url = (
            f"{registry}/v2/{kind}/{artifact_id}/blobs/{digest}"
        )
        headers = {"Authorization": f"Bearer {token}"}

        h = hashlib.sha256()
        async with self.transport.stream(
            "GET", url, headers=headers
        ) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                h.update(chunk)
                yield chunk

        if h.hexdigest() != expected_digest:
            raise DigestMismatch(
                f"expected {expected_digest}, got {h.hexdigest()}"
            )