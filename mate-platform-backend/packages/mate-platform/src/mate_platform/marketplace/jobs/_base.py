"""installer 共享逻辑 — digest verify + quarantine + 硬规则 #14 校验。"""
from __future__ import annotations

import hashlib
from typing import Any, Awaitable, Callable

from mate_clients.marketplace.errors import DigestMismatch

from . import quarantine


class BaseInstaller:
    """3 类 installer 共用:digest verify + quarantine store/commit + 硬规则 #14。"""

    kind: str = ""
    # 子类覆盖:register_method_name + client_callable
    register_method: str = ""

    def __init__(self, client: Any = None, **kwargs: Any) -> None:
        # 兼容 kind-specific kw:McpInstaller(mcp_client=...),
        # AgentInstaller(agent_client=...), OntologyInstaller(ontology_client=...)
        if client is None:
            for v in kwargs.values():
                client = v
                break
        self.client = client

    async def run(
        self,
        *,
        install_id: Any,
        manifest: dict,
        blob: bytes,
    ) -> dict:
        expected = manifest["digest"]["sha256"]
        actual = hashlib.sha256(blob).hexdigest()
        if actual != expected:
            raise DigestMismatch(
                f"expected {expected}, got {actual}"
            )

        quarantine.store(
            str(install_id),
            blob,
            kind=self.kind,
            artifact_id=manifest["id"],
            version=manifest["version"],
        )
        try:
            register_fn: Callable[..., Awaitable[dict]] = getattr(
                self.client, self.register_method
            )
            result = await register_fn(artifact=manifest, blob=blob)
        except Exception:
            quarantine.rollback(str(install_id))
            raise

        # 硬规则 #14:registered_digest 必须 == manifest.digest
        if result.get("registered_digest") != expected:
            quarantine.rollback(str(install_id))
            raise DigestMismatch(
                "硬规则 #14:registered_digest 与 manifest.digest 不一致"
            )

        quarantine.commit(
            str(install_id),
            kind=self.kind,
            artifact_id=manifest["id"],
            version=manifest["version"],
        )
        return result