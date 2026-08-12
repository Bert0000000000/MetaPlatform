"""marketplace orchestrator state machine(SPEC §5.3)。

状态:DOWNLOADING → VERIFYING → INSTALLED / FAILED / UNINSTALLED

步骤:
  1. license check(仅 paid 资产)
  2. fetch manifest(再拉一次以 honor freshness)
  3. version check
  4. fetch blob + verify digest
  5. dispatch by kind(MCP / Agent / Ontology)
  6. write instance(硬规则 #14 已在 installer 内校验)
  7. transition → INSTALLED
"""
from __future__ import annotations

import enum
import logging
import uuid
from typing import Any, Awaitable, Callable

from packaging.version import InvalidVersion, Version

from mate_clients.marketplace.errors import (
    DigestMismatch,
    IncompatiblePlatform,
    KindNotAllowed,
    LicenseExpired,
)

log = logging.getLogger(__name__)


class InstallState(str, enum.Enum):
    DOWNLOADING = "downloading"
    VERIFYING = "verifying"
    INSTALLED = "installed"
    FAILED = "failed"
    UNINSTALLED = "uninstalled"


def _compare_versions(a: str, b: str) -> int:
    try:
        return int(Version(a) >= Version(b))
    except InvalidVersion:
        # semver 比较失败时按字符串比较,避免崩
        return 1 if a >= b else -1


class Orchestrator:
    """§5.3 状态机:license_check → fetch_manifest → version_check
    → fetch_blob+verify_digest → dispatch by kind
    → write marketplace_instance(硬规则 #14) → state=installed"""

    def __init__(
        self,
        *,
        mp_client: Any,
        oci_pull: Callable[..., Awaitable[bytes]],
        instances_repo: Any,
        installs_repo: Any,
        platform_version: str = "3.0.0",
        pubsub: Any = None,
    ) -> None:
        self.mp_client = mp_client
        self.oci_pull = oci_pull
        self.instances_repo = instances_repo
        self.installs_repo = installs_repo
        self.platform_version = platform_version
        self.pubsub = pubsub

    async def _transition(
        self,
        install_id: uuid.UUID,
        state: InstallState,
        *,
        failure_reason: str | None = None,
    ) -> None:
        await self.installs_repo.transition(
            install_id=install_id,
            state=state,
            failure_reason=failure_reason,
        )
        if self.pubsub is not None:
            try:
                self.pubsub.publish(  # may be sync or async
                    f"marketplace.install.{install_id}.events",
                    {
                        "install_id": str(install_id),
                        "state": state.value,
                        "failure_reason": failure_reason,
                    },
                )
            except Exception:  # pubsub 失败不阻塞主流程
                log.warning("publish event failed", exc_info=True)

    async def run(
        self, *, install_id: uuid.UUID, artifact: dict
    ) -> dict:
        # 1. license check(仅 paid 资产)
        if artifact.get("license", {}).get("tier") == "paid":
            lic = await self.mp_client.check_license(
                sku=artifact["license"]["sku"],
                license_key=artifact.get("license_key", ""),
                instance_fingerprint=install_id.hex,
            )
            if not lic.get("valid"):
                await self._transition(
                    install_id,
                    InstallState.FAILED,
                    failure_reason=f"license invalid: {lic}",
                )
                raise LicenseExpired(f"license invalid: {lic}")

        # 2. fetch manifest
        manifest = await self.mp_client.get_artifact(
            kind=artifact["kind"], artifact_id=artifact["id"]
        )

        # 3. version check
        min_v = (
            manifest.get("requirements", {}).get(
                "minPlatformVersion", "0.0.0"
            )
        )
        if _compare_versions(self.platform_version, min_v) < 1:
            await self._transition(
                install_id,
                InstallState.FAILED,
                failure_reason=(
                    f"need platform {min_v}, have {self.platform_version}"
                ),
            )
            raise IncompatiblePlatform(
                f"need {min_v}, have {self.platform_version}"
            )

        # 4. fetch blob + verify digest(OCIPuller 内部已 verify)
        await self._transition(install_id, InstallState.DOWNLOADING)
        try:
            blob = await self.oci_pull(
                kind=manifest["kind"],
                artifact_id=manifest["id"],
                digest=manifest["digest"]["sha256"],
            )
        except DigestMismatch as e:
            await self._transition(
                install_id,
                InstallState.FAILED,
                failure_reason=f"digest mismatch: {e}",
            )
            raise

        await self._transition(install_id, InstallState.VERIFYING)

        # 5. dispatch by kind
        kind = manifest["kind"]
        try:
            if kind == "mcp":
                from .installer_mcp import McpInstaller

                result = await McpInstaller(self.mp_client.mcp).run(
                    install_id=install_id, manifest=manifest, blob=blob
                )
            elif kind == "agent":
                from .installer_agent import AgentInstaller

                result = await AgentInstaller(self.mp_client.agent).run(
                    install_id=install_id, manifest=manifest, blob=blob
                )
            elif kind == "ontology":
                from .installer_ontology import OntologyInstaller

                result = await OntologyInstaller(
                    self.mp_client.ont
                ).run(
                    install_id=install_id, manifest=manifest, blob=blob
                )
            elif kind == "skill":
                from .installer_skill import SkillInstaller

                result = await SkillInstaller(
                    self.mp_client.skill
                ).run(
                    install_id=install_id, manifest=manifest, blob=blob
                )
            else:
                raise KindNotAllowed(f"unknown kind {kind}")
        except (DigestMismatch, KindNotAllowed) as e:
            await self._transition(
                install_id,
                InstallState.FAILED,
                failure_reason=f"{type(e).__name__}: {e}",
            )
            raise

        # 6. write instance(硬规则 #14 已在 installer.run 内校验)
        await self.instances_repo.add(
            install_id=install_id,
            kind=kind,
            instance_uid=result["instance_uid"],
            registered_digest=result["registered_digest"],
        )
        # 7. INSTALLED
        await self._transition(install_id, InstallState.INSTALLED)
        return result