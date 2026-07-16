"""Document upload & management service (P1-RAG-02).

Handles file upload (local storage), list, get, delete. File type and size
validation is enforced here. The actual file writing is delegated to an
injectable ``FileStorage`` abstraction so tests can mock it.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional, Protocol

from app.common.errors import (
    DocumentNotFoundError,
    FileTooLargeError,
    KnowledgeBaseNotFoundError,
    UnsupportedFileTypeError,
)
from app.config import settings
from app.models.repository import (
    DocumentRepository,
    KnowledgeBaseRepository,
    _new_doc_id,
)
from app.models.schemas import (
    Document,
    DocumentStatus,
)


# Supported file extensions -> file type label.
SUPPORTED_FILE_TYPES: dict[str, str] = {
    ".txt": "TEXT",
    ".pdf": "PDF",
    ".docx": "WORD",
    ".md": "MARKDOWN",
}


class FileStorage(Protocol):
    """Abstract file storage interface."""

    async def save(self, tenant_id: str, kb_id: str, doc_id: str, filename: str, content: bytes) -> str:
        """Persist file content and return the storage path."""
        ...

    async def read(self, storage_path: str) -> bytes:
        """Read file content from storage and return raw bytes."""
        ...

    async def delete(self, storage_path: str) -> bool:
        """Remove a previously stored file. Returns True if a file was removed."""
        ...


class LocalFileStorage:
    """Default file storage that writes to the local ``storage_root`` directory."""

    def __init__(self, storage_root: str | None = None) -> None:
        self._root = storage_root or settings.storage_root

    async def save(
        self, tenant_id: str, kb_id: str, doc_id: str, filename: str, content: bytes
    ) -> str:
        dir_path = os.path.join(self._root, tenant_id, kb_id, doc_id)
        os.makedirs(dir_path, exist_ok=True)
        file_path = os.path.join(dir_path, filename)
        with open(file_path, "wb") as f:
            f.write(content)
        return file_path

    async def read(self, storage_path: str) -> bytes:
        with open(storage_path, "rb") as f:
            return f.read()

    async def delete(self, storage_path: str) -> bool:
        try:
            if os.path.exists(storage_path):
                os.remove(storage_path)
                # Try to remove empty parent dirs (best effort).
                parent = os.path.dirname(storage_path)
                for _ in range(3):
                    try:
                        os.rmdir(parent)
                        parent = os.path.dirname(parent)
                    except OSError:
                        break
                return True
            return False
        except OSError:
            return False


class DocumentService:
    def __init__(
        self,
        doc_repository: DocumentRepository,
        kb_repository: KnowledgeBaseRepository,
        storage: Optional[FileStorage] = None,
    ) -> None:
        self._doc_repo = doc_repository
        self._kb_repo = kb_repository
        self._storage = storage or LocalFileStorage()

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _get_file_extension(filename: str) -> str:
        _, ext = os.path.splitext(filename)
        return ext.lower()

    @staticmethod
    def _resolve_file_type(filename: str) -> str:
        ext = DocumentService._get_file_extension(filename)
        file_type = SUPPORTED_FILE_TYPES.get(ext)
        if file_type is None:
            raise UnsupportedFileTypeError(
                f"不支持的文件类型: {filename}",
                data={
                    "filename": filename,
                    "supportedExtensions": list(SUPPORTED_FILE_TYPES.keys()),
                },
            )
        return file_type

    # ----------------------------------------------------------------- upload

    async def upload(
        self,
        tenant_id: str,
        kb_id: str,
        filename: str,
        content: bytes,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Document:
        # Verify KB exists and belongs to tenant.
        kb = await self._kb_repo.get(kb_id, tenant_id)
        if kb is None:
            raise KnowledgeBaseNotFoundError(
                f"知识库不存在: id={kb_id}",
                data={"id": kb_id},
            )

        # Validate file size.
        if len(content) > settings.max_upload_size:
            raise FileTooLargeError(
                f"文件大小超过限制: {len(content)} > {settings.max_upload_size}",
                data={
                    "fileSize": len(content),
                    "maxSize": settings.max_upload_size,
                },
            )

        # Validate file type.
        file_type = self._resolve_file_type(filename)

        # Generate doc id and persist file.
        doc_id = _new_doc_id()
        storage_path = await self._storage.save(
            tenant_id, kb_id, doc_id, filename, content
        )

        # Persist metadata record.
        doc = Document(
            id=doc_id,
            tenant_id=tenant_id,
            kb_id=kb_id,
            filename=filename,
            file_size=len(content),
            file_type=file_type,
            storage_path=storage_path,
            status=DocumentStatus.UPLOADED,
            chunk_count=0,
            metadata=metadata or {},
        )
        doc = await self._doc_repo.create(doc)

        # Increment KB doc_count.
        await self._kb_repo.increment_doc_count(kb_id, tenant_id, 1)

        return doc

    # ------------------------------------------------------------------- list

    async def list(
        self,
        tenant_id: str,
        kb_id: str,
        *,
        status: Optional[DocumentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Document], int]:
        return await self._doc_repo.list(
            tenant_id,
            kb_id,
            status=status,
            page=page,
            page_size=page_size,
        )

    # ------------------------------------------------------------------- get

    async def get(self, tenant_id: str, doc_id: str) -> Document:
        doc = await self._doc_repo.get(doc_id, tenant_id)
        if doc is None:
            raise DocumentNotFoundError(
                f"文档不存在: id={doc_id}",
                data={"id": doc_id},
            )
        return doc

    # ---------------------------------------------------------------- delete

    async def delete(self, tenant_id: str, doc_id: str) -> dict[str, Any]:
        doc = await self.get(tenant_id, doc_id)
        # Remove file from storage.
        file_deleted = await self._storage.delete(doc.storage_path)
        # Remove metadata record.
        await self._doc_repo.delete(doc_id, tenant_id)
        # Decrement KB doc_count.
        await self._kb_repo.increment_doc_count(doc.kb_id, tenant_id, -1)
        return {
            "id": doc_id,
            "kbId": doc.kb_id,
            "deleted": True,
            "fileDeleted": file_deleted,
        }

    # ----------------------------------------------------- metadata parsing

    @staticmethod
    def parse_metadata_json(raw: Optional[str]) -> dict[str, Any]:
        """Parse a metadata JSON string from multipart form data."""
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise UnsupportedFileTypeError(
                    "metadata 必须是 JSON 对象",
                )
            return parsed
        except json.JSONDecodeError as exc:
            raise UnsupportedFileTypeError(
                f"metadata JSON 解析失败: {exc}",
            ) from exc
