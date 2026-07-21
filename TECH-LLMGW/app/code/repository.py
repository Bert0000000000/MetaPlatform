"""In-memory repositories for the code module (V12-02).

Production deployment can swap these for SQLAlchemy implementations the
same way the prompts module does; the in-memory version is sufficient
for Phase 2 / unit tests.
"""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional, Tuple

from app.code.schemas import (
    CodeShareRecord,
    CodeSnippetRecord,
    CodeSnippetVersionRecord,
    CodeTemplateRecord,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CodeTemplateRepository:
    """Thread-safe in-memory store for code templates (REQ-043)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._items: Dict[str, CodeTemplateRecord] = {}

    def insert(self, record: CodeTemplateRecord) -> CodeTemplateRecord:
        with self._lock:
            self._items[record.template_id] = record
            return record

    def get(self, template_id: str) -> Optional[CodeTemplateRecord]:
        with self._lock:
            return self._items.get(template_id)

    def list(
        self,
        tenant_id: str,
        *,
        language: Optional[str] = None,
        category: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[CodeTemplateRecord]:
        with self._lock:
            items = [t for t in self._items.values() if t.tenant_id == tenant_id]
        if language is not None:
            items = [t for t in items if t.language == language]
        if category is not None:
            items = [t for t in items if t.category == category]
        if keyword:
            kw = keyword.lower()
            items = [
                t
                for t in items
                if kw in t.name.lower()
                or (t.description and kw in t.description.lower())
            ]
        items.sort(key=lambda t: t.updated_at, reverse=True)
        return items

    def update(self, record: CodeTemplateRecord) -> CodeTemplateRecord:
        with self._lock:
            record.updated_at = _now()
            self._items[record.template_id] = record
            return record

    def remove(self, template_id: str) -> Optional[CodeTemplateRecord]:
        with self._lock:
            return self._items.pop(template_id, None)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


class CodeSnippetRepository:
    """Thread-safe in-memory store for snippets + version history (REQ-040/044)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._snippets: Dict[str, CodeSnippetRecord] = {}
        self._versions: Dict[Tuple[str, int], CodeSnippetVersionRecord] = {}

    def insert(
        self,
        record: CodeSnippetRecord,
        versions: List[CodeSnippetVersionRecord],
    ) -> CodeSnippetRecord:
        with self._lock:
            self._snippets[record.snippet_id] = record
            for v in versions:
                self._versions[(v.snippet_id, v.version)] = v
            return record

    def get(self, snippet_id: str) -> Optional[CodeSnippetRecord]:
        with self._lock:
            return self._snippets.get(snippet_id)

    def list(
        self,
        tenant_id: str,
        *,
        language: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[CodeSnippetRecord]:
        with self._lock:
            items = [s for s in self._snippets.values() if s.tenant_id == tenant_id]
        if language is not None:
            items = [s for s in items if s.language == language]
        if keyword:
            kw = keyword.lower()
            items = [
                s
                for s in items
                if kw in s.title.lower()
                or (s.description and kw in s.description.lower())
            ]
        items.sort(key=lambda s: s.updated_at, reverse=True)
        return items

    def update(self, record: CodeSnippetRecord) -> CodeSnippetRecord:
        with self._lock:
            record.updated_at = _now()
            self._snippets[record.snippet_id] = record
            return record

    def save_version(self, version: CodeSnippetVersionRecord) -> CodeSnippetVersionRecord:
        with self._lock:
            self._versions[(version.snippet_id, version.version)] = version
            return version

    def list_versions(self, snippet_id: str) -> List[CodeSnippetVersionRecord]:
        with self._lock:
            versions = [v for (sid, _), v in self._versions.items() if sid == snippet_id]
        versions.sort(key=lambda v: v.version, reverse=True)
        return versions

    def get_version(self, snippet_id: str, version: int) -> Optional[CodeSnippetVersionRecord]:
        with self._lock:
            return self._versions.get((snippet_id, version))

    def remove(self, snippet_id: str) -> Optional[CodeSnippetRecord]:
        with self._lock:
            record = self._snippets.pop(snippet_id, None)
            if record is None:
                return None
            keys_to_drop = [k for k in self._versions.keys() if k[0] == snippet_id]
            for key in keys_to_drop:
                del self._versions[key]
            return record

    def clear(self) -> None:
        with self._lock:
            self._snippets.clear()
            self._versions.clear()


class CodeShareRepository:
    """In-memory store for shareable code links (REQ-045)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._items: Dict[str, CodeShareRecord] = {}

    def insert(self, record: CodeShareRecord) -> CodeShareRecord:
        with self._lock:
            self._items[record.share_id] = record
            return record

    def get(self, share_id: str) -> Optional[CodeShareRecord]:
        with self._lock:
            return self._items.get(share_id)

    def list(self, tenant_id: str) -> List[CodeShareRecord]:
        with self._lock:
            items = [s for s in self._items.values() if s.tenant_id == tenant_id]
        items.sort(key=lambda s: s.created_at, reverse=True)
        return items

    def remove(self, share_id: str) -> Optional[CodeShareRecord]:
        with self._lock:
            return self._items.pop(share_id, None)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
