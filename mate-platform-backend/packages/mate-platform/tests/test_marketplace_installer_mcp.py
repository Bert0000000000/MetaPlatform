"""End-to-end tests for McpInstaller (MP-MCP-REGISTER-01).

Exercises the full installer loop:
  1. quarantine.store + sha256 digest verify
  2. McpMarketplaceClient.register_server called with manifest+blob
  3. hard-rule #14: registered_digest == manifest.digest
  4. quarantine.commit on success / rollback on digest mismatch
"""
from __future__ import annotations

import asyncio
import hashlib
import sys
from pathlib import Path

import pytest

# Add mate-platform src to import path (mirrors existing test layout).
_HERE = Path(__file__).resolve().parent
_BACKEND_ROOT = (_HERE / ".." / ".." / ".." / ".." / ".." / "packages").resolve()
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


@pytest.fixture
def quarantine_root(tmp_path, monkeypatch):
    monkeypatch.setenv("MP_MARKETPLACE_ROOT", str(tmp_path / "mkt"))
    yield tmp_path / "mkt"


def test_mcp_installer_happy_path(quarantine_root):
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_mcp import McpInstaller

    blob = b"mcp-artifact-bytes-v1"
    manifest = {
        "id": "artifact-mcp-001",
        "name": "example-mcp-server",
        "version": "1.2.3",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }

    class _StubClient:
        def __init__(self):
            self.calls = []

        async def register_server(self, *, artifact, blob):
            self.calls.append({"artifact": artifact, "blob": blob})
            return {
                "server_id": "srv-xyz",
                "name": artifact["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            }

    stub = _StubClient()
    installer = McpInstaller(mcp_client=stub)

    result = asyncio.run(
        installer.run(install_id="install-001", manifest=manifest, blob=blob)
    )

    assert result["server_id"] == "srv-xyz"
    assert result["registered_digest"] == manifest["digest"]["sha256"]
    assert len(stub.calls) == 1
    assert stub.calls[0]["artifact"]["id"] == "artifact-mcp-001"

    # quarantine + installed paths
    installed_dir = quarantine.INSTALLED / "mcp" / manifest["id"] / manifest["version"]
    installed_file = installed_dir / "bundle.tar.gz"
    assert installed_file.exists()
    assert installed_file.read_bytes() == blob
    # The install_id quarantine slot is empty (file was moved to installed/).
    assert not (quarantine.QUARANTINE / "install-001" / "bundle.tar.gz").exists()


def test_mcp_installer_digest_mismatch_rolls_back(quarantine_root):
    from mate_clients.marketplace.errors import DigestMismatch
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_mcp import McpInstaller

    blob = b"actual-blob"
    manifest = {
        "id": "artifact-mcp-002",
        "name": "mismatched",
        "version": "0.0.1",
        "digest": {"sha256": "0" * 64},
    }

    class _StubClient:
        async def register_server(self, *, artifact, blob):
            return {"registered_digest": manifest["digest"]["sha256"]}

    installer = McpInstaller(mcp_client=_StubClient())

    with pytest.raises(DigestMismatch):
        asyncio.run(
            installer.run(install_id="install-002", manifest=manifest, blob=blob)
        )

    assert not (quarantine.QUARANTINE / "install-002").exists()
    assert not (quarantine.INSTALLED / "mcp" / manifest["id"] / manifest["version"]).exists()


def test_mcp_installer_hard_rule_14_rolls_back(quarantine_root):
    """Upstream returns registered_digest != manifest.digest — must roll
    back quarantine and raise.
    """
    from mate_clients.marketplace.errors import DigestMismatch
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_mcp import McpInstaller

    blob = b"hard-rule-14-blob"
    manifest = {
        "id": "artifact-mcp-003",
        "name": "wrong-digest",
        "version": "0.0.1",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }

    class _StubClient:
        async def register_server(self, *, artifact, blob):
            # Backend claims a different digest than what the manifest says.
            return {"registered_digest": "deadbeef" * 8}

    installer = McpInstaller(mcp_client=_StubClient())

    with pytest.raises(DigestMismatch):
        asyncio.run(
            installer.run(install_id="install-003", manifest=manifest, blob=blob)
        )

    assert not (quarantine.QUARANTINE / "install-003").exists()
    assert not (quarantine.INSTALLED / "mcp" / manifest["id"] / manifest["version"]).exists()


def test_mcp_installer_real_client_returns_envelope(quarantine_root):
    """Integration-style: use the real McpMarketplaceClient with a
    MockTransport. Confirms the wiring between installer and client
    produces an envelope that satisfies hard-rule #14.
    """
    import httpx

    from mate_clients.marketplace.mcp import McpMarketplaceClient
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_mcp import McpInstaller

    blob = b"real-client-blob"
    manifest = {
        "id": "artifact-mcp-004",
        "name": "wired-up",
        "version": "2.0.0",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "server_id": "srv-real",
                "name": manifest["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = McpMarketplaceClient(base_url="http://mate-tech-mcp.test:8081")
    client._client = httpx.AsyncClient(transport=transport)

    installer = McpInstaller(mcp_client=client)
    result = asyncio.run(
        installer.run(install_id="install-004", manifest=manifest, blob=blob)
    )
    assert result["server_id"] == "srv-real"
    assert result["registered_digest"] == manifest["digest"]["sha256"]
    assert (
        quarantine.INSTALLED / "mcp" / manifest["id"] / manifest["version"] / "bundle.tar.gz"
    ).exists()
