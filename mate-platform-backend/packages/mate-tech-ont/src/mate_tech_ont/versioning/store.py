"""版本管理 (ST-5.4.8).

同 ontology_id 多个 version 隔离。
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Version:
    """本体版本."""

    ontology_id: str
    version: str  # e.g. "v1.0.0", "v1.1.0-rc.1"
    parent: str | None = None  # 父版本
    created_at: float = field(default_factory=lambda: time.time())
    metadata: dict[str, str] = field(default_factory=dict)


class VersionStore:
    """版本存储."""

    def __init__(self) -> None:
        # key: (ontology_id, version)
        self._versions: dict[tuple[str, str], Version] = {}

    def create(
        self,
        ontology_id: str,
        version: str,
        *,
        parent: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> Version:
        key = (ontology_id, version)
        if key in self._versions:
            raise ValueError(f"Version '{version}' for ontology '{ontology_id}' exists")
        v = Version(
            ontology_id=ontology_id,
            version=version,
            parent=parent,
            metadata=metadata or {},
        )
        self._versions[key] = v
        logger.info("version.created", ontology=ontology_id, version=version, parent=parent)
        return v

    def get(self, ontology_id: str, version: str) -> Version | None:
        return self._versions.get((ontology_id, version))

    def list_for_ontology(self, ontology_id: str) -> list[Version]:
        return [v for (oid, _), v in self._versions.items() if oid == ontology_id]

    def list_all(self) -> list[Version]:
        return list(self._versions.values())

    def delete(self, ontology_id: str, version: str) -> bool:
        key = (ontology_id, version)
        if key not in self._versions:
            return False
        del self._versions[key]
        return True


# 全局单例
version_store = VersionStore()