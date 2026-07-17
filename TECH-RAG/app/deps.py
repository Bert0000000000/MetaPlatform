"""Service registry & FastAPI dependencies for TECH-RAG.

The registry is a process-wide singleton. Tests use ``set_registry`` to
install an isolated registry (with mock storage) between cases.
"""

from __future__ import annotations

import logging
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
    InMemorySearchEventRepository,
    KnowledgeBaseRepository,
    SearchEventRepository,
)
from app.services.chunk_service import ChunkService
from app.services.context_assembly_service import ContextAssemblyService
from app.services.citation_service import CitationService
from app.services.document_service import DocumentService, FileStorage, LocalFileStorage
from app.services.embedding_service import EmbeddingService
from app.services.event_service import EventService
from app.services.graph_enhanced_service import GraphEnhancedService
from app.services.hybrid_search_service import HybridSearchService
from app.services.keyword_search_service import KeywordSearchService
from app.services.knowledge_base_service import KnowledgeBaseService
from app.services.rerank_service import RerankService
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger("techrag")


@dataclass
class Registry:
    kb_repository: KnowledgeBaseRepository
    doc_repository: DocumentRepository
    chunk_repository: DocumentChunkRepository
    event_repository: SearchEventRepository
    storage: FileStorage
    kb_service: KnowledgeBaseService
    doc_service: DocumentService
    chunk_service: ChunkService
    embedding_service: EmbeddingService
    retrieval_service: RetrievalService
    keyword_search_service: KeywordSearchService
    hybrid_search_service: HybridSearchService
    rerank_service: RerankService
    event_service: EventService
    graph_enhanced_service: GraphEnhancedService
    context_assembly_service: ContextAssemblyService
    citation_service: CitationService

    def reset(self) -> None:
        """Clear in-memory state."""
        if isinstance(self.kb_repository, InMemoryKnowledgeBaseRepository):
            self.kb_repository.clear()
        if isinstance(self.doc_repository, InMemoryDocumentRepository):
            self.doc_repository.clear()
        if isinstance(self.chunk_repository, InMemoryDocumentChunkRepository):
            self.chunk_repository.clear()
        if isinstance(self.event_repository, InMemorySearchEventRepository):
            self.event_repository.clear()


_LOCK = RLock()
_REGISTRY: Optional[Registry] = None


def _build_kafka_producer():
    """Create a KafkaProducer if kafka_bootstrap_servers is configured.

    Returns None when Kafka is not configured (no-op relay mode).
    """
    if not settings.kafka_bootstrap_servers:
        return None
    try:
        from kafka import KafkaProducer

        return KafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda v: v,
        )
    except Exception:
        logger.warning("Failed to create KafkaProducer, falling back to no-op mode")
        return None


def _build_default_registry() -> Registry:
    kb_repo = InMemoryKnowledgeBaseRepository()
    doc_repo = InMemoryDocumentRepository()
    chunk_repo = InMemoryDocumentChunkRepository()
    event_repo = InMemorySearchEventRepository()
    storage = LocalFileStorage()
    kb_service = KnowledgeBaseService(kb_repo, doc_repo)
    doc_service = DocumentService(doc_repo, kb_repo, storage=storage)
    chunk_service = ChunkService(chunk_repo, doc_repo, storage)
    embedding_service = EmbeddingService(chunk_repo, doc_repo)
    retrieval_service = RetrievalService(chunk_repo, doc_repo)
    keyword_search_service = KeywordSearchService(chunk_repo, doc_repo)
    hybrid_search_service = HybridSearchService(retrieval_service, keyword_search_service)
    rerank_service = RerankService()
    kafka_producer = _build_kafka_producer()
    event_service = EventService(event_repo, kafka_producer=kafka_producer)
    graph_enhanced_service = GraphEnhancedService(
        hybrid_search_service, keyword_search_service
    )
    context_assembly_service = ContextAssemblyService(hybrid_search_service)
    citation_service = CitationService(chunk_repo, doc_repo)
    return Registry(
        kb_repository=kb_repo,
        doc_repository=doc_repo,
        chunk_repository=chunk_repo,
        event_repository=event_repo,
        storage=storage,
        kb_service=kb_service,
        doc_service=doc_service,
        chunk_service=chunk_service,
        embedding_service=embedding_service,
        retrieval_service=retrieval_service,
        keyword_search_service=keyword_search_service,
        hybrid_search_service=hybrid_search_service,
        rerank_service=rerank_service,
        event_service=event_service,
        graph_enhanced_service=graph_enhanced_service,
        context_assembly_service=context_assembly_service,
        citation_service=citation_service,
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


def get_keyword_search_service(request: Request) -> KeywordSearchService:
    return request.app.state.registry.keyword_search_service


def get_hybrid_search_service(request: Request) -> HybridSearchService:
    return request.app.state.registry.hybrid_search_service


def get_rerank_service(request: Request) -> RerankService:
    return request.app.state.registry.rerank_service


def get_event_service(request: Request) -> EventService:
    return request.app.state.registry.event_service


def get_graph_enhanced_service(request: Request) -> GraphEnhancedService:
    return request.app.state.registry.graph_enhanced_service


def get_context_assembly_service(request: Request) -> ContextAssemblyService:
    return request.app.state.registry.context_assembly_service


def get_citation_service(request: Request) -> CitationService:
    return request.app.state.registry.citation_service
