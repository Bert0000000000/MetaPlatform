"""End-to-end tests for AgentInstaller (MP-AGENT-REGISTER-01).

Exercises the full installer loop:
  1. quarantine.store + sha256 digest verify
  2. AgentMarketplaceClient.register_agent called with manifest+blob
  3. hard-rule #14: registered_digest == manifest.digest
  4. quarantine.commit on success / rollback on digest mismatch
"""
from __future__ import annotations

import asyncio
import hashlib
import sys
from pathlib import Path

import pytest

# Add mate-platform src to import path.
_HERE = Path(__file__).resolve().parent
_BACKEND_ROOT = (_HERE / ".." / ".." / ".." / ".." / ".." / "packages").resolve()
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


@pytest.fixture
def quarantine_root(tmp_path, monkeypatch):
    monkeypatch.setenv("MP_MARKETPLACE_ROOT", str(tmp_path / "mkt"))
    yield tmp_path / "mkt"


def test_agent_installer_happy_path(quarantine_root):
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_agent import AgentInstaller

    blob = b"agent-artifact-bytes-v1"
    manifest = {
        "id": "artifact-agent-001",
        "name": "example-agent",
        "version": "1.0.0",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }

    class _StubClient:
        def __init__(self):
            self.calls = []

        async def register_agent(self, *, artifact, blob):
            self.calls.append({"artifact": artifact, "blob": blob})
            return {
                "agent_id": "agt-001",
                "name": artifact["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            }

    stub = _StubClient()
    installer = AgentInstaller(agent_client=stub)

    result = asyncio.run(
        installer.run(install_id="install-001", manifest=manifest, blob=blob)
    )

    assert result["agent_id"] == "agt-001"
    assert result["registered_digest"] == manifest["digest"]["sha256"]
    assert len(stub.calls) == 1
    assert stub.calls[0]["artifact"]["id"] == "artifact-agent-001"

    installed_file = (
        quarantine.INSTALLED / "agent" / manifest["id"] / manifest["version"] / "bundle.tar.gz"
    )
    assert installed_file.exists()
    assert installed_file.read_bytes() == blob
    assert not (quarantine.QUARANTINE / "install-001" / "bundle.tar.gz").exists()


def test_agent_installer_digest_mismatch_rolls_back(quarantine_root):
    from mate_clients.marketplace.errors import DigestMismatch
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_agent import AgentInstaller

    blob = b"actual-blob"
    manifest = {
        "id": "artifact-agent-002",
        "name": "mismatched",
        "version": "0.0.1",
        "digest": {"sha256": "0" * 64},
    }

    class _StubClient:
        async def register_agent(self, *, artifact, blob):
            return {"registered_digest": manifest["digest"]["sha256"]}

    installer = AgentInstaller(agent_client=_StubClient())

    with pytest.raises(DigestMismatch):
        asyncio.run(
            installer.run(install_id="install-002", manifest=manifest, blob=blob)
        )

    assert not (quarantine.QUARANTINE / "install-002").exists()
    assert not (
        quarantine.INSTALLED / "agent" / manifest["id"] / manifest["version"]
    ).exists()


def test_agent_installer_hard_rule_14_rolls_back(quarantine_root):
    from mate_clients.marketplace.errors import DigestMismatch
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_agent import AgentInstaller

    blob = b"hard-rule-14-blob"
    manifest = {
        "id": "artifact-agent-003",
        "name": "wrong-digest",
        "version": "0.0.1",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }

    class _StubClient:
        async def register_agent(self, *, artifact, blob):
            return {"registered_digest": "deadbeef" * 8}

    installer = AgentInstaller(agent_client=_StubClient())

    with pytest.raises(DigestMismatch):
        asyncio.run(
            installer.run(install_id="install-003", manifest=manifest, blob=blob)
        )

    assert not (quarantine.QUARANTINE / "install-003").exists()


def test_agent_installer_real_client_returns_envelope(quarantine_root):
    import httpx

    from mate_clients.marketplace.agent import AgentMarketplaceClient
    from mate_platform.marketplace.jobs import quarantine
    from mate_platform.marketplace.jobs.installer_agent import AgentInstaller

    blob = b"real-client-blob"
    manifest = {
        "id": "artifact-agent-004",
        "name": "wired-up",
        "version": "2.0.0",
        "digest": {"sha256": hashlib.sha256(blob).hexdigest()},
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "agent_id": "agt-real",
                "name": manifest["name"],
                "registered_digest": manifest["digest"]["sha256"],
                "status": "registered",
            },
        )

    transport = httpx.MockTransport(handler)
    client = AgentMarketplaceClient(base_url="http://mate-tech-agent.test:8090")
    client._client = httpx.AsyncClient(transport=transport)

    installer = AgentInstaller(agent_client=client)
    result = asyncio.run(
        installer.run(install_id="install-004", manifest=manifest, blob=blob)
    )
    assert result["agent_id"] == "agt-real"
    assert result["registered_digest"] == manifest["digest"]["sha256"]
    assert (
        quarantine.INSTALLED / "agent" / manifest["id"] / manifest["version"] / "bundle.tar.gz"
    ).exists()
