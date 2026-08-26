"""HTTP API for the transactional order-review vertical slice."""

from __future__ import annotations

from typing import Any, NoReturn

from fastapi import APIRouter, Header, HTTPException, Query, Request, status

from mate_platform.tenancy.guards import require_tenant

from ..repositories.order_review import OrderReviewService
from .schemas import (
    ActionProposal,
    ConfirmActionProposalRequest,
    CreateOrderRequest,
    CreateReviewCaseRequest,
    CreateReviewCaseResponse,
    RejectActionProposalRequest,
    validate_evidence_bundle,
)

router = APIRouter(prefix="/api/v1/orchestrator", tags=["order-review"])
public_router = APIRouter(prefix="/api/v1", tags=["order-review"])
_service = OrderReviewService()
_REVIEW_CASE_RESPONSES = {
    404: {"description": "订单不存在"},
    409: {"description": "订单状态冲突"},
    503: {
        "description": "Evidence unavailable",
        "headers": {
            "X-Error-Code": {
                "description": "Application error code.",
                "schema": {"type": "string", "enum": ["evidence_unavailable"]},
            }
        },
    },
}
_ACTION_PROPOSAL_DETAIL_RESPONSES = {
    404: {"description": "Proposal 不存在或不属于当前租户"},
}
_ACTION_PROPOSAL_CONFIRM_RESPONSES = {
    400: {"description": "缺少 Idempotency-Key"},
    404: {"description": "Proposal 不存在或不属于当前租户"},
    409: {
        "description": "版本冲突、重复处理、幂等键冲突或 evidence required",
        "headers": {
            "X-Error-Code": {
                "description": "Application error code.",
                "schema": {
                    "type": "string",
                    "enum": [
                        "version_conflict",
                        "idempotency_conflict",
                        "already_resolved",
                        "evidence_required",
                    ],
                },
            }
        },
    },
    503: {
        "description": "Evidence unavailable",
        "headers": {
            "X-Error-Code": {
                "description": "Application error code.",
                "schema": {"type": "string", "enum": ["evidence_unavailable"]},
            }
        },
    },
}


def _tenant_id(request: Request) -> str:
    return str(require_tenant(request.state.ctx))


def _trace_id(request: Request) -> str:
    ctx = getattr(request.state, "ctx", None)
    return str(getattr(ctx, "trace_id", "") or request.headers.get("X-Trace-Id", ""))


def _bearer_credential(request: Request) -> str:
    ctx = getattr(request.state, "ctx", None)
    token = str(getattr(ctx, "authorization", "") or "").strip()
    if token.lower().startswith("bearer "):
        return token.split(None, 1)[1].strip()
    if token:
        return token
    raw = request.headers.get("Authorization", "")
    if raw.lower().startswith("bearer "):
        return raw.split(None, 1)[1].strip()
    return ""


def _response_evidence(evidence: Any) -> dict[str, Any] | None:
    validated = validate_evidence_bundle(evidence)
    if validated is None:
        return None
    return validated.model_dump(mode="json", exclude_none=True)


def _require_response_evidence(evidence: Any) -> dict[str, Any]:
    response_evidence = _response_evidence(evidence)
    if response_evidence is None:
        raise OrderReviewService.EvidenceUnavailable(
            "order review evidence bundle is missing or invalid"
        )
    return response_evidence


def _raise_service_error(error: Exception) -> NoReturn:
    if isinstance(error, OrderReviewService.NotFound):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, OrderReviewService.EvidenceUnavailable):
        raise HTTPException(
            status_code=503,
            detail=str(error),
            headers={"X-Error-Code": "evidence_unavailable"},
        ) from error
    if isinstance(error, OrderReviewService.VersionConflict):
        raise HTTPException(
            status_code=409, detail=str(error), headers={"X-Error-Code": "version_conflict"}
        ) from error
    if isinstance(error, OrderReviewService.IdempotencyConflict):
        raise HTTPException(
            status_code=409, detail=str(error), headers={"X-Error-Code": "idempotency_conflict"}
        ) from error
    if isinstance(error, OrderReviewService.AlreadyResolved):
        raise HTTPException(
            status_code=409, detail=str(error), headers={"X-Error-Code": "already_resolved"}
        ) from error
    if isinstance(error, OrderReviewService.EvidenceRequired):
        raise HTTPException(
            status_code=409, detail=str(error), headers={"X-Error-Code": "evidence_required"}
        ) from error
    if isinstance(error, OrderReviewService.Conflict):
        raise HTTPException(status_code=409, detail=str(error)) from error
    if isinstance(error, ValueError):
        raise HTTPException(status_code=422, detail=str(error)) from error
    raise error


@public_router.post("/orders", status_code=status.HTTP_201_CREATED)
@router.post("/orders", status_code=status.HTTP_201_CREATED, include_in_schema=False)
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


@public_router.get("/orders/high-value-unpaid")
@router.get("/orders/high-value-unpaid", include_in_schema=False)
async def list_high_value_unpaid(
    request: Request,
    min_amount_cents: int = Query(default=100_000, ge=1),
) -> dict[str, Any]:
    items = _service.list_high_value_unpaid(
        tenant_id=_tenant_id(request),
        min_amount_cents=min_amount_cents,
    )
    return {"items": items, "total": len(items)}


@public_router.post(
    "/review-cases",
    status_code=status.HTTP_201_CREATED,
    response_model=CreateReviewCaseResponse,
    responses=_REVIEW_CASE_RESPONSES,
)
@router.post(
    "/review-cases",
    status_code=status.HTTP_201_CREATED,
    response_model=CreateReviewCaseResponse,
    responses=_REVIEW_CASE_RESPONSES,
    include_in_schema=False,
)
async def create_review_case(
    request: Request, body: CreateReviewCaseRequest
) -> CreateReviewCaseResponse:
    try:
        created = _service.create_review_case(
            tenant_id=_tenant_id(request),
            order_id=body.order_id,
            suggestion=body.suggestion,
            source_refs=body.source_refs,
            auth_token=_bearer_credential(request),
            trace_id=_trace_id(request),
        )
        created["evidence"] = _require_response_evidence(created.get("evidence"))
        return CreateReviewCaseResponse.model_validate(created)
    except Exception as error:
        _raise_service_error(error)


@public_router.post(
    "/action-proposals/{proposal_id}:confirm", responses=_ACTION_PROPOSAL_CONFIRM_RESPONSES
)
@router.post(
    "/action-proposals/{proposal_id}:confirm",
    responses=_ACTION_PROPOSAL_CONFIRM_RESPONSES,
    include_in_schema=False,
)
async def confirm_action_proposal(
    proposal_id: str,
    request: Request,
    body: ConfirmActionProposalRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return _service.confirm_proposal(
            tenant_id=_tenant_id(request),
            proposal_id=proposal_id,
            idempotency_key=idempotency_key.strip(),
            actor_id=body.actor_id,
            trace_id=_trace_id(request),
        )
    except Exception as error:
        _raise_service_error(error)


@public_router.post("/action-proposals/{proposal_id}:reject")
@router.post("/action-proposals/{proposal_id}:reject", include_in_schema=False)
async def reject_action_proposal(
    proposal_id: str,
    request: Request,
    body: RejectActionProposalRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict[str, Any]:
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return _service.reject_proposal(
            tenant_id=_tenant_id(request),
            proposal_id=proposal_id,
            idempotency_key=idempotency_key.strip(),
            actor_id=body.actor_id,
            reason=body.reason,
            trace_id=_trace_id(request),
        )
    except Exception as error:
        _raise_service_error(error)


@public_router.get(
    "/action-proposals/{proposal_id}",
    response_model=ActionProposal,
    responses=_ACTION_PROPOSAL_DETAIL_RESPONSES,
)
@router.get(
    "/action-proposals/{proposal_id}",
    response_model=ActionProposal,
    responses=_ACTION_PROPOSAL_DETAIL_RESPONSES,
    include_in_schema=False,
)
async def get_action_proposal(proposal_id: str, request: Request) -> ActionProposal:
    try:
        proposal = _service.get_proposal(tenant_id=_tenant_id(request), proposal_id=proposal_id)
        proposal["evidence"] = _response_evidence(proposal.get("evidence"))
        return ActionProposal.model_validate(proposal)
    except Exception as error:
        _raise_service_error(error)
