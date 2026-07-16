"""Tests for ChunkService (P1-RAG-03)."""

from __future__ import annotations

import pytest

from app.common.errors import DocumentNotFoundError
from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    DocumentStatus,
    EmbeddingStatus,
)
from app.services.chunk_service import ChunkService
from app.services.document_service import DocumentService
from app.services.knowledge_base_service import KnowledgeBaseService
from tests.conftest import MockFileStorage

TENANT = "tenant-test"


async def _setup_doc(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    filename: str = "test.txt",
    content: bytes = b"Hello, this is a test document for RAG.",
) -> str:
    """Create a KB and upload a document. Returns the document ID."""

    kb = await kb_service.create(TENANT, CreateKnowledgeBaseRequest(name="chunk-test-kb"))
    doc = await doc_service.upload(TENANT, kb.id, filename, content)
    return doc.id


# --------------------------------------------------------------- chunking


async def test_chunk_document_success(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
) -> None:
    """Chunking a .txt file creates chunks and updates document status."""

    doc_id = await _setup_doc(kb_service, doc_service)

    count = await chunk_service.chunk_document(doc_id, TENANT)

    assert count == 1
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].content == "Hello, this is a test document for RAG."
    assert chunks[0].embedding_status == EmbeddingStatus.PENDING
    assert chunks[0].token_count == len(chunks[0].content)

    # Document status should be updated.
    doc = await doc_service.get(TENANT, doc_id)
    assert doc.status == DocumentStatus.CHUNKED
    assert doc.chunk_count == 1


async def test_chunk_document_empty_file(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
) -> None:
    """Chunking an empty file produces zero chunks."""

    doc_id = await _setup_doc(kb_service, doc_service, content=b"")

    count = await chunk_service.chunk_document(doc_id, TENANT)

    assert count == 0
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    assert len(chunks) == 0

    doc = await doc_service.get(TENANT, doc_id)
    assert doc.status == DocumentStatus.CHUNKED
    assert doc.chunk_count == 0


async def test_chunk_document_large_with_overlap(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
) -> None:
    """A document longer than chunk_size produces multiple overlapping chunks."""

    # 2500 characters -> 3 chunks with 1000/100 overlap.
    text = "A" * 2500
    doc_id = await _setup_doc(
        kb_service, doc_service, content=text.encode("utf-8")
    )

    count = await chunk_service.chunk_document(doc_id, TENANT)

    assert count == 3
    chunks = await chunk_service.list_chunks(doc_id, TENANT)
    assert len(chunks) == 3
    # Chunk 0: chars 0..999
    assert len(chunks[0].content) == 1000
    # Chunk 1: chars 900..1899 (overlap 100)
    assert len(chunks[1].content) == 1000
    # Chunk 2: chars 1800..2499
    assert len(chunks[2].content) == 700

    # Verify overlap: end of chunk 0 == start of chunk 1 (100 chars).
    assert chunks[0].content[-100:] == chunks[1].content[:100]


async def test_chunk_document_not_found(
    chunk_service: ChunkService,
) -> None:
    """Chunking a non-existent document raises 40402."""

    with pytest.raises(DocumentNotFoundError) as exc_info:
        await chunk_service.chunk_document("doc-nonexistent", TENANT)

    assert int(exc_info.value.code) == 40402


async def test_list_chunks_after_chunking(
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
) -> None:
    """list_chunks returns chunks ordered by chunk_index."""

    text = "B" * 1500
    doc_id = await _setup_doc(
        kb_service, doc_service, content=text.encode("utf-8")
    )

    await chunk_service.chunk_document(doc_id, TENANT)
    chunks = await chunk_service.list_chunks(doc_id, TENANT)

    assert len(chunks) == 2
    assert chunks[0].chunk_index == 0
    assert chunks[1].chunk_index == 1
    # Each chunk should have content.
    assert len(chunks[0].content) == 1000
    assert len(chunks[1].content) == 600  # 1500 - (1000 - 100) = 600
