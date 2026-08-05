"""POST /license/activate + GET /subscriptions。

激活走 Task 8 license_service;subscriptions 走 db_filter(tenant 隔离)。
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from ..domain.subscription import Subscription

router = APIRouter(tags=["marketplace"])


@router.post("/license/activate")
async def activate_license(body: dict, request: Request):
    user = getattr(request.state, "user", None)
    if user is None or "platform.marketplace.write" not in getattr(
        user, "scopes", frozenset()
    ):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "MP_INSUFFICIENT_SCOPE",
                "message": "missing platform.marketplace.write scope",
            },
        )
    from ..service.license_service import activate_license

    return await activate_license(
        session=request.state.db,
        mp_client=request.state.marketplace_client,
        license_key=body["license_key"],
        tenant_id=UUID(user.tenant_id) if getattr(user, "tenant_id", None) else None,
        user_id=UUID(user.id),
    )


@router.get("/subscriptions")
async def list_subscriptions(request: Request):
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="missing user context")
    session = request.state.db
    rows = (
        await session.scalars(
            select(Subscription).where(
                Subscription.tenant_id == UUID(user.tenant_id)
            )
        )
    ).all()
    return {
        "items": [
            {
                "id": str(r.id),
                "sku": r.sku,
                "status": r.status,
                "purchased_at": r.purchased_at.isoformat(),
                "expires_at": (
                    r.expires_at.isoformat() if r.expires_at else None
                ),
            }
            for r in rows
        ]
    }