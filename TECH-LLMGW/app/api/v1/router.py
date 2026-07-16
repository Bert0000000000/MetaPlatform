"""Aggregate v1 router for TECH-LLMGW."""

from fastapi import APIRouter

from app.api.v1 import chat, embeddings, models

router = APIRouter(prefix="/api/v1/llmgw")
router.include_router(models.router)
router.include_router(chat.router)
router.include_router(embeddings.router)


@router.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}