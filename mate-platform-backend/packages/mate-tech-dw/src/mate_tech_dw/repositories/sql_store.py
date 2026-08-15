"""SQL-backed repository for the digital workforce domain (P3-W3 TD-5).

Provides read + write for all 14 dw entities plus the employee
conversation / message pair. Function names + signatures mirror
``in_memory`` one-to-one so the factory in ``repositories/__init__.py``
can swap backends with zero API-layer changes (DW_STORE=memory|sql).

The tuple fields (``DwEmployee.kb_ids`` / ``.tools`` / ``.action_rids``)
are serialised as newline-separated TEXT on write and re-hydrated to a
tuple on read.
"""
from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import (
    DwAuthLogin,
    DwCollaboration,
    DwCommit,
    DwDocument,
    DwEmployee,
    DwEmployeeConversation,
    DwEmployeeMessage,
    DwEmployeeTask,
    DwEvaluation,
    DwExtract,
    DwKnowledgeBase,
    DwLearningExtract,
    DwLearningFeedback,
    DwModel,
    DwTool,
    DwTrace,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _session() -> Session:
    return get_session()


def _split_lines(text: str) -> tuple[str, ...]:
    """Split a newline-separated TEXT column back into a tuple."""
    if not text:
        return ()
    return tuple(s for s in text.split("\n") if s.strip())


def _join_lines(items: tuple[str, ...]) -> str:
    """Join a tuple into a newline-separated TEXT value."""
    return "\n".join(items) if items else ""


# ---------------------------------------------------------------------------
# ORM -> dataclass converters (14 entities)
# ---------------------------------------------------------------------------
def _orm_to_auth_login(row: models.DwAuthLoginORM) -> DwAuthLogin:
    return DwAuthLogin(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        login_at=row.login_at or "",
        ip=row.ip or "",
        status=row.status or "success",
    )


def _orm_to_collaboration(row: models.DwCollaborationORM) -> DwCollaboration:
    return DwCollaboration(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        peer_employee_id=row.peer_employee_id or "",
        session_id=row.session_id or "",
        started_at=row.started_at or "",
        duration_ms=row.duration_ms,
    )


def _orm_to_commit(row: models.DwCommitORM) -> DwCommit:
    return DwCommit(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        scope=row.scope or "",
        target_id=row.target_id or "",
        summary=row.summary or "",
        committed_at=row.committed_at or "",
    )


def _orm_to_document(row: models.DwDocumentORM) -> DwDocument:
    return DwDocument(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        kind=row.kind or "",
        size_bytes=row.size_bytes,
        uploaded_by=row.uploaded_by or "",
        uploaded_at=row.uploaded_at or "",
        kb_id=row.kb_id or "",
        document_id=row.document_id or "",
        chunk_count=row.chunk_count or 0,
    )


def _orm_to_employee(row: models.DwEmployeeORM) -> DwEmployee:
    return DwEmployee(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        code=row.code or "",
        role=row.role or "",
        status=row.status or "active",
        model_id=row.model_id or "",
        kb_ids=_split_lines(row.kb_ids or ""),
        is_builtin=bool(row.is_builtin),
        system_prompt=row.system_prompt or "",
        tools=_split_lines(row.tools or ""),
        action_rids=_split_lines(row.action_rids or ""),
        temperature=float(row.temperature if row.temperature is not None else 0.7),
        max_tokens=int(row.max_tokens if row.max_tokens is not None else 4096),
        top_p=float(row.top_p if row.top_p is not None else 0.9),
        retrieval_method=row.retrieval_method or "hybrid",
        top_k=int(row.top_k if row.top_k is not None else 5),
        rerank=bool(row.rerank),
    )


def _orm_to_employee_task(row: models.DwEmployeeTaskORM) -> DwEmployeeTask:
    return DwEmployeeTask(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        title=row.title or "",
        status=row.status or "pending",
        started_at=row.started_at or "",
        finished_at=row.finished_at if row.finished_at else None,
        duration_ms=row.duration_ms,
    )


def _orm_to_evaluation(row: models.DwEvaluationORM) -> DwEvaluation:
    return DwEvaluation(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        qa_set_id=row.qa_set_id or "",
        score=row.score,
        passed=row.passed,
        evaluated_at=row.evaluated_at or "",
    )


def _orm_to_extract(row: models.DwExtractORM) -> DwExtract:
    return DwExtract(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        source=row.source or "",
        source_id=row.source_id or "",
        extracted_facts=row.extracted_facts,
        extracted_at=row.extracted_at or "",
    )


def _orm_to_knowledge_base(row: models.DwKnowledgeBaseORM) -> DwKnowledgeBase:
    return DwKnowledgeBase(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        code=row.code or "",
        docs=row.docs,
        vectors=row.vectors,
        owner=row.owner or "",
        updated_at=row.updated_at or "",
    )


def _orm_to_learning_extract(row: models.DwLearningExtractORM) -> DwLearningExtract:
    return DwLearningExtract(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        scenario=row.scenario or "",
        extracted_at=row.extracted_at or "",
        facts=row.facts,
    )


def _orm_to_learning_feedback(row: models.DwLearningFeedbackORM) -> DwLearningFeedback:
    return DwLearningFeedback(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        scenario=row.scenario or "",
        rating=row.rating,
        comment=row.comment or "",
        feedback_at=row.feedback_at or "",
        promoted_document_id=row.promoted_document_id or "",
        promoted_at=row.promoted_at or "",
    )


def _orm_to_model(row: models.DwModelORM) -> DwModel:
    return DwModel(
        id=row.id,
        tenant_id=row.tenant_id,
        provider=row.provider or "",
        model_id=row.model_id or "",
        display_name=row.display_name or "",
        modality=row.modality or "text",
        enabled=row.enabled,
    )


def _orm_to_tool(row: models.DwToolORM) -> DwTool:
    return DwTool(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        code=row.code or "",
        kind=row.kind or "",
        enabled=row.enabled,
        invocations=row.invocations,
    )


def _orm_to_trace(row: models.DwTraceORM) -> DwTrace:
    return DwTrace(
        id=row.id,
        tenant_id=row.tenant_id,
        employee_id=row.employee_id or "",
        trace_id=row.trace_id or "",
        span_count=row.span_count,
        status=row.status or "ok",
        duration_ms=row.duration_ms,
        started_at=row.started_at or "",
    )


# ---------------------------------------------------------------------------
# Read API — 14 entities (list + get, tenant-scoped)
# ---------------------------------------------------------------------------
def list_auth_logins(tenant_id: str) -> list[DwAuthLogin]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwAuthLoginORM)
        .where(models.DwAuthLoginORM.tenant_id == tenant_id)
        .order_by(models.DwAuthLoginORM.id)
    ).scalars().all()
    return [_orm_to_auth_login(r) for r in rows]


def get_auth_login(tenant_id: str, entity_id: str) -> DwAuthLogin | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwAuthLoginORM).where(
            models.DwAuthLoginORM.tenant_id == tenant_id,
            models.DwAuthLoginORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_auth_login(row) if row else None


def list_collaborations(tenant_id: str) -> list[DwCollaboration]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwCollaborationORM)
        .where(models.DwCollaborationORM.tenant_id == tenant_id)
        .order_by(models.DwCollaborationORM.id)
    ).scalars().all()
    return [_orm_to_collaboration(r) for r in rows]


def get_collaboration(tenant_id: str, entity_id: str) -> DwCollaboration | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwCollaborationORM).where(
            models.DwCollaborationORM.tenant_id == tenant_id,
            models.DwCollaborationORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_collaboration(row) if row else None


def list_commits(tenant_id: str) -> list[DwCommit]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwCommitORM)
        .where(models.DwCommitORM.tenant_id == tenant_id)
        .order_by(models.DwCommitORM.id)
    ).scalars().all()
    return [_orm_to_commit(r) for r in rows]


def get_commit(tenant_id: str, entity_id: str) -> DwCommit | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwCommitORM).where(
            models.DwCommitORM.tenant_id == tenant_id,
            models.DwCommitORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_commit(row) if row else None


def list_documents(tenant_id: str) -> list[DwDocument]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwDocumentORM)
        .where(models.DwDocumentORM.tenant_id == tenant_id)
        .order_by(models.DwDocumentORM.id)
    ).scalars().all()
    return [_orm_to_document(r) for r in rows]


def get_document(tenant_id: str, entity_id: str) -> DwDocument | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwDocumentORM).where(
            models.DwDocumentORM.tenant_id == tenant_id,
            models.DwDocumentORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_document(row) if row else None


def list_employees(tenant_id: str) -> list[DwEmployee]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwEmployeeORM)
        .where(models.DwEmployeeORM.tenant_id == tenant_id)
        .order_by(models.DwEmployeeORM.id)
    ).scalars().all()
    return [_orm_to_employee(r) for r in rows]


def get_employee(tenant_id: str, entity_id: str) -> DwEmployee | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwEmployeeORM).where(
            models.DwEmployeeORM.tenant_id == tenant_id,
            models.DwEmployeeORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_employee(row) if row else None


def list_employee_tasks(tenant_id: str) -> list[DwEmployeeTask]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwEmployeeTaskORM)
        .where(models.DwEmployeeTaskORM.tenant_id == tenant_id)
        .order_by(models.DwEmployeeTaskORM.id)
    ).scalars().all()
    return [_orm_to_employee_task(r) for r in rows]


def get_employee_task(tenant_id: str, entity_id: str) -> DwEmployeeTask | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwEmployeeTaskORM).where(
            models.DwEmployeeTaskORM.tenant_id == tenant_id,
            models.DwEmployeeTaskORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_employee_task(row) if row else None


def list_evaluations(tenant_id: str) -> list[DwEvaluation]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwEvaluationORM)
        .where(models.DwEvaluationORM.tenant_id == tenant_id)
        .order_by(models.DwEvaluationORM.id)
    ).scalars().all()
    return [_orm_to_evaluation(r) for r in rows]


def get_evaluation(tenant_id: str, entity_id: str) -> DwEvaluation | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwEvaluationORM).where(
            models.DwEvaluationORM.tenant_id == tenant_id,
            models.DwEvaluationORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_evaluation(row) if row else None


def list_extracts(tenant_id: str) -> list[DwExtract]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwExtractORM)
        .where(models.DwExtractORM.tenant_id == tenant_id)
        .order_by(models.DwExtractORM.id)
    ).scalars().all()
    return [_orm_to_extract(r) for r in rows]


def get_extract(tenant_id: str, entity_id: str) -> DwExtract | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwExtractORM).where(
            models.DwExtractORM.tenant_id == tenant_id,
            models.DwExtractORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_extract(row) if row else None


def list_knowledge_bases(tenant_id: str) -> list[DwKnowledgeBase]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwKnowledgeBaseORM)
        .where(models.DwKnowledgeBaseORM.tenant_id == tenant_id)
        .order_by(models.DwKnowledgeBaseORM.id)
    ).scalars().all()
    return [_orm_to_knowledge_base(r) for r in rows]


def get_knowledge_base(tenant_id: str, entity_id: str) -> DwKnowledgeBase | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwKnowledgeBaseORM).where(
            models.DwKnowledgeBaseORM.tenant_id == tenant_id,
            models.DwKnowledgeBaseORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_knowledge_base(row) if row else None


def list_learning_extracts(tenant_id: str) -> list[DwLearningExtract]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwLearningExtractORM)
        .where(models.DwLearningExtractORM.tenant_id == tenant_id)
        .order_by(models.DwLearningExtractORM.id)
    ).scalars().all()
    return [_orm_to_learning_extract(r) for r in rows]


def get_learning_extract(tenant_id: str, entity_id: str) -> DwLearningExtract | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwLearningExtractORM).where(
            models.DwLearningExtractORM.tenant_id == tenant_id,
            models.DwLearningExtractORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_learning_extract(row) if row else None


def list_learning_feedback(tenant_id: str) -> list[DwLearningFeedback]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwLearningFeedbackORM)
        .where(models.DwLearningFeedbackORM.tenant_id == tenant_id)
        .order_by(models.DwLearningFeedbackORM.id)
    ).scalars().all()
    return [_orm_to_learning_feedback(r) for r in rows]


def get_learning_feedback(tenant_id: str, entity_id: str) -> DwLearningFeedback | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwLearningFeedbackORM).where(
            models.DwLearningFeedbackORM.tenant_id == tenant_id,
            models.DwLearningFeedbackORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_learning_feedback(row) if row else None


def list_models(tenant_id: str) -> list[DwModel]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwModelORM)
        .where(models.DwModelORM.tenant_id == tenant_id)
        .order_by(models.DwModelORM.id)
    ).scalars().all()
    return [_orm_to_model(r) for r in rows]


def get_model(tenant_id: str, entity_id: str) -> DwModel | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwModelORM).where(
            models.DwModelORM.tenant_id == tenant_id,
            models.DwModelORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_model(row) if row else None


def list_tools(tenant_id: str) -> list[DwTool]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwToolORM)
        .where(models.DwToolORM.tenant_id == tenant_id)
        .order_by(models.DwToolORM.id)
    ).scalars().all()
    return [_orm_to_tool(r) for r in rows]


def get_tool(tenant_id: str, entity_id: str) -> DwTool | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwToolORM).where(
            models.DwToolORM.tenant_id == tenant_id,
            models.DwToolORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_tool(row) if row else None


def list_traces(tenant_id: str) -> list[DwTrace]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwTraceORM)
        .where(models.DwTraceORM.tenant_id == tenant_id)
        .order_by(models.DwTraceORM.id)
    ).scalars().all()
    return [_orm_to_trace(r) for r in rows]


def get_trace(tenant_id: str, entity_id: str) -> DwTrace | None:
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwTraceORM).where(
            models.DwTraceORM.tenant_id == tenant_id,
            models.DwTraceORM.id == entity_id,
        )
    ).scalar_one_or_none()
    return _orm_to_trace(row) if row else None


# ---------------------------------------------------------------------------
# Write API — 14 entities (upsert)
# ---------------------------------------------------------------------------
def put_auth_login(tenant_id: str, entity: DwAuthLogin) -> DwAuthLogin:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwAuthLoginORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.login_at = entity.login_at
        existing.ip = entity.ip
        existing.status = entity.status
    else:
        s.add(models.DwAuthLoginORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id, login_at=entity.login_at,
            ip=entity.ip, status=entity.status,
        ))
    s.commit()
    return entity


def put_collaboration(tenant_id: str, entity: DwCollaboration) -> DwCollaboration:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwCollaborationORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.peer_employee_id = entity.peer_employee_id
        existing.session_id = entity.session_id
        existing.started_at = entity.started_at
        existing.duration_ms = entity.duration_ms
    else:
        s.add(models.DwCollaborationORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id,
            peer_employee_id=entity.peer_employee_id,
            session_id=entity.session_id,
            started_at=entity.started_at,
            duration_ms=entity.duration_ms,
        ))
    s.commit()
    return entity


def put_commit(tenant_id: str, entity: DwCommit) -> DwCommit:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwCommitORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.scope = entity.scope
        existing.target_id = entity.target_id
        existing.summary = entity.summary
        existing.committed_at = entity.committed_at
    else:
        s.add(models.DwCommitORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id, scope=entity.scope,
            target_id=entity.target_id, summary=entity.summary,
            committed_at=entity.committed_at,
        ))
    s.commit()
    return entity


def put_document(tenant_id: str, entity: DwDocument) -> DwDocument:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwDocumentORM, entity.id)
    if existing:
        existing.name = entity.name
        existing.kind = entity.kind
        existing.size_bytes = entity.size_bytes
        existing.uploaded_by = entity.uploaded_by
        existing.uploaded_at = entity.uploaded_at
        existing.kb_id = entity.kb_id
        existing.document_id = entity.document_id
        existing.chunk_count = entity.chunk_count
    else:
        s.add(models.DwDocumentORM(
            id=entity.id, tenant_id=tenant_id,
            name=entity.name, kind=entity.kind,
            size_bytes=entity.size_bytes,
            uploaded_by=entity.uploaded_by,
            uploaded_at=entity.uploaded_at, kb_id=entity.kb_id,
            document_id=entity.document_id, chunk_count=entity.chunk_count,
        ))
    s.commit()
    return entity


def put_employee(tenant_id: str, entity: DwEmployee) -> DwEmployee:
    if not tenant_id:
        return entity
    s = _session()
    kb_ids_str = _join_lines(entity.kb_ids)
    tools_str = _join_lines(entity.tools)
    action_rids_str = _join_lines(entity.action_rids)
    existing = s.get(models.DwEmployeeORM, entity.id)
    if existing:
        existing.name = entity.name
        existing.code = entity.code
        existing.role = entity.role
        existing.status = entity.status
        existing.model_id = entity.model_id
        existing.kb_ids = kb_ids_str
        existing.is_builtin = entity.is_builtin
        existing.system_prompt = entity.system_prompt
        existing.tools = tools_str
        existing.action_rids = action_rids_str
        existing.temperature = entity.temperature
        existing.max_tokens = entity.max_tokens
        existing.top_p = entity.top_p
        existing.retrieval_method = entity.retrieval_method
        existing.top_k = entity.top_k
        existing.rerank = entity.rerank
    else:
        s.add(models.DwEmployeeORM(
            id=entity.id, tenant_id=tenant_id,
            name=entity.name, code=entity.code,
            role=entity.role, status=entity.status,
            model_id=entity.model_id, kb_ids=kb_ids_str,
            is_builtin=entity.is_builtin,
            system_prompt=entity.system_prompt,
            tools=tools_str, action_rids=action_rids_str,
            temperature=entity.temperature, max_tokens=entity.max_tokens,
            top_p=entity.top_p, retrieval_method=entity.retrieval_method,
            top_k=entity.top_k, rerank=entity.rerank,
        ))
    s.commit()
    return entity


def put_employee_task(tenant_id: str, entity: DwEmployeeTask) -> DwEmployeeTask:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwEmployeeTaskORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.title = entity.title
        existing.status = entity.status
        existing.started_at = entity.started_at
        existing.finished_at = entity.finished_at
        existing.duration_ms = entity.duration_ms
    else:
        s.add(models.DwEmployeeTaskORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id, title=entity.title,
            status=entity.status, started_at=entity.started_at,
            finished_at=entity.finished_at,
            duration_ms=entity.duration_ms,
        ))
    s.commit()
    return entity


def put_evaluation(tenant_id: str, entity: DwEvaluation) -> DwEvaluation:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwEvaluationORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.qa_set_id = entity.qa_set_id
        existing.score = entity.score
        existing.passed = entity.passed
        existing.evaluated_at = entity.evaluated_at
    else:
        s.add(models.DwEvaluationORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id,
            qa_set_id=entity.qa_set_id,
            score=entity.score, passed=entity.passed,
            evaluated_at=entity.evaluated_at,
        ))
    s.commit()
    return entity


def put_extract(tenant_id: str, entity: DwExtract) -> DwExtract:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwExtractORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.source = entity.source
        existing.source_id = entity.source_id
        existing.extracted_facts = entity.extracted_facts
        existing.extracted_at = entity.extracted_at
    else:
        s.add(models.DwExtractORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id,
            source=entity.source, source_id=entity.source_id,
            extracted_facts=entity.extracted_facts,
            extracted_at=entity.extracted_at,
        ))
    s.commit()
    return entity


def put_knowledge_base(tenant_id: str, entity: DwKnowledgeBase) -> DwKnowledgeBase:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwKnowledgeBaseORM, entity.id)
    if existing:
        existing.name = entity.name
        existing.code = entity.code
        existing.docs = entity.docs
        existing.vectors = entity.vectors
        existing.owner = entity.owner
        existing.updated_at = entity.updated_at
    else:
        s.add(models.DwKnowledgeBaseORM(
            id=entity.id, tenant_id=tenant_id,
            name=entity.name, code=entity.code,
            docs=entity.docs, vectors=entity.vectors,
            owner=entity.owner, updated_at=entity.updated_at,
        ))
    s.commit()
    return entity


def put_learning_extract(tenant_id: str, entity: DwLearningExtract) -> DwLearningExtract:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwLearningExtractORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.scenario = entity.scenario
        existing.extracted_at = entity.extracted_at
        existing.facts = entity.facts
    else:
        s.add(models.DwLearningExtractORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id,
            scenario=entity.scenario,
            extracted_at=entity.extracted_at, facts=entity.facts,
        ))
    s.commit()
    return entity


def put_learning_feedback(tenant_id: str, entity: DwLearningFeedback) -> DwLearningFeedback:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwLearningFeedbackORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.scenario = entity.scenario
        existing.rating = entity.rating
        existing.comment = entity.comment
        existing.feedback_at = entity.feedback_at
        existing.promoted_document_id = entity.promoted_document_id
        existing.promoted_at = entity.promoted_at
    else:
        s.add(models.DwLearningFeedbackORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id,
            scenario=entity.scenario, rating=entity.rating,
            comment=entity.comment, feedback_at=entity.feedback_at,
            promoted_document_id=entity.promoted_document_id,
            promoted_at=entity.promoted_at,
        ))
    s.commit()
    return entity


def put_model(tenant_id: str, entity: DwModel) -> DwModel:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwModelORM, entity.id)
    if existing:
        existing.provider = entity.provider
        existing.model_id = entity.model_id
        existing.display_name = entity.display_name
        existing.modality = entity.modality
        existing.enabled = entity.enabled
    else:
        s.add(models.DwModelORM(
            id=entity.id, tenant_id=tenant_id,
            provider=entity.provider, model_id=entity.model_id,
            display_name=entity.display_name,
            modality=entity.modality, enabled=entity.enabled,
        ))
    s.commit()
    return entity


def put_tool(tenant_id: str, entity: DwTool) -> DwTool:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwToolORM, entity.id)
    if existing:
        existing.name = entity.name
        existing.code = entity.code
        existing.kind = entity.kind
        existing.enabled = entity.enabled
        existing.invocations = entity.invocations
    else:
        s.add(models.DwToolORM(
            id=entity.id, tenant_id=tenant_id,
            name=entity.name, code=entity.code,
            kind=entity.kind, enabled=entity.enabled,
            invocations=entity.invocations,
        ))
    s.commit()
    return entity


def put_trace(tenant_id: str, entity: DwTrace) -> DwTrace:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwTraceORM, entity.id)
    if existing:
        existing.employee_id = entity.employee_id
        existing.trace_id = entity.trace_id
        existing.span_count = entity.span_count
        existing.status = entity.status
        existing.duration_ms = entity.duration_ms
        existing.started_at = entity.started_at
    else:
        s.add(models.DwTraceORM(
            id=entity.id, tenant_id=tenant_id,
            employee_id=entity.employee_id,
            trace_id=entity.trace_id,
            span_count=entity.span_count,
            status=entity.status,
            duration_ms=entity.duration_ms,
            started_at=entity.started_at,
        ))
    s.commit()
    return entity


# ---------------------------------------------------------------------------
# Write API — in_memory-compatible surface (append_* / create_* / update_*
# / delete_*). Signatures + semantics mirror in_memory.py one-to-one so
# repositories/__init__.py can swap backends on DW_STORE with zero
# API-layer changes. update_* over frozen dataclasses = field patch on the
# stored row (upsert-equivalent), unknown kwargs ignored.
# ---------------------------------------------------------------------------
def append_document(tenant_id: str, doc: DwDocument) -> DwDocument:
    """Persist a new document. Used by POST /documents/upload."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    return put_document(tenant_id, doc)


def delete_document(tenant_id: str, doc_id: str) -> bool:
    """Delete a single document row (tenant-scoped).

    Returns True if the row was removed, False if it was not present.
    The RAG fan-out stays the API layer's responsibility — same contract
    as in_memory.delete_document.
    """
    if not tenant_id:
        return False
    s = _session()
    result = s.execute(
        delete(models.DwDocumentORM).where(
            models.DwDocumentORM.tenant_id == tenant_id,
            models.DwDocumentORM.id == doc_id,
        )
    )
    s.commit()
    return bool(result.rowcount)


def create_employee(tenant_id: str, employee: DwEmployee) -> DwEmployee:
    """Create a new employee record (upsert on primary key)."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    return put_employee(tenant_id, employee)


# DwEmployee dataclass field -> ORM column. Tuple fields are joined into
# their newline-separated TEXT columns before being written.
_EMPLOYEE_UPDATE_FIELDS: dict[str, str] = {
    "name": "name", "code": "code", "role": "role", "status": "status",
    "model_id": "model_id", "kb_ids": "kb_ids", "is_builtin": "is_builtin",
    "system_prompt": "system_prompt", "tools": "tools",
    "action_rids": "action_rids", "temperature": "temperature",
    "max_tokens": "max_tokens", "top_p": "top_p",
    "retrieval_method": "retrieval_method", "top_k": "top_k",
    "rerank": "rerank",
}
_EMPLOYEE_TUPLE_FIELDS: frozenset[str] = frozenset(
    {"kb_ids", "tools", "action_rids"}
)


def update_employee(tenant_id: str, employee_id: str, **kwargs) -> DwEmployee | None:
    """Patch an employee's fields. Returns the updated employee or None.

    Mirrors in_memory.update_employee: only the passed fields change,
    everything else keeps its stored value (frozen dataclass → row patch).
    """
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwEmployeeORM).where(
            models.DwEmployeeORM.tenant_id == tenant_id,
            models.DwEmployeeORM.id == employee_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    for key, value in kwargs.items():
        column = _EMPLOYEE_UPDATE_FIELDS.get(key)
        if column is None:
            continue  # unknown key — ignore (the API layer never passes one)
        stored = _join_lines(tuple(value or ())) if key in _EMPLOYEE_TUPLE_FIELDS else value
        setattr(row, column, stored)
    s.commit()
    return _orm_to_employee(row)


def delete_employee(tenant_id: str, employee_id: str) -> bool:
    """Delete an employee. Returns True if deleted, False if not found."""
    if not tenant_id:
        return False
    s = _session()
    result = s.execute(
        delete(models.DwEmployeeORM).where(
            models.DwEmployeeORM.tenant_id == tenant_id,
            models.DwEmployeeORM.id == employee_id,
        )
    )
    s.commit()
    return bool(result.rowcount)


def append_employee_task(
    tenant_id: str, task: DwEmployeeTask,
) -> DwEmployeeTask:
    """Persist a new employee task. Used by POST /employees/{id}/tasks."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    return put_employee_task(tenant_id, task)


def update_employee_task(
    tenant_id: str, task_id: str, *, status: str, finished_at: str | None = None,
    duration_ms: int | None = None,
) -> DwEmployeeTask | None:
    """Patch a task's status. Returns the updated task or None.

    ``None`` kwargs keep the stored value (same contract as
    in_memory.update_employee_task).
    """
    if not tenant_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwEmployeeTaskORM).where(
            models.DwEmployeeTaskORM.tenant_id == tenant_id,
            models.DwEmployeeTaskORM.id == task_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    row.status = status
    if finished_at is not None:
        row.finished_at = finished_at
    if duration_ms is not None:
        row.duration_ms = duration_ms
    s.commit()
    return _orm_to_employee_task(row)


def append_evaluation(
    tenant_id: str, evaluation: DwEvaluation,
) -> DwEvaluation:
    """Persist a new evaluation. Used by POST /employees/{id}/evaluations."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    return put_evaluation(tenant_id, evaluation)


def append_learning_feedback(
    tenant_id: str, feedback: DwLearningFeedback,
) -> DwLearningFeedback:
    """Persist learning feedback. Used by POST /learning/feedback."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    return put_learning_feedback(tenant_id, feedback)


_FEEDBACK_UPDATE_FIELDS: frozenset[str] = frozenset({
    "employee_id", "scenario", "rating", "comment", "feedback_at",
    "promoted_document_id", "promoted_at",
})


def update_learning_feedback(
    tenant_id: str, feedback_id: str, **kwargs,
) -> DwLearningFeedback | None:
    """Patch a learning-feedback record. Returns updated or None if missing.

    Recognized kwargs (frozen dataclass → row patch), notably
    ``promoted_document_id`` / ``promoted_at`` for the P2.10 promote
    write-back. Unknown kwargs are ignored — same contract as
    in_memory.update_learning_feedback.
    """
    if not tenant_id or not feedback_id:
        return None
    s = _session()
    row = s.execute(
        select(models.DwLearningFeedbackORM).where(
            models.DwLearningFeedbackORM.tenant_id == tenant_id,
            models.DwLearningFeedbackORM.id == feedback_id,
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    for key, value in kwargs.items():
        if key in _FEEDBACK_UPDATE_FIELDS:
            setattr(row, key, value)
    s.commit()
    return _orm_to_learning_feedback(row)


def append_collaboration(
    tenant_id: str, collab: DwCollaboration,
) -> DwCollaboration:
    """Persist a collaboration session. Used by POST /collaborations."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    return put_collaboration(tenant_id, collab)


# ---------------------------------------------------------------------------
# ORM <-> dataclass for conversation / message
# ---------------------------------------------------------------------------
def _orm_to_employee_conversation(row: models.DwEmployeeConversationORM) -> DwEmployeeConversation:
    return DwEmployeeConversation(
        id=row.id, tenant_id=row.tenant_id,
        user_id=row.user_id or "", employee_id=row.employee_id or "",
        title=row.title or "",
        created_at=row.created_at or "", updated_at=row.updated_at or "",
    )


def _orm_to_employee_message(row: models.DwEmployeeMessageORM) -> DwEmployeeMessage:
    return DwEmployeeMessage(
        id=row.id, tenant_id=row.tenant_id,
        conversation_id=row.conversation_id or "",
        role=row.role or "user",
        content=row.content or "",
        status=row.status or "completed",
        model=row.model or "",
        sequence=row.sequence,
        created_at=row.created_at or "",
    )


def list_employee_conversations(
    tenant_id: str, user_id: str, employee_id: str,
) -> list[DwEmployeeConversation]:
    if not tenant_id or not user_id or not employee_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwEmployeeConversationORM)
        .where(
            models.DwEmployeeConversationORM.tenant_id == tenant_id,
            models.DwEmployeeConversationORM.user_id == user_id,
            models.DwEmployeeConversationORM.employee_id == employee_id,
        )
        .order_by(models.DwEmployeeConversationORM.updated_at.desc())
    ).scalars().all()
    return [_orm_to_employee_conversation(r) for r in rows]


def get_employee_conversation(
    tenant_id: str, conversation_id: str,
) -> DwEmployeeConversation | None:
    if not tenant_id or not conversation_id:
        return None
    s = _session()
    row = s.get(models.DwEmployeeConversationORM, conversation_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    return _orm_to_employee_conversation(row)


def put_employee_conversation(
    tenant_id: str, entity: DwEmployeeConversation,
) -> DwEmployeeConversation:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwEmployeeConversationORM, entity.id)
    if existing and existing.tenant_id == tenant_id:
        existing.user_id = entity.user_id
        existing.employee_id = entity.employee_id
        existing.title = entity.title
        existing.created_at = entity.created_at
        existing.updated_at = entity.updated_at
    else:
        s.add(models.DwEmployeeConversationORM(
            id=entity.id, tenant_id=tenant_id,
            user_id=entity.user_id, employee_id=entity.employee_id,
            title=entity.title,
            created_at=entity.created_at, updated_at=entity.updated_at,
        ))
    s.commit()
    return entity


def list_employee_messages(
    tenant_id: str, conversation_id: str,
) -> list[DwEmployeeMessage]:
    if not tenant_id or not conversation_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DwEmployeeMessageORM)
        .where(
            models.DwEmployeeMessageORM.tenant_id == tenant_id,
            models.DwEmployeeMessageORM.conversation_id == conversation_id,
        )
        .order_by(models.DwEmployeeMessageORM.sequence)
    ).scalars().all()
    return [_orm_to_employee_message(r) for r in rows]


def put_employee_message(
    tenant_id: str, entity: DwEmployeeMessage,
) -> DwEmployeeMessage:
    if not tenant_id:
        return entity
    s = _session()
    existing = s.get(models.DwEmployeeMessageORM, entity.id)
    if existing and existing.tenant_id == tenant_id:
        existing.role = entity.role
        existing.content = entity.content
        existing.status = entity.status
        existing.model = entity.model
        existing.sequence = entity.sequence
        existing.created_at = entity.created_at
    else:
        s.add(models.DwEmployeeMessageORM(
            id=entity.id, tenant_id=tenant_id,
            conversation_id=entity.conversation_id,
            role=entity.role, content=entity.content,
            status=entity.status, model=entity.model,
            sequence=entity.sequence, created_at=entity.created_at,
        ))
    # 触达会话 updated_at（与 in_memory 语义一致：同事务回写，调用方
    # 传新 updated_at 即可；api 层的冗余 put_employee_conversation 仍兼容）。
    conv = s.get(models.DwEmployeeConversationORM, entity.conversation_id)
    if conv is not None and conv.tenant_id == tenant_id:
        conv.updated_at = entity.created_at
    s.commit()
    return entity


def next_employee_message_sequence(
    tenant_id: str, conversation_id: str,
) -> int:
    """返回 conversation 内下一条消息 sequence（已存在 + 1）。

    原子性：COALESCE(MAX(sequence),0)+1 作为一条聚合 SQL 在数据库端
    单语句完成（语句级原子），不依赖先读后写的两跳；PG 上同 conversation
    的并发取号由行锁 + 该语句的聚合语义保证不回退。空 conversation /
    空 tenant 返回 1（与 in_memory 一致）。
    """
    s = _session()
    value = s.execute(
        select(
            func.coalesce(func.max(models.DwEmployeeMessageORM.sequence), 0) + 1
        ).where(
            models.DwEmployeeMessageORM.tenant_id == tenant_id,
            models.DwEmployeeMessageORM.conversation_id == conversation_id,
        )
    ).scalar_one()
    return int(value)


# ---------------------------------------------------------------------------
# Bootstrap — seed SQL store from in_memory seed data (one-time)
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data.

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["auth_logins"] = len(
        [put_auth_login(tenant_id, e) for e in mem.list_auth_logins(tenant_id)]
    )
    counts["collaborations"] = len(
        [put_collaboration(tenant_id, e) for e in mem.list_collaborations(tenant_id)]
    )
    counts["commits"] = len(
        [put_commit(tenant_id, e) for e in mem.list_commits(tenant_id)]
    )
    counts["documents"] = len(
        [put_document(tenant_id, e) for e in mem.list_documents(tenant_id)]
    )
    counts["employees"] = len(
        [put_employee(tenant_id, e) for e in mem.list_employees(tenant_id)]
    )
    counts["employee_tasks"] = len(
        [put_employee_task(tenant_id, e) for e in mem.list_employee_tasks(tenant_id)]
    )
    counts["evaluations"] = len(
        [put_evaluation(tenant_id, e) for e in mem.list_evaluations(tenant_id)]
    )
    counts["extracts"] = len(
        [put_extract(tenant_id, e) for e in mem.list_extracts(tenant_id)]
    )
    counts["knowledge_bases"] = len(
        [put_knowledge_base(tenant_id, e) for e in mem.list_knowledge_bases(tenant_id)]
    )
    counts["learning_extracts"] = len(
        [put_learning_extract(tenant_id, e) for e in mem.list_learning_extracts(tenant_id)]
    )
    counts["learning_feedback"] = len(
        [put_learning_feedback(tenant_id, e) for e in mem.list_learning_feedback(tenant_id)]
    )
    counts["models"] = len(
        [put_model(tenant_id, e) for e in mem.list_models(tenant_id)]
    )
    counts["tools"] = len(
        [put_tool(tenant_id, e) for e in mem.list_tools(tenant_id)]
    )
    counts["traces"] = len(
        [put_trace(tenant_id, e) for e in mem.list_traces(tenant_id)]
    )
    return counts
