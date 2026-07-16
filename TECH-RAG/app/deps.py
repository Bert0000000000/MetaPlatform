"""Service registry & FastAPI dependencies for TECH-RAG.

The registry is a process-wide singleton. Tests use ``set_registry`` to
install an isolated registry (with mock storage) between cases.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Optional

from fastapi import Request

from app.models.repository import (
    DocumentChunkRepository,
    DocumentRepository,
    InMemoryDocumentChunkRepository,
    InMemoryDocumentRepository,
    InMemoryKnowledgeBaseRepository,
    KnowledgeBaseRepository,
)
from app.services.chunk_service import ChunkService
from app.services.document_service import DocumentService, FileStorage, LocalFileStorage
from app.services.embedding_service import EmbeddingService
from app.services.knowledge_base_service import KnowledgeBaseService
from app.services.retrieval_service import RetrievalService


@dataclass
class Registry:
    kb_repository: KnowledgeBaseRepository
    doc_repository: DocumentRepository
    chunk_repository: DocumentChunkRepository
    storage: FileStorage
    kb_service: KnowledgeBaseService
    doc_service: DocumentService
    chunk_service: ChunkService
    embedding_service: EmbeddingService
    retrieval_service: RetrievalService

    def reset(self) -> None:
        """Clear in-memory state."""
        if isinstance(self.kb_repository, InMemoryKnowledgeBaseRepository):
            self.kb_repository.clear()
        if isinstance(self.doc_repository, InMemoryDocumentRepository):
            self.doc_repository.clear()
        if isinstance(self.chunk_repository, InMemoryDocumentChunkRepository):
            self.chunk_repository.clear()


_LOCK = RLock()
_REGISTRY: Optional[Registry] = None


def _build_default_registry() -> Registry:
    kb_repo = InMemoryKnowledgeBaseRepository()
    doc_repo = InMemoryDocumentRepository()
    chunk_repo = InMemoryDocumentChunkRepository()
    storage = LocalFileStorage()
    kb_service = KnowledgeBaseService(kb_repo, doc_repo)
    doc_service = DocumentService(doc_repo, kb_repo, storage=storage)
    chunk_service = ChunkService(chunk_repo, doc_repo, storage)
    embedding_service = EmbeddingService(chunk_repo, doc_repo)
    retrieval_service = RetrievalService(chunk_repo, doc_repo)
    return Registry(
        kb_repository=kb_repo,
        doc_repository=doc_repo,
        chunk_repository=chunk_repo,
        storage=storage,
        kb_service=kb_service,
        doc_service=doc_service,
        chunk_service=chunk_service,
        embedding_service=embedding_service,
        retrieval_service=retrieval_service,
    )


def get_registry() -> Registry:
    global _REGISTRY
    with _LOCK:
        if _REGISTRY is None:
            _REGISTRY = _build_default_registry()
        return _REGISTRY


def set_registry(registry: Optional[Registry]) -> None:
    """Test helper: install or clear the process-wide registry."""

    global _REGISTRY
    with _LOCK:
        _REGISTRY = registry


# -------------------------------------------------------------- FastAPI deps


def get_kb_service(request: Request) -> KnowledgeBaseService:
    return request.app.state.registry.kb_service


def get_doc_service(request: Request) -> DocumentService:
    return request.app.state.registry.doc_service


def get_chunk_service(request: Request) -> ChunkService:
    return request.app.state.registry.chunk_service


def get_embedding_service(request: Request) -> EmbeddingService:
    return request.app.state.registry.embedding_service


def get_retrieval_service(request: Request) -> RetrievalService:
    return request.app.state.registry.retrieval_service
