"""SQL-backed order review workflow for the v1.0 north-star journey.

The service intentionally owns the transaction boundary.  An approved
proposal updates the order, creates the follow-up task, records idempotency,
and appends audit/outbox events in one database transaction.  Search/RAG
consumers can be eventually consistent; the order write path cannot.
"""

from __future__ import annotations

import json
import uuid
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text, select, update
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base, create_all, get_session
from mate_tech_orchestrator.api.schemas import validate_evidence_bundle
from mate_tech_orchestrator.order_review.evidence import (
    EvidenceUnavailable as OrderReviewEvidenceUnavailable,
)
from mate_tech_orchestrator.order_review.evidence import (
    OrderReviewEvidenceBuilder,
    OrderReviewFacts,
)
from mate_tech_orchestrator.order_review.ontology_catalog import OrderReviewOntologyCatalog

_EVIDENCE_FACT_METADATA: dict[str, tuple[str, str]] = {
    "fact.amount_cents": ("amount_cents", "订单金额"),
    "fact.payment_status": ("payment_status", "支付状态"),
    "fact.review_status": ("review_status", "复核状态"),
    "fact.version": ("version", "订单版本"),
}


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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )


class ReviewCaseORM(Base):
    __tablename__ = "order_review_cases"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    review_case_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    suggestion: Mapped[str] = mapped_column(Text, nullable=False)
    source_refs: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )


class ActionProposalORM(Base):
    __tablename__ = "order_review_action_proposals"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    proposal_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    review_case_id: Mapped[str] = mapped_column(String(128), nullable=False)
    order_id: Mapped[str] = mapped_column(String(128), nullable=False)
    action_type: Mapped[str] = mapped_column(
        String(64), nullable=False, default="order_review_confirm"
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    expected_order_version: Mapped[int] = mapped_column(Integer, nullable=False)
    parameters: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )


class IdempotencyRecordORM(Base):
    __tablename__ = "order_review_idempotency_records"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(256), primary_key=True)
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    proposal_id: Mapped[str] = mapped_column(String(128), nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )


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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )


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

    class EvidenceRequiredError(ConflictError):
        pass

    # Short aliases keep the service call sites readable and preserve the
    # domain names used by the API adapter/tests.
    NotFound = NotFoundError
    Conflict = ConflictError
    VersionConflict = VersionConflictError
    AlreadyResolved = AlreadyResolvedError
    IdempotencyConflict = IdempotencyConflictError
    EvidenceUnavailable = OrderReviewEvidenceUnavailable
    EvidenceRequired = EvidenceRequiredError

    def __init__(
        self,
        *,
        proposal_ttl: timedelta = timedelta(hours=24),
        evidence_builder: OrderReviewEvidenceBuilder | None = None,
        ontology_catalog: OrderReviewOntologyCatalog | None = None,
    ) -> None:
        self._proposal_ttl = proposal_ttl
        self._evidence_builder = evidence_builder or OrderReviewEvidenceBuilder()
        self._ontology_catalog = ontology_catalog or OrderReviewOntologyCatalog()

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
            suggestion = _load(case.suggestion, {})
            result["suggestion"] = suggestion
            result["source_refs"] = _load(case.source_refs, [])
            result["evidence"] = (
                suggestion.get("evidence_bundle") if isinstance(suggestion, dict) else None
            )
        return result

    @staticmethod
    def _order_facts(row: OrderORM) -> OrderReviewFacts:
        return OrderReviewFacts(
            tenant_id=row.tenant_id,
            order_id=row.order_id,
            amount_cents=row.amount_cents,
            payment_status=row.payment_status,
            review_status=row.review_status,
            version=row.version,
            updated_at=_aware(row.updated_at),
        )

    @staticmethod
    def _fact_metadata(fact_id: str) -> tuple[str, str]:
        field, label = _EVIDENCE_FACT_METADATA.get(fact_id, ("", ""))
        if field:
            return field, label
        derived = fact_id.removeprefix("fact.").strip() or fact_id.strip()
        return derived, derived

    @classmethod
    def _persisted_evidence(
        cls,
        bundle: dict[str, Any],
        *,
        proposal_id: str,
        order_id: str,
        tenant_id: str,
        order_version: int,
        captured_at: datetime,
    ) -> dict[str, Any]:
        evidence = deepcopy(bundle)
        data = evidence.get("data")
        if isinstance(data, dict):
            facts = data.get("facts")
            if isinstance(facts, list):
                data["facts"] = [
                    {
                        **fact,
                        "field": cls._fact_metadata(str(fact.get("id", "")))[0],
                        "label": cls._fact_metadata(str(fact.get("id", "")))[1],
                    }
                    for fact in facts
                    if isinstance(fact, dict)
                ]
        evidence.update(
            {
                "proposal_id": proposal_id,
                "order_id": order_id,
                "tenant_id": tenant_id,
                "order_version": order_version,
                "captured_at": _iso(captured_at),
            }
        )
        return evidence

    @staticmethod
    def _evidence_source_refs(evidence: dict[str, Any]) -> list[str]:
        recommendation = evidence.get("recommendation")
        if not isinstance(recommendation, dict):
            return []
        source_refs = recommendation.get("source_refs")
        if not isinstance(source_refs, list):
            return []
        return [str(item) for item in source_refs if isinstance(item, str)]

    @staticmethod
    def _evidence_refs(evidence: dict[str, Any]) -> dict[str, Any]:
        facts = evidence.get("data", {}).get("facts", [])
        nodes = evidence.get("ontology", {}).get("graph", {}).get("nodes", [])
        return {
            "evidence_schema_version": evidence.get("schema_version"),
            "evidence_order_version": evidence.get("order_version"),
            "evidence_fact_ids": [
                str(fact.get("id"))
                for fact in facts
                if isinstance(fact, dict) and isinstance(fact.get("id"), str)
            ],
            "evidence_graph_node_ids": [
                str(node.get("id"))
                for node in nodes
                if isinstance(node, dict) and isinstance(node.get("id"), str)
            ],
        }

    @staticmethod
    def _evidence_from_case(case: ReviewCaseORM | None) -> dict[str, Any] | None:
        if case is None:
            return None
        suggestion = _load(case.suggestion, {})
        if not isinstance(suggestion, dict):
            return None
        evidence = suggestion.get("evidence_bundle")
        return evidence if isinstance(evidence, dict) else None

    def _require_confirmation_evidence(
        self,
        *,
        case: ReviewCaseORM | None,
        current_order_version: int,
    ) -> dict[str, Any]:
        evidence = self._evidence_from_case(case)
        if evidence is None or validate_evidence_bundle(evidence) is None:
            raise self.EvidenceRequired("evidence bundle is required before confirmation")
        if evidence.get("status") != "complete":
            raise self.EvidenceUnavailable("evidence bundle must be complete before confirmation")
        if evidence.get("order_version") != current_order_version:
            raise self.VersionConflict(
                f"order version changed: expected evidence {evidence.get('order_version')}, got {current_order_version}"
            )
        recommendation = evidence.get("recommendation")
        if (
            not isinstance(recommendation, dict)
            or recommendation.get("requires_confirmation") is not True
        ):
            raise self.EvidenceRequired("evidence bundle does not permit confirmation")
        return evidence

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

    def list_high_value_unpaid(
        self, *, tenant_id: str, min_amount_cents: int
    ) -> list[dict[str, Any]]:
        self._ensure_schema()
        with get_session() as session:
            rows = (
                session.execute(
                    select(OrderORM)
                    .where(
                        OrderORM.tenant_id == tenant_id,
                        OrderORM.payment_status == "unpaid",
                        OrderORM.review_status == "pending",
                        OrderORM.amount_cents >= min_amount_cents,
                    )
                    .order_by(OrderORM.amount_cents.desc(), OrderORM.order_id)
                )
                .scalars()
                .all()
            )
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
        auth_token: str = "",
        trace_id: str = "",
    ) -> dict[str, Any]:
        self._ensure_schema()
        case_id = f"case_{uuid.uuid4().hex}"
        proposal_id = f"proposal_{uuid.uuid4().hex}"
        now = _now()
        with get_session() as session:
            order_snapshot = session.get(OrderORM, (tenant_id, order_id))
            if order_snapshot is None:
                raise self.NotFound(f"order not found: {order_id}")
            if order_snapshot.payment_status != "unpaid":
                raise self.Conflict(f"order is not unpaid: {order_id}")
            if order_snapshot.review_status != "pending":
                raise self.Conflict(f"order review is not pending: {order_id}")
            facts = self._order_facts(order_snapshot)
        contract = self._ontology_catalog.get_contract(tenant_id=tenant_id, token=auth_token)
        evidence = self._persisted_evidence(
            self._evidence_builder.build(
                facts=facts,
                contract=contract,
                requested_suggestion=suggestion,
                now=now,
            ),
            proposal_id=proposal_id,
            order_id=order_id,
            tenant_id=tenant_id,
            order_version=facts.version,
            captured_at=now,
        )
        normalized_source_refs = self._evidence_source_refs(evidence)
        stored_suggestion = dict(suggestion)
        stored_suggestion["evidence_bundle"] = evidence
        with get_session() as session, session.begin():
            order = session.execute(
                select(OrderORM)
                .where(OrderORM.tenant_id == tenant_id, OrderORM.order_id == order_id)
                .with_for_update()
            ).scalar_one_or_none()
            if order is None:
                raise self.NotFound(f"order not found: {order_id}")
            if order.review_status != "pending":
                raise self.Conflict(f"order review is not pending: {order_id}")
            if (
                order.amount_cents != facts.amount_cents
                or order.payment_status != facts.payment_status
                or order.review_status != facts.review_status
                or order.version != facts.version
            ):
                raise self.VersionConflict("order facts changed before proposal creation")
            case = ReviewCaseORM(
                tenant_id=tenant_id,
                review_case_id=case_id,
                order_id=order_id,
                status="open",
                suggestion=_json(stored_suggestion),
                source_refs=_json(normalized_source_refs),
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
            session.add(
                self._event(
                    tenant_id=tenant_id,
                    event_type="order.review.proposal_created",
                    aggregate_type="action_proposal",
                    aggregate_id=proposal_id,
                    payload={
                        "order_id": order_id,
                        "review_case_id": case_id,
                        "source_refs": normalized_source_refs,
                        **self._evidence_refs(evidence),
                    },
                    trace_id=trace_id,
                )
            )
        return {
            "review_case_id": case_id,
            "proposal_id": proposal_id,
            "status": "pending",
            "expected_order_version": order.version,
            "evidence": evidence,
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
        self,
        session: Any,
        *,
        tenant_id: str,
        key: str,
        operation: str,
        proposal_id: str,
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
            case = session.get(ReviewCaseORM, (tenant_id, proposal.review_case_id))
            evidence = self._require_confirmation_evidence(
                case=case,
                current_order_version=order.version,
            )
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
            session.add(
                IdempotencyRecordORM(
                    tenant_id=tenant_id,
                    idempotency_key=idempotency_key,
                    operation="confirm",
                    proposal_id=proposal_id,
                    response=_json(response),
                )
            )
            session.add(
                self._event(
                    tenant_id=tenant_id,
                    event_type="order.review.confirmed",
                    aggregate_type="order",
                    aggregate_id=order.order_id,
                    payload={**response, "actor_id": actor_id, **self._evidence_refs(evidence)},
                    trace_id=trace_id,
                    correlation_id=proposal_id,
                )
            )
            session.add(
                self._event(
                    tenant_id=tenant_id,
                    event_type="audit.action_proposal.confirmed",
                    aggregate_type="action_proposal",
                    aggregate_id=proposal_id,
                    payload={
                        "actor_id": actor_id,
                        "order_id": order.order_id,
                        "idempotency_key": idempotency_key,
                        **self._evidence_refs(evidence),
                    },
                    trace_id=trace_id,
                    correlation_id=proposal_id,
                )
            )
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
            evidence = self._evidence_from_case(case)
            response = {"proposal_id": proposal_id, "status": "rejected", "reason": reason}
            session.add(
                IdempotencyRecordORM(
                    tenant_id=tenant_id,
                    idempotency_key=idempotency_key,
                    operation="reject",
                    proposal_id=proposal_id,
                    response=_json(response),
                )
            )
            session.add(
                self._event(
                    tenant_id=tenant_id,
                    event_type="audit.action_proposal.rejected",
                    aggregate_type="action_proposal",
                    aggregate_id=proposal_id,
                    payload={
                        "actor_id": actor_id,
                        "reason": reason,
                        **(self._evidence_refs(evidence) if evidence is not None else {}),
                    },
                    trace_id=trace_id,
                    correlation_id=proposal_id,
                )
            )
        return response

    def list_follow_up_tasks(self, *, tenant_id: str) -> list[dict[str, Any]]:
        self._ensure_schema()
        with get_session() as session:
            rows = (
                session.execute(
                    select(FollowUpTaskORM)
                    .where(FollowUpTaskORM.tenant_id == tenant_id)
                    .order_by(FollowUpTaskORM.created_at)
                )
                .scalars()
                .all()
            )
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
            rows = (
                session.execute(
                    select(OutboxEventORM)
                    .where(OutboxEventORM.tenant_id == tenant_id)
                    .order_by(OutboxEventORM.created_at, OutboxEventORM.event_id)
                )
                .scalars()
                .all()
            )
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
