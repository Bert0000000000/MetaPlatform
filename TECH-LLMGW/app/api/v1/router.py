"""Aggregate v1 router for TECH-LLMGW."""

from fastapi import APIRouter

from app.api.v1 import (
    audit,
    chat,
    chat_completions,
    cost,
    embeddings,
    models,
    prompts,
    quotas,
    ratelimits,
)

router = APIRouter(prefix="/api/v1/llmgw")
router.include_router(models.router)
router.include_router(chat.router)
router.include_router(chat_completions.router)
router.include_router(embeddings.router)
router.include_router(prompts.router)
router.include_router(quotas.router)
router.include_router(ratelimits.router)
router.include_router(cost.router)
router.include_router(audit.router)


@router.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}