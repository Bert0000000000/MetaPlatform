"""Aggregate v1 router for TECH-A2A."""

from fastapi import APIRouter

from app.api.v1 import (
    agent_cards,
    audit,
    auth,
    delegations,
    inbound,
    messages,
    public,
    registry,
)

router = APIRouter(prefix="/api/v1/a2a")
router.include_router(agent_cards.router)
router.include_router(registry.router)
router.include_router(delegations.router)
router.include_router(inbound.router)
router.include_router(messages.router)
router.include_router(audit.router)
router.include_router(auth.router)

# Public .well-known routes (no prefix)
public_router = APIRouter()
public_router.include_router(public.router)


@router.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
