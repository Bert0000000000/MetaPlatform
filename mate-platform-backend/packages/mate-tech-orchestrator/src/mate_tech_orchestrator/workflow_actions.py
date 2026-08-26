"""Temporal action adapter for the order-review vertical slice.

The Temporal worker owns durable workflow state, while this adapter owns the
transactional business side effect.  It deliberately depends on the domain
service rather than the WFE package so the worker can consume this port
without introducing an application-package cycle.
"""
from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from .repositories.order_review import OrderReviewService

ORDER_REVIEW_CONFIRM_ACTION = "order_review_confirm"
DEFAULT_WORKER_ACTOR = "temporal-worker"


def _required_text(value: Any, *, field: str, max_length: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"workflow action {field} is required")
    result = value.strip()
    if len(result) > max_length:
        raise ValueError(f"workflow action {field} is too long")
    return result


def _optional_text(value: Any, *, field: str, default: str, max_length: int) -> str:
    if value is None:
        return default
    return _required_text(value, field=field, max_length=max_length)


class OrderReviewActionExecutor:
    """Execute the approved order-review action through its SQL transaction."""

    def __init__(
        self,
        *,
        service: OrderReviewService | None = None,
        worker_actor_id: str = DEFAULT_WORKER_ACTOR,
    ) -> None:
        self._service = service or OrderReviewService()
        self._worker_actor_id = _required_text(
            worker_actor_id,
            field="worker_actor_id",
            max_length=128,
        )

    async def execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Execute one Temporal activity payload and return the domain result.

        The tenant boundary is taken exclusively from the activity envelope.
        The step input may carry actor and trace context, but cannot override
        the tenant used for proposal lookup or transaction writes.
        """
        if not isinstance(payload, Mapping):
            raise ValueError("workflow action payload must be an object")
        tenant_id = _required_text(payload.get("tenant_id"), field="tenant_id", max_length=64)
        run_id = _required_text(payload.get("run_id"), field="run_id", max_length=128)
        step = payload.get("step")
        if not isinstance(step, Mapping):
            raise ValueError("workflow action step must be an object")

        action_type = _required_text(step.get("action_type"), field="action_type", max_length=64)
        if action_type != ORDER_REVIEW_CONFIRM_ACTION:
            raise ValueError(f"unsupported workflow action: {action_type}")
        step_id = _required_text(step.get("id"), field="step.id", max_length=128)
        action_input = step.get("input", {})
        if not isinstance(action_input, Mapping):
            raise ValueError("workflow action input must be an object")
        proposal_id = _required_text(
            action_input.get("proposal_id"),
            field="input.proposal_id",
            max_length=128,
        )

        raw_idempotency_key = action_input.get("idempotency_key")
        if raw_idempotency_key is None:
            idempotency_key = f"temporal:{run_id}:{step_id}"
        else:
            idempotency_key = _required_text(
                raw_idempotency_key,
                field="input.idempotency_key",
                max_length=256,
            )
        actor_id = _optional_text(
            action_input.get("actor_id"),
            field="input.actor_id",
            default=self._worker_actor_id,
            max_length=128,
        )
        trace_id = _optional_text(
            action_input.get("trace_id"),
            field="input.trace_id",
            default="",
            max_length=128,
        )

        return await asyncio.to_thread(
            self._service.confirm_proposal,
            tenant_id=tenant_id,
            proposal_id=proposal_id,
            idempotency_key=idempotency_key,
            actor_id=actor_id,
            trace_id=trace_id,
        )


def build_order_review_action_executor(
    *,
    service: OrderReviewService | None = None,
    worker_actor_id: str = DEFAULT_WORKER_ACTOR,
) -> OrderReviewActionExecutor:
    """Build the concrete action port for a Temporal worker process."""
    return OrderReviewActionExecutor(service=service, worker_actor_id=worker_actor_id)
