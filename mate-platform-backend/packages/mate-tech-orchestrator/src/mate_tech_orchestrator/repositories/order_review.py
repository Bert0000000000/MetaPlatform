"""SQL-backed order review workflow for the v1.0 north-star journey.

The service intentionally owns the transaction boundary.  An approved
proposal updates the order, creates the follow-up task, records idempotency,
and appends audit/outbox events in one database transaction.  Search/RAG
consumers can be eventually consistent; the order write path cannot.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base, create_all, get_session
from mate_tech_orchestrator.api.schemas import validate_evidence_bundle
from mate_tech_orchestrator.order_review.config import resolve_order_review_threshold_cents
from mate_tech_orchestrator.order_review.evidence import (
    EvidenceUnavailable as OrderReviewEvidenceUnavailable,
)
from mate_tech_orchestrator.order_review.evidence import (
    OrderReviewEvidenceBuilder,
    OrderReviewFacts,
)
from mate_tech_orchestrator.order_review.ontology_catalog import OrderReviewOntologyCatalog


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


class _EvidenceSemanticMismatchError(ValueError):
    """Persisted evidence no longer describes the locked order snapshot."""


def _format_amount_cents(amount_cents: int) -> str:
    sign = "-" if amount_cents < 0 else ""
    yuan, cents = divmod(abs(amount_cents), 100)
    return f"{sign}¥{yuan:,}.{cents:02d}"


def _require_exact_evidence_value(*, name: str, actual: Any, expected: Any) -> None:
    if _json(actual) != _json(expected):
        raise _EvidenceSemanticMismatchError(f"evidence {name} does not match the locked order")


def _validate_confirmation_evidence_semantics(
    *,
    evidence: dict[str, Any],
    original_suggestion: dict[str, Any],
    tenant_id: str,
    proposal: ActionProposalORM,
    order: OrderORM,
    threshold_cents: int,
) -> None:
    """Reject a snapshot whose facts, graph, derivation, or action semantics were altered."""
    object_rid = f"ont.{tenant_id}.obj.crm.order.v1"
    action_rid = f"ont.{tenant_id}.act.order-review-confirm.v1"
    anchor_id = f"order-fact-anchor:{order.order_id}"
    object_node_id = f"object-type:{object_rid}"
    action_node_id = f"action-type:{action_rid}"
    expected_captured_at = _iso(proposal.created_at)
    _require_exact_evidence_value(
        name="captured_at",
        actual=evidence.get("captured_at"),
        expected=expected_captured_at,
    )

    expected_facts = [
        {
            "id": "fact.amount_cents",
            "field": "amount_cents",
            "label": "订单金额",
            "value": order.amount_cents,
            "display_value": _format_amount_cents(order.amount_cents),
            "source": "order_review_orders.amount_cents",
        },
        {
            "id": "fact.payment_status",
            "field": "payment_status",
            "label": "支付状态",
            "value": order.payment_status,
            "display_value": {"unpaid": "未支付", "paid": "已支付"}.get(
                order.payment_status, order.payment_status
            ),
            "source": "order_review_orders.payment_status",
        },
        {
            "id": "fact.review_status",
            "field": "review_status",
            "label": "复核状态",
            "value": order.review_status,
            "display_value": {"pending": "待复核", "approved": "已批准"}.get(
                order.review_status, order.review_status
            ),
            "source": "order_review_orders.review_status",
        },
        {
            "id": "fact.version",
            "field": "version",
            "label": "订单版本",
            "value": order.version,
            "display_value": f"v{order.version}",
            "source": "order_review_orders.version",
        },
    ]
    _require_exact_evidence_value(
        name="data",
        actual=evidence.get("data"),
        expected={
            "source": "order_review_orders",
            "captured_at": expected_captured_at,
            "facts": expected_facts,
        },
    )

    expected_ontology = {
        "source": "ontology_kernel",
        "model_rid": object_rid,
        "action_rid": action_rid,
        "graph": {
            "nodes": [
                {
                    "id": anchor_id,
                    "type": "transaction_anchor",
                    "label": f"订单 {order.order_id}",
                    "properties": {
                        "order_id": order.order_id,
                        "source": "order_review_orders",
                        "version": order.version,
                    },
                },
                {
                    "id": object_node_id,
                    "type": "object_type",
                    "label": "订单",
                    "properties": {"rid": object_rid, "version": "v1"},
                },
                {
                    "id": action_node_id,
                    "type": "action_type",
                    "label": "订单复核确认",
                    "properties": {
                        "rid": action_rid,
                        "action_type": "order_review_confirm",
                    },
                },
            ],
            "edges": [
                {
                    "id": "order-instance-of-model",
                    "source": anchor_id,
                    "target": object_node_id,
                    "label": "符合对象模型",
                },
                {
                    "id": "model-supports-action",
                    "source": object_node_id,
                    "target": action_node_id,
                    "label": "支持动作",
                },
            ],
        },
        "legend": {
            "transaction_anchor": "订单交易事实的语义锚点，不是已持久化的 Ontology Individual",
            "object_type": "来自 Ontology Kernel 的正式对象模型",
            "action_type": "来自 Ontology Kernel 的订单复核动作定义",
        },
    }
    _require_exact_evidence_value(
        name="ontology",
        actual=evidence.get("ontology"),
        expected=expected_ontology,
    )

    threshold_passed = order.amount_cents >= threshold_cents
    unpaid_passed = order.payment_status == "unpaid"
    expected_derivation = [
        {
            "id": "threshold",
            "label": f"订单金额 ≥ {_format_amount_cents(threshold_cents)}",
            "passed": threshold_passed,
            "fact_refs": ["fact.amount_cents"],
            "details": {"operator": ">=", "expected_cents": threshold_cents},
        },
        {
            "id": "unpaid",
            "label": "支付状态 = 未支付",
            "passed": unpaid_passed,
            "fact_refs": ["fact.payment_status"],
            "details": {"operator": "=", "expected": "unpaid"},
        },
        {
            "id": "eligible",
            "label": "满足订单复核条件",
            "passed": threshold_passed and unpaid_passed,
            "fact_refs": ["threshold", "unpaid"],
        },
    ]
    _require_exact_evidence_value(
        name="derivation",
        actual=evidence.get("derivation"),
        expected=expected_derivation,
    )

    recommendation = evidence.get("recommendation")
    if not isinstance(recommendation, dict):
        raise _EvidenceSemanticMismatchError("evidence recommendation is missing")
    expected_recommendation = {
        "action": "follow_up_payment",
        "title": "创建回款跟进单",
        "reason": (
            f"订单金额 {_format_amount_cents(order.amount_cents)} 且当前未支付，"
            "建议人工确认后创建回款跟进单。"
        ),
        "requires_confirmation": True,
        "derivation_refs": ["eligible"],
        "source_refs": [
            f"ontology://object-type/{object_rid}",
            f"ontology://action-type/{action_rid}",
            "policy://payment-follow-up-policy",
        ],
    }
    for key, expected_value in expected_recommendation.items():
        _require_exact_evidence_value(
            name=f"recommendation.{key}",
            actual=recommendation.get(key),
            expected=expected_value,
        )
    confidence = recommendation.get("confidence")
    if "confidence" in recommendation and (
        isinstance(confidence, bool)
        or not isinstance(confidence, (int, float))
        or not 0 <= confidence <= 1
    ):
        raise _EvidenceSemanticMismatchError("evidence recommendation confidence is invalid")
    original_confidence = original_suggestion.get("confidence")
    if (
        isinstance(original_confidence, bool)
        or not isinstance(original_confidence, (int, float))
        or not 0 <= float(original_confidence) <= 1
    ):
        if "confidence" in recommendation:
            raise _EvidenceSemanticMismatchError(
                "evidence recommendation confidence was not present in the original suggestion"
            )
    elif "confidence" not in recommendation or float(confidence) != float(original_confidence):
        raise _EvidenceSemanticMismatchError(
            "evidence recommendation confidence does not match the original suggestion"
        )
    if proposal.action_type != "order_review_confirm":
        raise _EvidenceSemanticMismatchError("proposal action type is not order_review_confirm")


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
        threshold_cents: int | None = None,
        evidence_builder: OrderReviewEvidenceBuilder | None = None,
        ontology_catalog: OrderReviewOntologyCatalog | None = None,
    ) -> None:
        self._proposal_ttl = proposal_ttl
        self.threshold_cents = resolve_order_review_threshold_cents(threshold_cents)
        self._evidence_builder = evidence_builder or OrderReviewEvidenceBuilder(
            threshold_cents=self.threshold_cents
        )
        if self._evidence_builder.threshold_cents != self.threshold_cents:
            raise ValueError("evidence builder threshold must match the order-review threshold")
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
    def _persisted_evidence(
        bundle: dict[str, Any],
        *,
        proposal_id: str,
        order_id: str,
        tenant_id: str,
        order_version: int,
        captured_at: datetime,
    ) -> dict[str, Any]:
        evidence = deepcopy(bundle)
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
    def _evidence_refs(
        evidence: dict[str, Any] | None,
        *,
        proposal_id: str,
    ) -> dict[str, Any]:
        """Return the compact, exact evidence reference contract used by events."""
        validated = validate_evidence_bundle(evidence)
        if validated is None:
            return {
                "evidence_schema_version": None,
                "fact_ids": [],
                "graph_node_ids": [],
                "order_version": None,
                "proposal_id": proposal_id,
            }
        normalized = validated.model_dump(mode="json", exclude_none=True)
        facts = normalized["data"]["facts"]
        nodes = normalized["ontology"]["graph"]["nodes"]
        return {
            "evidence_schema_version": normalized["schema_version"],
            "fact_ids": [
                str(fact.get("id"))
                for fact in facts
                if isinstance(fact, dict) and isinstance(fact.get("id"), str)
            ],
            "graph_node_ids": [
                str(node.get("id"))
                for node in nodes
                if isinstance(node, dict) and isinstance(node.get("id"), str)
            ],
            "order_version": normalized["order_version"],
            "proposal_id": proposal_id,
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
        tenant_id: str,
        proposal: ActionProposalORM,
        order: OrderORM,
    ) -> dict[str, Any]:
        evidence = self._evidence_from_case(case)
        if evidence is None or validate_evidence_bundle(evidence) is None:
            raise self.EvidenceRequired("evidence bundle is required before confirmation")
        if evidence.get("status") != "complete":
            raise self.EvidenceUnavailable("evidence bundle must be complete before confirmation")
        if (
            evidence.get("tenant_id") != tenant_id
            or evidence.get("proposal_id") != proposal.proposal_id
            or evidence.get("order_id") != order.order_id
        ):
            raise self.EvidenceRequired("evidence bundle does not match the action proposal")
        if evidence.get("order_version") != order.version:
            raise self.VersionConflict(
                f"order version changed: expected evidence {evidence.get('order_version')}, got {order.version}"
            )
        ontology = evidence.get("ontology")
        expected_model_rid = f"ont.{tenant_id}.obj.crm.order.v1"
        expected_action_rid = f"ont.{tenant_id}.act.order-review-confirm.v1"
        if (
            not isinstance(ontology, dict)
            or ontology.get("source") != "ontology_kernel"
            or ontology.get("model_rid") != expected_model_rid
            or ontology.get("action_rid") != expected_action_rid
        ):
            raise self.EvidenceRequired("evidence bundle does not match the tenant ontology")
        nodes = ontology.get("graph", {}).get("nodes", [])
        anchors = [
            node
            for node in nodes
            if isinstance(node, dict) and node.get("type") == "transaction_anchor"
        ]
        anchor_properties = anchors[0].get("properties") if len(anchors) == 1 else None
        if (
            not isinstance(anchor_properties, dict)
            or anchor_properties.get("order_id") != order.order_id
            or anchor_properties.get("source") != "order_review_orders"
            or anchor_properties.get("version") != order.version
        ):
            raise self.EvidenceRequired("evidence transaction anchor does not match the order")
        recommendation = evidence.get("recommendation")
        if (
            not isinstance(recommendation, dict)
            or recommendation.get("action") != "follow_up_payment"
            or recommendation.get("requires_confirmation") is not True
        ):
            raise self.EvidenceRequired("evidence bundle does not permit confirmation")
        try:
            suggestion = _load(case.suggestion, {}) if case is not None else {}
            _validate_confirmation_evidence_semantics(
                evidence=evidence,
                original_suggestion=suggestion if isinstance(suggestion, dict) else {},
                tenant_id=tenant_id,
                proposal=proposal,
                order=order,
                threshold_cents=self.threshold_cents,
            )
        except _EvidenceSemanticMismatchError as error:
            raise self.EvidenceRequired(str(error)) from error
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

    def effective_threshold_cents(self, min_amount_cents: int | None = None) -> int:
        if min_amount_cents is None:
            return self.threshold_cents
        if isinstance(min_amount_cents, bool) or min_amount_cents <= 0:
            raise ValueError("min_amount_cents must be a positive integer")
        return max(self.threshold_cents, min_amount_cents)

    def list_high_value_unpaid(
        self, *, tenant_id: str, min_amount_cents: int | None = None
    ) -> list[dict[str, Any]]:
        self._ensure_schema()
        effective_threshold_cents = self.effective_threshold_cents(min_amount_cents)
        with get_session() as session:
            rows = (
                session.execute(
                    select(OrderORM)
                    .where(
                        OrderORM.tenant_id == tenant_id,
                        OrderORM.payment_status == "unpaid",
                        OrderORM.review_status == "pending",
                        OrderORM.amount_cents >= effective_threshold_cents,
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
            if order_snapshot.amount_cents < self.threshold_cents:
                raise self.EvidenceUnavailable(
                    f"order amount is below the review threshold: {order_id}"
                )
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
                        **self._evidence_refs(evidence, proposal_id=proposal_id),
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

    @staticmethod
    def _locked_proposal(
        session: Any,
        *,
        tenant_id: str,
        proposal_id: str,
    ) -> ActionProposalORM | None:
        return session.execute(
            select(ActionProposalORM)
            .where(
                ActionProposalORM.tenant_id == tenant_id,
                ActionProposalORM.proposal_id == proposal_id,
            )
            .with_for_update()
        ).scalar_one_or_none()

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

    def _flush_idempotency_record(self, session: Any, *, key: str) -> None:
        try:
            session.flush()
        except IntegrityError as error:
            if "order_review_idempotency_records" not in str(error):
                raise
            raise self.IdempotencyConflict(f"idempotency key already used: {key}") from error

    @staticmethod
    def _lock_idempotency_key(session: Any, *, tenant_id: str, key: str) -> None:
        """Serialize a tenant-scoped idempotency key on PostgreSQL only."""
        if session.get_bind().dialect.name != "postgresql":
            return
        digest = hashlib.sha256(f"{tenant_id}\x00{key}".encode()).digest()
        lock_key = int.from_bytes(digest[:8], byteorder="big", signed=True)
        session.execute(
            text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": lock_key},
        )

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
        expiration_error: Exception | None = None
        response: dict[str, Any] | None = None
        with get_session() as session, session.begin():
            proposal = self._locked_proposal(
                session,
                tenant_id=tenant_id,
                proposal_id=proposal_id,
            )
            if proposal is None:
                raise self.NotFound(f"action proposal not found: {proposal_id}")
            self._lock_idempotency_key(
                session,
                tenant_id=tenant_id,
                key=idempotency_key,
            )
            previous = self._existing_idempotency(
                session,
                tenant_id=tenant_id,
                key=idempotency_key,
                operation="confirm",
                proposal_id=proposal_id,
            )
            if previous is not None:
                return previous
            if proposal.status != "pending":
                raise self.AlreadyResolved(f"action proposal is {proposal.status}: {proposal_id}")
            now = _now()
            if _aware(proposal.expires_at) <= now:
                proposal.status = "expired"
                proposal.resolved_at = now
                expiration_error = self.Conflict(f"action proposal expired: {proposal_id}")
            else:
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
                    tenant_id=tenant_id,
                    proposal=proposal,
                    order=order,
                )
                if order.version != proposal.expected_order_version:
                    raise self.VersionConflict(
                        f"order version changed: expected {proposal.expected_order_version}, got {order.version}"
                    )
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
                self._flush_idempotency_record(session, key=idempotency_key)
                session.add(
                    self._event(
                        tenant_id=tenant_id,
                        event_type="order.review.confirmed",
                        aggregate_type="order",
                        aggregate_id=order.order_id,
                        payload={
                            **response,
                            "result_order_version": next_version,
                            "actor_id": actor_id,
                            **self._evidence_refs(evidence, proposal_id=proposal_id),
                        },
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
                            "result_order_version": next_version,
                            **self._evidence_refs(evidence, proposal_id=proposal_id),
                        },
                        trace_id=trace_id,
                        correlation_id=proposal_id,
                    )
                )
        if expiration_error is not None:
            raise expiration_error
        if response is None:
            raise RuntimeError("confirmation transaction produced no response")
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
        expiration_error: Exception | None = None
        response: dict[str, Any] | None = None
        with get_session() as session, session.begin():
            proposal = self._locked_proposal(
                session,
                tenant_id=tenant_id,
                proposal_id=proposal_id,
            )
            if proposal is None:
                raise self.NotFound(f"action proposal not found: {proposal_id}")
            self._lock_idempotency_key(
                session,
                tenant_id=tenant_id,
                key=idempotency_key,
            )
            previous = self._existing_idempotency(
                session,
                tenant_id=tenant_id,
                key=idempotency_key,
                operation="reject",
                proposal_id=proposal_id,
            )
            if previous is not None:
                return previous
            if proposal.status != "pending":
                raise self.AlreadyResolved(f"action proposal is {proposal.status}: {proposal_id}")
            now = _now()
            if _aware(proposal.expires_at) <= now:
                proposal.status = "expired"
                proposal.resolved_at = now
                expiration_error = self.Conflict(f"action proposal expired: {proposal_id}")
            else:
                proposal.status = "rejected"
                proposal.resolved_at = now
                case = session.get(ReviewCaseORM, (tenant_id, proposal.review_case_id))
                if case is not None:
                    case.status = "rejected"
                evidence = self._evidence_from_case(case)
                response = {
                    "proposal_id": proposal_id,
                    "order_id": proposal.order_id,
                    "status": "rejected",
                    "reason": reason,
                }
                session.add(
                    IdempotencyRecordORM(
                        tenant_id=tenant_id,
                        idempotency_key=idempotency_key,
                        operation="reject",
                        proposal_id=proposal_id,
                        response=_json(response),
                    )
                )
                self._flush_idempotency_record(session, key=idempotency_key)
                session.add(
                    self._event(
                        tenant_id=tenant_id,
                        event_type="audit.action_proposal.rejected",
                        aggregate_type="action_proposal",
                        aggregate_id=proposal_id,
                        payload={
                            "actor_id": actor_id,
                            "reason": reason,
                            **self._evidence_refs(evidence, proposal_id=proposal_id),
                        },
                        trace_id=trace_id,
                        correlation_id=proposal_id,
                    )
                )
        if expiration_error is not None:
            raise expiration_error
        if response is None:
            raise RuntimeError("rejection transaction produced no response")
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
