"""marketplace clients — OCI pull + SaaS HTTP API tests.

硬规则 #4:外部系统必须走 ACL client(bearer + tenantHeader)。
"""
from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_clients.marketplace.client import (
    MarketplaceAuth,
    MarketplaceClient,
)
from mate_clients.marketplace.errors import (
    DigestMismatch,
)
from mate_clients.marketplace.oci import OCIPuller


@pytest.mark.asyncio
async def test_oci_pull_streams_and_verifies_digest():
    payload = b"hello world"
    digest = hashlib.sha256(payload).hexdigest()

    token_resp = _MockResp(json_data={"token": "tok"})
    stream_ctx = _MockStreamContext([payload])

    transport = MagicMock()
    transport.get = AsyncMock(return_value=token_resp)
    # stream() 返回 context manager(非 awaitable)
    transport.stream = MagicMock(return_value=stream_ctx)

    puller = OCIPuller(
        transport=transport, default_registry="https://reg"
    )
    out = []
    async for chunk in puller.stream_blob(
        kind="mcp",
        artifact_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        digest=digest,
        expected_digest=digest,
    ):
        out.append(chunk)
    assert b"".join(out) == payload


@pytest.mark.asyncio
async def test_oci_pull_rejects_digest_mismatch():
    payload = b"hello world"
    token_resp = _MockResp(json_data={"token": "tok"})
    stream_ctx = _MockStreamContext([payload])

    transport = MagicMock()
    transport.get = AsyncMock(return_value=token_resp)
    transport.stream = MagicMock(return_value=stream_ctx)

    puller = OCIPuller(
        transport=transport, default_registry="https://reg"
    )

    with pytest.raises(DigestMismatch):
        async for _ in puller.stream_blob(
            kind="mcp",
            artifact_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            digest="0" * 64,
            expected_digest="0" * 64,
        ):
            pass


@pytest.mark.asyncio
async def test_marketplace_client_passes_bearer_and_tenant():
    auth = MarketplaceAuth(bearer="t0k3n", tenant_id="tn-1")
    transport = AsyncMock()
    transport.get = AsyncMock(
        return_value=_MockResp(
            json_data={"items": [], "total": 0, "page": 1}
        )
    )

    client = MarketplaceClient(
        saas_url="https://market.example",
        auth=auth,
        transport=transport,
    )
    result = await client.list_artifacts(kind="mcp", page=1)

    assert result == {"items": [], "total": 0, "page": 1}
    call = transport.get.call_args
    headers = call.kwargs["headers"]
    assert headers["Authorization"] == "Bearer t0k3n"
    assert headers["X-Tenant-Id"] == "tn-1"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _MockResp:
    def __init__(self, *, status_code: int = 200, json_data=None):
        self.status_code = status_code
        self._json = json_data

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"http {self.status_code}")

    def json(self):
        return self._json


class _MockStreamContext:
    def __init__(self, chunks):
        self._chunks = chunks

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def raise_for_status(self) -> None:
        return None

    async def aiter_bytes(self):
        for c in self._chunks:
            yield c