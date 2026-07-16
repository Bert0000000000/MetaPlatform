"""Tests for DocumentService (P1-RAG-02)."""

from __future__ import annotations

import pytest

from app.common.errors import (
    DocumentNotFoundError,
    KnowledgeBaseNotFoundError,
    UnsupportedFileTypeError,
)
from app.models.schemas import CreateKnowledgeBaseRequest
from app.services.document_service import DocumentService
from app.services.knowledge_base_service import KnowledgeBaseService
from tests.conftest import MockFileStorage

TENANT = "tenant-test"


async def _create_kb(kb_service: KnowledgeBaseService) -> str:
    kb = await kb_service.create(
        TENANT, CreateKnowledgeBaseRequest(name="doc-test-kb")
    )
    return kb.id


# ----------------------------------------------------------------- upload


async def test_upload_document_success(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    mock_storage: MockFileStorage,
) -> None:
    """Uploading a valid .txt file succeeds and writes to mock storage."""

    kb_id = await _create_kb(kb_service)

    content = b"Hello, this is a test document for RAG."
    doc = await doc_service.upload(
        TENANT,
        kb_id,
        "test.txt",
        content,
        metadata={"source": "test"},
    )

    assert doc.id.startswith("doc-")
    assert doc.tenant_id == TENANT
    assert doc.kb_id == kb_id
    assert doc.filename == "test.txt"
    assert doc.file_size == len(content)
    assert doc.file_type == "TEXT"
    assert doc.status == "UPLOADED"
    assert doc.chunk_count == 0
    assert doc.metadata == {"source": "test"}

    # File was saved to mock storage.
    assert len(mock_storage._save_calls) == 1
    assert mock_storage._save_calls[0]["filename"] == "test.txt"
    assert mock_storage._save_calls[0]["size"] == len(content)

    # KB doc_count was incremented.
    kb = await kb_service.get(TENANT, kb_id)
    assert kb.doc_count == 1


async def test_upload_document_unsupported_file_type(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
) -> None:
    """Uploading an unsupported file type (.exe) raises 40005."""

    kb_id = await _create_kb(kb_service)

    with pytest.raises(UnsupportedFileTypeError) as exc_info:
        await doc_service.upload(
            TENANT,
            kb_id,
            "malicious.exe",
            b"binary content",
        )

    assert int(exc_info.value.code) == 40005
    assert exc_info.value.http_status == 400


async def test_upload_document_kb_not_found(
    doc_service: DocumentService,
) -> None:
    """Uploading to a non-existent knowledge base raises 40401."""

    with pytest.raises(KnowledgeBaseNotFoundError) as exc_info:
        await doc_service.upload(
            TENANT,
            "kb-nonexistent",
            "test.txt",
            b"content",
        )

    assert int(exc_info.value.code) == 40401


# ------------------------------------------------------------------- list


async def test_list_documents(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
) -> None:
    """Listing documents returns paginated results."""

    kb_id = await _create_kb(kb_service)

    # Upload 3 documents.
    for i in range(3):
        await doc_service.upload(
            TENANT,
            kb_id,
            f"doc-{i}.md",
            f"# Document {i}".encode(),
        )

    items, total = await doc_service.list(TENANT, kb_id)

    assert total == 3
    assert len(items) == 3
    filenames = [d.filename for d in items]
    assert "doc-0.md" in filenames
    assert "doc-1.md" in filenames
    assert "doc-2.md" in filenames


# ---------------------------------------------------------------- delete


async def test_delete_document(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    mock_storage: MockFileStorage,
) -> None:
    """Deleting a document removes the file and metadata, decrements KB count."""

    kb_id = await _create_kb(kb_service)

    doc = await doc_service.upload(
        TENANT,
        kb_id,
        "delete-me.txt",
        b"to be deleted",
    )

    # Verify it exists.
    kb = await kb_service.get(TENANT, kb_id)
    assert kb.doc_count == 1

    result = await doc_service.delete(TENANT, doc.id)

    assert result["deleted"] is True
    assert result["fileDeleted"] is True
    assert result["kbId"] == kb_id

    # KB doc_count was decremented.
    kb = await kb_service.get(TENANT, kb_id)
    assert kb.doc_count == 0

    # Document no longer exists.
    with pytest.raises(DocumentNotFoundError):
        await doc_service.get(TENANT, doc.id)

    # Storage delete was called.
    assert len(mock_storage._delete_calls) == 1


async def test_delete_document_not_found(
    doc_service: DocumentService,
) -> None:
    """Deleting a non-existent document raises 40402."""

    with pytest.raises(DocumentNotFoundError) as exc_info:
        await doc_service.delete(TENANT, "doc-nonexistent")

    assert int(exc_info.value.code) == 40402
