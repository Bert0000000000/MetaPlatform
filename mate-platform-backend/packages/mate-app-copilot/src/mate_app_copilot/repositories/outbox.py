"""SQL-backed outbox implementation for Copilot's durable audit boundary."""
from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import OutboxError, OutboxRecord
from mate_tech_db.base import get_session

from .sql_models import OutboxEventORM


def _session() -> Session:
    return get_session()


def _lineage_hints_payload(value: object | None) -> dict[str, object] | None:
    if value is None:
        return None
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, dict):
        return dict(value)
    raise OutboxError("lineage hints must be a mapping or dataclass")


def _aggregate_type(event_type: str) -> str:
    return event_type.split(".", 1)[0]


def _record(row: OutboxEventORM) -> OutboxRecord:
    return OutboxRecord(
        event=Event.from_dict(
            {
                "id": row.id,
                "type": row.event_type,
                "tenant_id": row.tenant_id,
                "aggregate_id": row.aggregate_id,
                "occurred_at": row.occurred_at,
                "trace_id": row.trace_id,
                "payload": row.payload,
                "lineage_hints": row.lineage_hints,
            }
        ),
        published=row.status == "published",
        attempts=row.retry_count,
        last_error=row.last_error,
    )


class SqlOutboxWriter:
    """Persist outbox events in the same database used by Copilot state."""

    def append(self, event: Event) -> None:
        if not event.tenant_id:
            raise OutboxError("event has no tenant_id; refusing durable outbox append")
        session = _session()
        try:
            if session.get(OutboxEventORM, event.id) is not None:
                return
            session.add(
                OutboxEventORM(
                    id=event.id,
                    tenant_id=event.tenant_id,
                    aggregate_type=_aggregate_type(event.type),
                    aggregate_id=event.aggregate_id,
                    event_type=event.type,
                    payload=dict(event.payload),
                    lineage_hints=_lineage_hints_payload(event.lineage_hints),
                    occurred_at=event.occurred_at,
                    trace_id=event.trace_id,
                    retry_count=0,
                    status="pending",
                    last_error="",
                )
            )
            session.commit()
        except Exception as exc:
            session.rollback()
            raise OutboxError("durable outbox append failed") from exc
        finally:
            session.close()

    def fetch_pending(self, *, limit: int = 100) -> list[OutboxRecord]:
        session = _session()
        try:
            rows = session.execute(
                select(OutboxEventORM)
                .where(OutboxEventORM.status == "pending")
                .order_by(OutboxEventORM.created_at, OutboxEventORM.id)
                .limit(limit)
            ).scalars().all()
            return [_record(row) for row in rows]
        finally:
            session.close()

    def mark_published(self, event_id: str) -> None:
        self._mark(event_id, status="published", error="")

    def mark_attempt_failed(self, event_id: str, error: str) -> None:
        self._mark(event_id, status="pending", error=error, increment_attempt=True)

    def _mark(
        self,
        event_id: str,
        *,
        status: str,
        error: str,
        increment_attempt: bool = False,
    ) -> None:
        session = _session()
        try:
            row = session.get(OutboxEventORM, event_id)
            if row is None:
                raise OutboxError(f"event {event_id!r} not in outbox")
            row.status = status
            row.last_error = error
            row.processed_at = datetime.now(UTC)
            if increment_attempt:
                row.retry_count += 1
            session.commit()
        except OutboxError:
            session.rollback()
            raise
        except Exception as exc:
            session.rollback()
            raise OutboxError("durable outbox update failed") from exc
        finally:
            session.close()
