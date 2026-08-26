"""HTTP API for the transactional order-review vertical slice."""
from __future__ import annotations

from typing import Any, NoReturn

from fastapi import APIRouter, Header, HTTPException, Query, Request, status

from mate_platform.tenancy.guards import require_tenant

from ..repositories.order_review import OrderReviewService
from .schemas import (
    ConfirmActionProposalRequest,
    CreateOrderRequest,
    CreateReviewCaseRequest,
    RejectActionProposalRequest,
)

router = APIRouter(prefix="/api/v1/orchestrator", tags=["order-review"])
public_router = APIRouter(prefix="/api/v1", tags=["order-review"])
_service = OrderReviewService()


def _tenant_id(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _trace_id(request: Request) -> str:
    ctx = getattr(request.state, "ctx", None)
    return str(getattr(ctx, "trace_id", "") or request.headers.get("X-Trace-Id", ""))


def _raise_service_error(error: Exception) -> NoReturn:
    if isinstance(error, OrderReviewService.NotFound):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, OrderReviewService.VersionConflict):
        raise HTTPException(status_code=409, detail=str(error), headers={"X-Error-Code": "version_conflict"}) from error
    if isinstance(error, OrderReviewService.IdempotencyConflict):
        raise HTTPException(status_code=409, detail=str(error), headers={"X-Error-Code": "idempotency_conflict"}) from error
    if isinstance(error, OrderReviewService.AlreadyResolved):
        raise HTTPException(status_code=409, detail=str(error), headers={"X-Error-Code": "already_resolved"}) from error
    if isinstance(error, OrderReviewService.Conflict):
        raise HTTPException(status_code=409, detail=str(error)) from error
    if isinstance(error, ValueError):
        raise HTTPException(status_code=422, detail=str(error)) from error
    raise error


@public_router.post("/orders", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(request: Request, body: CreateOrderRequest) -> dict[str, Any]:
    try:
        return _service.create_order(
            tenant_id=_tenant_id(request),
            order_id=body.order_id,
            amount_cents=body.amount_cents,
            payment_status=body.payment_status,
        )
    except Exception as error:
        _raise_service_error(error)


@public_router.get("/orders/high-value-unpaid", include_in_schema=False)
@router.get("/orders/high-value-unpaid")
async def list_high_value_unpaid(
    request: Request,
    min_amount_cents: int = Query(default=100_000, ge=1),
) -> dict[str, Any]:
    items = _service.list_high_value_unpaid(
        tenant_id=_tenant_id(request), min_amount_cents=min_amount_cents,
    )
    return {"items": items, "total": len(items)}


@public_router.post("/review-cases", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/review-cases", status_code=status.HTTP_201_CREATED)
async def create_review_case(request: Request, body: CreateReviewCaseRequest) -> dict[str, Any]:
    try:
        return _service.create_review_case(
            tenant_id=_tenant_id(request),
            order_id=body.order_id,
            suggestion=body.suggestion,
            source_refs=body.source_refs,
            trace_id=_trace_id(request),
        )
    except Exception as error:
        _raise_service_error(error)


@public_router.get("/action-proposals/{proposal_id}", include_in_schema=False)
@router.get("/action-proposals/{proposal_id}")
async def get_action_proposal(proposal_id: str, request: Request) -> dict[str, Any]:
    try:
        return _service.get_proposal(tenant_id=_tenant_id(request), proposal_id=proposal_id)
    except Exception as error:
        _raise_service_error(error)


@public_router.post("/action-proposals/{proposal_id}/confirm", include_in_schema=False)
@router.post("/action-proposals/{proposal_id}/confirm")
async def confirm_action_proposal(
    proposal_id: str,
    request: Request,
    body: ConfirmActionProposalRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    if not idempotency_key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return _service.confirm_proposal(
            tenant_id=_tenant_id(request),
            proposal_id=proposal_id,
            idempotency_key=idempotency_key,
            actor_id=body.actor_id,
            trace_id=_trace_id(request),
        )
    except Exception as error:
        _raise_service_error(error)


@public_router.post("/action-proposals/{proposal_id}/reject", include_in_schema=False)
@router.post("/action-proposals/{proposal_id}/reject")
async def reject_action_proposal(
    proposal_id: str,
    request: Request,
    body: RejectActionProposalRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    if not idempotency_key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return _service.reject_proposal(
            tenant_id=_tenant_id(request),
            proposal_id=proposal_id,
            idempotency_key=idempotency_key,
            actor_id=body.actor_id,
            reason=body.reason,
            trace_id=_trace_id(request),
        )
    except Exception as error:
        _raise_service_error(error)
