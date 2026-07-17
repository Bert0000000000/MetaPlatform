"""In-memory prompt template repository."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional

from app.prompts.schemas import PromptRecord, PromptVersionRecord


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PromptRepository:
    """Thread-safe in-memory replacement for llmgw_prompts + llmgw_prompt_versions."""

    def __init__(self) -> None:
        self._lock = RLock()
        # prompt_id -> latest PromptRecord
        self._prompts: Dict[str, PromptRecord] = {}
        # (prompt_id, version) -> PromptVersionRecord
        self._versions: Dict[tuple[str, int], PromptVersionRecord] = {}
        # (tenant_id, prompt_key) -> prompt_id
        self._key_index: Dict[tuple[str, str], str] = {}

    # ------------------------------------------------------------------ CRUD

    def insert(
        self,
        record: PromptRecord,
        versions: List[PromptVersionRecord],
    ) -> PromptRecord:
        with self._lock:
            self._prompts[record.prompt_id] = record
            self._key_index[(record.tenant_id, record.prompt_key)] = record.prompt_id
            for v in versions:
                self._versions[(v.prompt_id, v.version)] = v
            return record

    def get(self, prompt_id: str) -> Optional[PromptRecord]:
        with self._lock:
            return self._prompts.get(prompt_id)

    def get_by_key(self, tenant_id: str, prompt_key: str) -> Optional[PromptRecord]:
        with self._lock:
            prompt_id = self._key_index.get((tenant_id, prompt_key))
            if prompt_id is None:
                return None
            return self._prompts.get(prompt_id)

    def update(self, record: PromptRecord) -> PromptRecord:
        with self._lock:
            record.updated_at = _now()
            self._prompts[record.prompt_id] = record
            return record

    def save_version(self, version: PromptVersionRecord) -> PromptVersionRecord:
        with self._lock:
            self._versions[(version.prompt_id, version.version)] = version
            return version

    def remove(self, prompt_id: str) -> Optional[PromptRecord]:
        with self._lock:
            record = self._prompts.pop(prompt_id, None)
            if record is None:
                return None
            self._key_index.pop((record.tenant_id, record.prompt_key), None)
            # Cascade delete versions.
            keys_to_drop = [
                key for key in self._versions.keys() if key[0] == prompt_id
            ]
            for key in keys_to_drop:
                del self._versions[key]
            return record

    def list(
        self,
        tenant_id: str,
        *,
        keyword: Optional[str] = None,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[PromptRecord]:
        with self._lock:
            results = [
                p
                for p in self._prompts.values()
                if p.tenant_id == tenant_id
                and (category is None or p.category == category)
                and (status is None or p.status.value == status)
                and (tags is None or any(t in p.tags for t in tags))
            ]
        if keyword:
            keyword_lower = keyword.lower()
            results = [
                p
                for p in results
                if (p.name and keyword_lower in p.name.lower())
                or (p.description and keyword_lower in p.description.lower())
                or (p.prompt_key and keyword_lower in p.prompt_key.lower())
            ]
        results.sort(key=lambda p: p.updated_at, reverse=True)
        return results

    def list_versions(self, prompt_id: str) -> List[PromptVersionRecord]:
        with self._lock:
            versions = [
                v for (pid, _), v in self._versions.items() if pid == prompt_id
            ]
        versions.sort(key=lambda v: v.version, reverse=True)
        return versions

    def get_version(self, prompt_id: str, version: int) -> Optional[PromptVersionRecord]:
        with self._lock:
            return self._versions.get((prompt_id, version))

    def key_exists(self, tenant_id: str, prompt_key: str) -> bool:
        with self._lock:
            return (tenant_id, prompt_key) in self._key_index

    def clear(self) -> None:
        with self._lock:
            self._prompts.clear()
            self._versions.clear()
            self._key_index.clear()
