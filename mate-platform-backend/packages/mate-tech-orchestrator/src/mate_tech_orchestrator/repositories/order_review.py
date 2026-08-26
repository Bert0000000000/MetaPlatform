"""SQL-backed order review workflow for the v1.0 north-star journey.

The service intentionally owns the transaction boundary.  An approved
proposal updates the order, creates the follow-up task, records idempotency,
and appends audit/outbox events in one database transaction.  Search/RAG
consumers can be eventually consistent; the order write path cannot.
"""
from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text, select, update
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base, create_all, get_session


def _now() -> datetime:
    return datetime.now(UTC)


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _load(raw: str | None, default: Any) -> Any:
    try:
        return json.loads(raw or "")
    except (TypeError, ValueError):
        return default


def _aware(value: datetime) -> datetime:
    """Normalize SQLite's naive DateTime result to UTC for comparisons."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def _iso(value: datetime) -> str:
    return _aware(value).isoformat()


class OrderORM(Base):
    __tablename__ = "order_review_orders"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unpaid")
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class ReviewCaseORM(Base):
    __tablename__ = "order_review_cases"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    review_case_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    suggestion: Mapped[str] = mapped_column(Text, nullable=False)
    source_refs: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class ActionProposalORM(Base):
    __tablename__ = "order_review_action_proposals"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    proposal_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    review_case_id: Mapped[str] = mapped_column(String(128), nullable=False)
    order_id: Mapped[str] = mapped_column(String(128), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False, default="order_review_confirm")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    expected_order_version: Mapped[int] = mapped_column(Integer, nullable=False)
    parameters: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FollowUpTaskORM(Base):
    __tablename__ = "order_review_follow_up_tasks"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(128), nullable=False)
    review_case_id: Mapped[str] = mapped_column(String(128), nullable=False)
    proposal_id: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class IdempotencyRecordORM(Base):
    __tablename__ = "order_review_idempotency_records"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(256), primary_key=True)
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    proposal_id: Mapped[str] = mapped_column(String(128), nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class OutboxEventORM(Base):
    __tablename__ = "order_review_outbox_events"

    event_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    aggregate_type: Mapped[str] = mapped_column(String(64), nullable=False)
    aggregate_id: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    trace_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    correlation_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    causation_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class OrderReviewService:
    """Tenant-scoped transactional application service."""

    class NotFoundError(Exception):
        pass

    class ConflictError(Exception):
        pass

    class VersionConflictError(ConflictError):
        pass

    class AlreadyResolvedError(ConflictError):
        pass

    class IdempotencyConflictError(ConflictError):
        pass

    # Short aliases keep the service call sites readable and preserve the
    # domain names used by the API adapter/tests.
    NotFound = NotFoundError
    Conflict = ConflictError
    VersionConflict = VersionConflictError
    AlreadyResolved = AlreadyResolvedError
    IdempotencyConflict = IdempotencyConflictError

    def __init__(self, *, proposal_ttl: timedelta = timedelta(hours=24)) -> None:
        self._proposal_ttl = proposal_ttl

    @staticmethod
    def _ensure_schema() -> None:
        create_all()

    @staticmethod
    def _order_dict(row: OrderORM) -> dict[str, Any]:
        return {
            "tenant_id": row.tenant_id,
            "order_id": row.order_id,
            "amount_cents": row.amount_cents,
            "payment_status": row.payment_status,
            "review_status": row.review_status,
            "version": row.version,
            "updated_at": _iso(row.updated_at),
        }

    @staticmethod
    def _proposal_dict(row: ActionProposalORM, case: ReviewCaseORM | None = None) -> dict[str, Any]:
        result: dict[str, Any] = {
            "tenant_id": row.tenant_id,
            "proposal_id": row.proposal_id,
            "review_case_id": row.review_case_id,
            "order_id": row.order_id,
            "action_type": row.action_type,
            "status": row.status,
            "expected_order_version": row.expected_order_version,
            "parameters": _load(row.parameters, {}),
            "expires_at": _iso(row.expires_at),
            "created_at": _iso(row.created_at),
            "resolved_at": _iso(row.resolved_at) if row.resolved_at else None,
        }
        if case is not None:
            result["suggestion"] = _load(case.suggestion, {})
            result["source_refs"] = _load(case.source_refs, [])
        return result

    @staticmethod
    def _event(
        *,
        tenant_id: str,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: dict[str, Any],
        trace_id: str = "",
        correlation_id: str = "",
        causation_id: str = "",
    ) -> OutboxEventORM:
        return OutboxEventORM(
            event_id=f"evt_{uuid.uuid4().hex}",
            tenant_id=tenant_id,
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            payload=_json(payload),
            trace_id=trace_id,
            correlation_id=correlation_id,
            causation_id=causation_id,
        )

    def create_order(
        self,
        *,
        tenant_id: str,
        order_id: str,
        amount_cents: int,
        payment_status: str = "unpaid",
    ) -> dict[str, Any]:
        self._ensure_schema()
        now = _now()
        with get_session() as session, session.begin():
            if session.get(OrderORM, (tenant_id, order_id)) is not None:
                raise self.Conflict(f"order already exists: {order_id}")
            row = OrderORM(
                tenant_id=tenant_id,
                order_id=order_id,
                amount_cents=amount_cents,
                payment_status=payment_status,
                review_status="pending",
                version=1,
                updated_at=now,
            )
            session.add(row)
        return self._order_dict(row)

    def list_high_value_unpaid(self, *, tenant_id: str, min_amount_cents: int) -> list[dict[str, Any]]:
        self._ensure_schema()
        with get_session() as session:
            rows = session.execute(
                select(OrderORM)
                .where(
                    OrderORM.tenant_id == tenant_id,
                    OrderORM.payment_status == "unpaid",
                    OrderORM.amount_cents >= min_amount_cents,
                )
                .order_by(OrderORM.amount_cents.desc(), OrderORM.order_id)
            ).scalars().all()
        return [self._order_dict(row) for row in rows]

    def get_order(self, *, tenant_id: str, order_id: str) -> dict[str, Any]:
        self._ensure_schema()
        with get_session() as session:
            row = session.get(OrderORM, (tenant_id, order_id))
            if row is None:
                raise self.NotFound(f"order not found: {order_id}")
            return self._order_dict(row)

    def update_order_version(self, *, tenant_id: str, order_id: str) -> None:
        self._ensure_schema()
        with get_session() as session, session.begin():
            result = session.execute(
                update(OrderORM)
                .where(OrderORM.tenant_id == tenant_id, OrderORM.order_id == order_id)
                .values(version=OrderORM.version + 1, updated_at=_now())
            )
            if result.rowcount != 1:
                raise self.NotFound(f"order not found: {order_id}")

    def create_review_case(
        self,
        *,
        tenant_id: str,
        order_id: str,
        suggestion: dict[str, Any],
        source_refs: list[str],
        trace_id: str = "",
    ) -> dict[str, Any]:
        self._ensure_schema()
        case_id = f"case_{uuid.uuid4().hex}"
        proposal_id = f"proposal_{uuid.uuid4().hex}"
        now = _now()
        with get_session() as session, session.begin():
            order = session.execute(
                select(OrderORM)
                .where(OrderORM.tenant_id == tenant_id, OrderORM.order_id == order_id)
                .with_for_update()
            ).scalar_one_or_none()
            if order is None:
                raise self.NotFound(f"order not found: {order_id}")
            if order.payment_status != "unpaid":
                raise self.Conflict(f"order is not unpaid: {order_id}")
            case = ReviewCaseORM(
                tenant_id=tenant_id,
                review_case_id=case_id,
                order_id=order_id,
                status="open",
                suggestion=_json(suggestion),
                source_refs=_json(source_refs),
                created_at=now,
            )
            proposal = ActionProposalORM(
                tenant_id=tenant_id,
                proposal_id=proposal_id,
                review_case_id=case_id,
                order_id=order_id,
                action_type="order_review_confirm",
                status="pending",
                expected_order_version=order.version,
                parameters=_json({"review_status": "approved"}),
                expires_at=now + self._proposal_ttl,
                created_at=now,
            )
            session.add_all([case, proposal])
            session.add(self._event(
                tenant_id=tenant_id,
                event_type="order.review.proposal_created",
                aggregate_type="action_proposal",
                aggregate_id=proposal_id,
                payload={"order_id": order_id, "review_case_id": case_id, "source_refs": source_refs},
                trace_id=trace_id,
            ))
        return {
            "review_case_id": case_id,
            "proposal_id": proposal_id,
            "status": "pending",
            "expected_order_version": order.version,
        }

    def get_proposal(self, *, tenant_id: str, proposal_id: str) -> dict[str, Any]:
        self._ensure_schema()
        with get_session() as session:
            proposal = session.execute(
                select(ActionProposalORM)
                .where(
                    ActionProposalORM.tenant_id == tenant_id,
                    ActionProposalORM.proposal_id == proposal_id,
                )
                .with_for_update()
            ).scalar_one_or_none()
            if proposal is None:
                raise self.NotFound(f"action proposal not found: {proposal_id}")
            case = session.get(ReviewCaseORM, (tenant_id, proposal.review_case_id))
            return self._proposal_dict(proposal, case)

    def _existing_idempotency(
        self, session: Any, *, tenant_id: str, key: str, operation: str, proposal_id: str,
    ) -> dict[str, Any] | None:
        record = session.get(IdempotencyRecordORM, (tenant_id, key))
        if record is None:
            return None
        if record.operation != operation or record.proposal_id != proposal_id:
            raise self.IdempotencyConflict(f"idempotency key already used: {key}")
        return _load(record.response, {})

    def confirm_proposal(
        self,
        *,
        tenant_id: str,
        proposal_id: str,
        idempotency_key: str,
        actor_id: str,
        trace_id: str = "",
    ) -> dict[str, Any]:
        if not idempotency_key.strip():
            raise ValueError("idempotency key is required")
        self._ensure_schema()
        with get_session() as session, session.begin():
            previous = self._existing_idempotency(
                session,
                tenant_id=tenant_id,
                key=idempotency_key,
                operation="confirm",
                proposal_id=proposal_id,
            )
            if previous is not None:
                return previous
            proposal = session.get(ActionProposalORM, (tenant_id, proposal_id))
            if proposal is None:
                raise self.NotFound(f"action proposal not found: {proposal_id}")
            if proposal.status != "pending":
                raise self.AlreadyResolved(f"action proposal is {proposal.status}: {proposal_id}")
            if _aware(proposal.expires_at) <= _now():
                proposal.status = "expired"
                proposal.resolved_at = _now()
                raise self.Conflict(f"action proposal expired: {proposal_id}")
            order = session.execute(
                select(OrderORM)
                .where(
                    OrderORM.tenant_id == tenant_id,
                    OrderORM.order_id == proposal.order_id,
                )
                .with_for_update()
            ).scalar_one_or_none()
            if order is None:
                raise self.NotFound(f"order not found: {proposal.order_id}")
            if order.version != proposal.expected_order_version:
                raise self.VersionConflict(
                    f"order version changed: expected {proposal.expected_order_version}, got {order.version}"
                )
            now = _now()
            next_version = proposal.expected_order_version + 1
            updated = session.execute(
                update(OrderORM)
                .where(
                    OrderORM.tenant_id == tenant_id,
                    OrderORM.order_id == order.order_id,
                    OrderORM.version == proposal.expected_order_version,
                )
                .values(review_status="approved", version=next_version, updated_at=now)
            )
            if updated.rowcount != 1:
                raise self.VersionConflict("order version changed during confirmation")
            case = session.get(ReviewCaseORM, (tenant_id, proposal.review_case_id))
            if case is not None:
                case.status = "approved"
            task_id = f"task_{uuid.uuid4().hex}"
            task = FollowUpTaskORM(
                tenant_id=tenant_id,
                task_id=task_id,
                order_id=order.order_id,
                review_case_id=proposal.review_case_id,
                proposal_id=proposal.proposal_id,
                status="open",
                title=f"Follow up payment for {order.order_id}",
                created_at=now,
            )
            proposal.status = "confirmed"
            proposal.resolved_at = now
            response = {
                "proposal_id": proposal.proposal_id,
                "order_id": order.order_id,
                "status": "confirmed",
                "order_version": next_version,
                "follow_up_task_id": task_id,
            }
            session.add(task)
            session.add(IdempotencyRecordORM(
                tenant_id=tenant_id,
                idempotency_key=idempotency_key,
                operation="confirm",
                proposal_id=proposal_id,
                response=_json(response),
            ))
            session.add(self._event(
                tenant_id=tenant_id,
                event_type="order.review.confirmed",
                aggregate_type="order",
                aggregate_id=order.order_id,
                payload={**response, "actor_id": actor_id},
                trace_id=trace_id,
                correlation_id=proposal_id,
            ))
            session.add(self._event(
                tenant_id=tenant_id,
                event_type="audit.action_proposal.confirmed",
                aggregate_type="action_proposal",
                aggregate_id=proposal_id,
                payload={"actor_id": actor_id, "order_id": order.order_id, "idempotency_key": idempotency_key},
                trace_id=trace_id,
                correlation_id=proposal_id,
            ))
        return response

    def reject_proposal(
        self,
        *,
        tenant_id: str,
        proposal_id: str,
        idempotency_key: str,
        actor_id: str,
        reason: str = "",
        trace_id: str = "",
    ) -> dict[str, Any]:
        if not idempotency_key.strip():
            raise ValueError("idempotency key is required")
        self._ensure_schema()
        with get_session() as session, session.begin():
            previous = self._existing_idempotency(
                session,
                tenant_id=tenant_id,
                key=idempotency_key,
                operation="reject",
                proposal_id=proposal_id,
            )
            if previous is not None:
                return previous
            proposal = session.execute(
                select(ActionProposalORM)
                .where(
                    ActionProposalORM.tenant_id == tenant_id,
                    ActionProposalORM.proposal_id == proposal_id,
                )
                .with_for_update()
            ).scalar_one_or_none()
            if proposal is None:
                raise self.NotFound(f"action proposal not found: {proposal_id}")
            if proposal.status != "pending":
                raise self.AlreadyResolved(f"action proposal is {proposal.status}: {proposal_id}")
            now = _now()
            proposal.status = "rejected"
            proposal.resolved_at = now
            case = session.get(ReviewCaseORM, (tenant_id, proposal.review_case_id))
            if case is not None:
                case.status = "rejected"
            response = {"proposal_id": proposal_id, "status": "rejected", "reason": reason}
            session.add(IdempotencyRecordORM(
                tenant_id=tenant_id,
                idempotency_key=idempotency_key,
                operation="reject",
                proposal_id=proposal_id,
                response=_json(response),
            ))
            session.add(self._event(
                tenant_id=tenant_id,
                event_type="audit.action_proposal.rejected",
                aggregate_type="action_proposal",
                aggregate_id=proposal_id,
                payload={"actor_id": actor_id, "reason": reason},
                trace_id=trace_id,
                correlation_id=proposal_id,
            ))
        return response

    def list_follow_up_tasks(self, *, tenant_id: str) -> list[dict[str, Any]]:
        self._ensure_schema()
        with get_session() as session:
            rows = session.execute(
                select(FollowUpTaskORM)
                .where(FollowUpTaskORM.tenant_id == tenant_id)
                .order_by(FollowUpTaskORM.created_at)
            ).scalars().all()
        return [
            {
                "task_id": row.task_id,
                "order_id": row.order_id,
                "review_case_id": row.review_case_id,
                "proposal_id": row.proposal_id,
                "status": row.status,
                "title": row.title,
            }
            for row in rows
        ]

    def list_outbox_events(self, *, tenant_id: str) -> list[dict[str, Any]]:
        self._ensure_schema()
        with get_session() as session:
            rows = session.execute(
                select(OutboxEventORM)
                .where(OutboxEventORM.tenant_id == tenant_id)
                .order_by(OutboxEventORM.created_at, OutboxEventORM.event_id)
            ).scalars().all()
        return [
            {
                "event_id": row.event_id,
                "tenant_id": row.tenant_id,
                "event_type": row.event_type,
                "aggregate_type": row.aggregate_type,
                "aggregate_id": row.aggregate_id,
                "payload": _load(row.payload, {}),
                "trace_id": row.trace_id,
                "correlation_id": row.correlation_id,
                "causation_id": row.causation_id,
            }
            for row in rows
        ]
