"""Aggregate v1 router for TECH-RAG."""

from fastapi import APIRouter

from app.api.v1 import citations, context, documents, graph_search, knowledge_bases, search

router = APIRouter(prefix="/api/v1/rag")
router.include_router(knowledge_bases.router)
router.include_router(documents.router)
router.include_router(search.router)
router.include_router(graph_search.router)
router.include_router(context.router)
router.include_router(citations.router)
