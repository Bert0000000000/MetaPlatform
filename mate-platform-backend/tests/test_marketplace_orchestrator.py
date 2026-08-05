"""marketplace orchestrator state machine tests.

§5.3:license_check → fetch_manifest → version_check → fetch_blob+verify_digest
     → dispatch by kind → write instance (硬规则 #14) → state=installed。
"""
from __future__ import annotations

import hashlib
import io
import tarfile
import uuid
from unittest.mock import AsyncMock

import pytest

from mate_platform.marketplace.jobs.orchestrator import (
    InstallState,
    Orchestrator,
)


def _bundle() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        info = tarfile.TarInfo("manifest.json")
        info.size = 5
        tf.addfile(info, io.BytesIO(b"hello"))
    return buf.getvalue()


@pytest.mark.asyncio
async def test_happy_path_mcp():
    """happy path:license free → manifest ok → version ok → mcp 注册 → installed。"""
    bundle = _bundle()
    digest = hashlib.sha256(bundle).hexdigest()
    artifact_id = str(uuid.uuid4())
    manifest = {
        "schemaVersion": "mate.marketplace/v1",
        "kind": "mcp",
        "id": artifact_id,
        "name": "t",
        "version": "1.0.0",
        "digest": {"sha256": digest},
        "blobs": [],
        "requirements": {"minPlatformVersion": "3.0.0"},
    }

    mp_client = AsyncMock()
    mp_client.get_artifact = AsyncMock(return_value=manifest)

    oci_pull = AsyncMock(return_value=bundle)

    mcp_client = AsyncMock()
    mcp_client.register_server = AsyncMock(
        return_value={
            "instance_uid": "mcp-srv-1",
            "registered_digest": digest,
        }
    )
    mp_client.mcp = mcp_client

    instances_repo = AsyncMock()
    installs_repo = AsyncMock()

    orch = Orchestrator(
        mp_client=mp_client,
        oci_pull=oci_pull,
        instances_repo=instances_repo,
        installs_repo=installs_repo,
        platform_version="3.0.0",
    )
    await orch.run(install_id=uuid.uuid4(), artifact=manifest)

    # 至少 transition 到 INSTALLED 一次
    calls = installs_repo.transition.call_args_list
    assert any(
        call.kwargs.get("state") == InstallState.INSTALLED
        or (call.args and call.args[1] == InstallState.INSTALLED)
        for call in calls
    )
    instances_repo.add.assert_awaited_once()


@pytest.mark.asyncio
async def test_digest_mismatch_marks_failed():
    """digest mismatch → state FAILED + failure_reason。"""
    bundle = _bundle()
    artifact_id = str(uuid.uuid4())
    manifest = {
        "schemaVersion": "mate.marketplace/v1",
        "kind": "mcp",
        "id": artifact_id,
        "name": "t",
        "version": "1.0.0",
        "digest": {"sha256": "0" * 64},
        "blobs": [],
    }

    mp_client = AsyncMock()
    mp_client.get_artifact = AsyncMock(return_value=manifest)
    oci_pull = AsyncMock(return_value=bundle)
    mp_client.mcp = AsyncMock()

    instances_repo = AsyncMock()
    installs_repo = AsyncMock()

    orch = Orchestrator(
        mp_client=mp_client,
        oci_pull=oci_pull,
        instances_repo=instances_repo,
        installs_repo=installs_repo,
        platform_version="3.0.0",
    )

    with pytest.raises(Exception):
        await orch.run(install_id=uuid.uuid4(), artifact=manifest)

    calls = installs_repo.transition.call_args_list
    assert any(
        call.kwargs.get("state") == InstallState.FAILED
        or (call.args and call.args[1] == InstallState.FAILED)
        for call in calls
    )
    # failure_reason 是 str
    assert any(
        isinstance(call.kwargs.get("failure_reason"), str)
        for call in calls
    )