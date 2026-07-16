"""Shared pytest fixtures for TECH-RAG tests.

Every test gets a fresh in-memory registry with a mock file storage so no
real database connection or disk I/O is ever required.
"""

from __future__ import annotations

from typing import Optional

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.router import router as v1_router
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.deps import Registry
from app.models.repository import (
    InMemoryDocumentChunkRepository,
    InMemoryDocumentRepository,
    InMemoryKnowledgeBaseRepository,
)
from app.services.chunk_service import ChunkService
from app.services.document_service import DocumentService, FileStorage
from app.services.embedding_service import EmbeddingService
from app.services.knowledge_base_service import KnowledgeBaseService
from app.services.retrieval_service import RetrievalService

TENANT_ID = "tenant-test"
TRACE_ID = "test-trace-001"


# ----------------------------------------------------------- mock file storage


class MockFileStorage:
    """In-memory file storage that records saved files without touching disk."""

    def __init__(self) -> None:
        self._files: dict[str, bytes] = {}
        self._save_calls: list[dict] = []
        self._delete_calls: list[str] = []

    async def save(
        self,
        tenant_id: str,
        kb_id: str,
        doc_id: str,
        filename: str,
        content: bytes,
    ) -> str:
        path = f"/mock-storage/{tenant_id}/{kb_id}/{doc_id}/{filename}"
        self._files[path] = content
        self._save_calls.append(
            {
                "tenant_id": tenant_id,
                "kb_id": kb_id,
                "doc_id": doc_id,
                "filename": filename,
                "size": len(content),
                "path": path,
            }
        )
        return path

    async def read(self, storage_path: str) -> bytes:
        return self._files.get(storage_path, b"")

    async def delete(self, storage_path: str) -> bool:
        self._delete_calls.append(storage_path)
        return self._files.pop(storage_path, None) is not None

    @property
    def saved_files(self) -> dict[str, bytes]:
        return self._files

    def clear(self) -> None:
        self._files.clear()
        self._save_calls.clear()
        self._delete_calls.clear()


# --------------------------------------------------------------- core fixtures


@pytest.fixture
def mock_kb_repository() -> InMemoryKnowledgeBaseRepository:
    return InMemoryKnowledgeBaseRepository()


@pytest.fixture
def mock_doc_repository() -> InMemoryDocumentRepository:
    return InMemoryDocumentRepository()


@pytest.fixture
def mock_chunk_repository() -> InMemoryDocumentChunkRepository:
    return InMemoryDocumentChunkRepository()


@pytest.fixture
def mock_storage() -> MockFileStorage:
    return MockFileStorage()


@pytest.fixture
def kb_service(
    mock_kb_repository: InMemoryKnowledgeBaseRepository,
    mock_doc_repository: InMemoryDocumentRepository,
) -> KnowledgeBaseService:
    return KnowledgeBaseService(mock_kb_repository, mock_doc_repository)


@pytest.fixture
def doc_service(
    mock_doc_repository: InMemoryDocumentRepository,
    mock_kb_repository: InMemoryKnowledgeBaseRepository,
    mock_storage: MockFileStorage,
) -> DocumentService:
    return DocumentService(
        mock_doc_repository, mock_kb_repository, storage=mock_storage
    )


@pytest.fixture
def chunk_service(
    mock_chunk_repository: InMemoryDocumentChunkRepository,
    mock_doc_repository: InMemoryDocumentRepository,
    mock_storage: MockFileStorage,
) -> ChunkService:
    return ChunkService(mock_chunk_repository, mock_doc_repository, mock_storage)


@pytest.fixture
def embedding_service(
    mock_chunk_repository: InMemoryDocumentChunkRepository,
    mock_doc_repository: InMemoryDocumentRepository,
) -> EmbeddingService:
    return EmbeddingService(mock_chunk_repository, mock_doc_repository)


@pytest.fixture
def retrieval_service(
    mock_chunk_repository: InMemoryDocumentChunkRepository,
    mock_doc_repository: InMemoryDocumentRepository,
) -> RetrievalService:
    return RetrievalService(mock_chunk_repository, mock_doc_repository)


@pytest.fixture
def registry(
    mock_kb_repository: InMemoryKnowledgeBaseRepository,
    mock_doc_repository: InMemoryDocumentRepository,
    mock_chunk_repository: InMemoryDocumentChunkRepository,
    mock_storage: MockFileStorage,
    kb_service: KnowledgeBaseService,
    doc_service: DocumentService,
    chunk_service: ChunkService,
    embedding_service: EmbeddingService,
    retrieval_service: RetrievalService,
) -> Registry:
    return Registry(
        kb_repository=mock_kb_repository,
        doc_repository=mock_doc_repository,
        chunk_repository=mock_chunk_repository,
        storage=mock_storage,
        kb_service=kb_service,
        doc_service=doc_service,
        chunk_service=chunk_service,
        embedding_service=embedding_service,
        retrieval_service=retrieval_service,
    )


# --------------------------------------------------------------- FastAPI app


@pytest.fixture
def app(registry: Registry) -> FastAPI:
    application = FastAPI(title="TECH-RAG-Test")
    install_trace_id_middleware(application)
    install_exception_handlers(application)
    application.state.registry = registry
    application.include_router(v1_router)

    @application.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "UP"}

    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def tenant_headers() -> dict[str, str]:
    """Standard request headers used by controller tests."""
    return {
        "X-Tenant-Id": TENANT_ID,
        "X-Trace-Id": TRACE_ID,
    }
