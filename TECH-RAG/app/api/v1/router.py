"""Aggregate v1 router for TECH-RAG."""

from fastapi import APIRouter

from app.api.v1 import documents, knowledge_bases, search

router = APIRouter(prefix="/api/v1/rag")
router.include_router(knowledge_bases.router)
router.include_router(documents.router)
router.include_router(search.router)
