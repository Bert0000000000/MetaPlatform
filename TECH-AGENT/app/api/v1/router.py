"""Aggregate v1 router for TECH-AGENT."""

from fastapi import APIRouter

from app.api.v1 import (
    agents,
    card,
    checkpoints,
    conversations,
    executions,
    steps,
    tasks,
    tools,
)

router = APIRouter(prefix="/api/v1/agent")
router.include_router(agents.router)
router.include_router(executions.router)
router.include_router(checkpoints.router)
router.include_router(tasks.router)
router.include_router(conversations.router)
router.include_router(tools.router)
router.include_router(steps.router)
router.include_router(card.router)


@router.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
