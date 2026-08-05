"""marketplace installer dispatch tests。

[blocked-on: MP-MCP-REGISTER-01] — mate-tech-mcp 暂无 POST /servers endpoint,
故使用 AsyncMock 模拟 mcp_client.register_server(...)。Task 5-7 期间继续,
待 mate-tech-mcp 提交后改走真实 client。
"""
from __future__ import annotations

import hashlib
import io
import tarfile
import uuid
from unittest.mock import AsyncMock

import pytest

from mate_clients.marketplace.errors import DigestMismatch
from mate_platform.marketplace.jobs.installer_mcp import McpInstaller
from mate_platform.marketplace.jobs.installer_agent import AgentInstaller
from mate_platform.marketplace.jobs.installer_ontology import (
    OntologyInstaller,
)


def _make_tar_gz() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        data = b"hello"
        info = tarfile.TarInfo("manifest.json")
        info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
    return buf.getvalue()


@pytest.fixture
def bundle():
    return _make_tar_gz()


@pytest.fixture
def manifest(bundle):
    return {
        "schemaVersion": "mate.marketplace/v1",
        "kind": "mcp",
        "id": str(uuid.uuid4()),
        "name": "test",
        "version": "1.0.0",
        "digest": {"sha256": hashlib.sha256(bundle).hexdigest()},
        "blobs": [],
    }


@pytest.mark.asyncio
async def test_mcp_installer_calls_register_endpoint(bundle, manifest):
    """[blocked-on: MP-MCP-REGISTER-01] 用 AsyncMock 模拟 mcp_client.register_server。"""
    payload = {
        "instance_uid": "mcp-srv-1",
        "registered_digest": manifest["digest"]["sha256"],
    }
    mcp_client = AsyncMock()
    mcp_client.register_server = AsyncMock(return_value=payload)

    installer = McpInstaller(mcp_client=mcp_client)
    result = await installer.run(
        install_id=uuid.uuid4(), manifest=manifest, blob=bundle
    )

    assert result["instance_uid"] == "mcp-srv-1"
    mcp_client.register_server.assert_awaited_once()


@pytest.mark.asyncio
async def test_digest_mismatch_raises_in_installer(bundle, manifest):
    """硬规则 #14:registered_digest 与 manifest 不一致,拒收。"""
    mcp_client = AsyncMock()
    installer = McpInstaller(mcp_client=mcp_client)

    tampered_manifest = {
        **manifest,
        "digest": {"sha256": "0" * 64},
    }

    with pytest.raises(DigestMismatch):
        await installer.run(
            install_id=uuid.uuid4(),
            manifest=tampered_manifest,
            blob=bundle,
        )


@pytest.mark.asyncio
async def test_agent_and_ontology_have_analogous_register_calls(bundle):
    """agent / ontology installer 都有同形的 register_* 调用与硬规则 #14 校验。"""
    for kind, factory, attr in (
        ("agent", AgentInstaller, "register_agent"),
        ("ontology", OntologyInstaller, "register_ontology"),
    ):
        client = AsyncMock()
        setattr(
            client,
            attr,
            AsyncMock(
                return_value={
                    "instance_uid": f"{kind}-1",
                    "registered_digest": hashlib.sha256(bundle).hexdigest(),
                }
            ),
        )
        installer = factory(client=client)
        manifest = _bundle_manifest(bundle, kind)
        result = await installer.run(
            install_id=uuid.uuid4(),
            manifest=manifest,
            blob=bundle,
        )
        assert result["instance_uid"] == f"{kind}-1"


def _bundle_manifest(bundle: bytes, kind: str) -> dict:
    return {
        "schemaVersion": "mate.marketplace/v1",
        "kind": kind,
        "id": str(uuid.uuid4()),
        "name": "test",
        "version": "1.0.0",
        "digest": {"sha256": hashlib.sha256(bundle).hexdigest()},
        "blobs": [],
    }