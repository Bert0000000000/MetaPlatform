"""In-memory repository for the dw domain (P2-W3 batch).

Data shape:
    _AUTH_LOGINS / _COLLABORATIONS / _COMMITS / _DOCUMENTS /
    _EMPLOYEES / _EMPLOYEE_TASKS / _EVALUATIONS / _EXTRACTS /
    _KNOWLEDGE_BASES / _LEARNING_EXTRACTS / _LEARNING_FEEDBACK /
    _MODELS / _TOOLS / _TRACES:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = entity dataclass

The store is intentionally tenant-scoped: callers MUST pass the
tenant binding (`ctx.tenant_id`) and the lookup rejects entities
that don't belong to that tenant. This is the layer at which the
ADR-0014 cross-tenant rule is enforced.

Seed data:
    Per-tenant: 3 auth logins, 4 collaborations, 5 commits,
    8 documents, 6 employees, 12 employee tasks, 4 evaluations,
    5 extracts, 5 knowledge bases, 6 learning extracts,
    6 learning feedback, 5 models, 8 tools, 10 traces.
    Tests rely on these minima; bumping them is allowed but tests
    assert `>= N` rather than equality.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Entity dataclasses
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class DwAuthLogin:
    id: str
    tenant_id: str
    employee_id: str
    login_at: str
    ip: str
    status: str  # success / failed / locked


@dataclass(frozen=True)
class DwCollaboration:
    id: str
    tenant_id: str
    employee_id: str
    peer_employee_id: str
    session_id: str
    started_at: str
    duration_ms: int


@dataclass(frozen=True)
class DwCommit:
    id: str
    tenant_id: str
    employee_id: str
    scope: str  # kb / agent / flow / form
    target_id: str
    summary: str
    committed_at: str


@dataclass(frozen=True)
class DwDocument:
    id: str
    tenant_id: str
    name: str
    kind: str  # pdf / docx / md / html
    size_bytes: int
    uploaded_by: str
    uploaded_at: str
    kb_id: str


@dataclass(frozen=True)
class DwEmployee:
    id: str
    tenant_id: str
    name: str
    code: str
    role: str  # CS_AGENT / SALES / ANALYST / OPS
    status: str  # active / idle / offline
    model_id: str
    kb_ids: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class DwEmployeeTask:
    id: str
    tenant_id: str
    employee_id: str
    title: str
    status: str  # pending / running / success / failed
    started_at: str
    finished_at: str | None = None
    duration_ms: int = 0


@dataclass(frozen=True)
class DwEvaluation:
    id: str
    tenant_id: str
    employee_id: str
    qa_set_id: str
    score: float
    passed: bool
    evaluated_at: str


@dataclass(frozen=True)
class DwExtract:
    id: str
    tenant_id: str
    employee_id: str
    source: str  # kb / conversation / document
    source_id: str
    extracted_facts: int
    extracted_at: str


@dataclass(frozen=True)
class DwKnowledgeBase:
    id: str
    tenant_id: str
    name: str
    code: str
    docs: int
    vectors: int
    owner: str
    updated_at: str


@dataclass(frozen=True)
class DwLearningExtract:
    id: str
    tenant_id: str
    employee_id: str
    scenario: str
    extracted_at: str
    facts: int


@dataclass(frozen=True)
class DwLearningFeedback:
    id: str
    tenant_id: str
    employee_id: str
    scenario: str
    rating: int  # 1-5
    comment: str
    feedback_at: str


@dataclass(frozen=True)
class DwModel:
    id: str
    tenant_id: str
    provider: str  # openai / anthropic / doubao / qwen
    model_id: str
    display_name: str
    modality: str  # text / multimodal
    enabled: bool = True


@dataclass(frozen=True)
class DwTool:
    id: str
    tenant_id: str
    name: str
    code: str
    kind: str  # mcp / function / flow
    enabled: bool = True
    invocations: int = 0


@dataclass(frozen=True)
class DwTrace:
    id: str
    tenant_id: str
    employee_id: str
    trace_id: str
    span_count: int
    status: str  # ok / error / timeout
    duration_ms: int
    started_at: str


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_auth_logins(tenant_id: str) -> dict[str, DwAuthLogin]:
    rows = [
        ("dw-auth-1", "dw-emp-1", "2026-07-30T09:00:00Z", "10.0.0.1", "success"),
        ("dw-auth-2", "dw-emp-2", "2026-07-30T09:05:00Z", "10.0.0.2", "success"),
        ("dw-auth-3", "dw-emp-3", "2026-07-30T09:10:00Z", "10.0.0.3", "failed"),
    ]
    return {
        rid: DwAuthLogin(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            login_at=ts, ip=ip, status=st,
        )
        for rid, emp, ts, ip, st in rows
    }


def _seed_collaborations(tenant_id: str) -> dict[str, DwCollaboration]:
    rows = [
        ("dw-collab-1", "dw-emp-1", "dw-emp-2", "sess-1", "2026-07-30T10:00:00Z", 120_000),
        ("dw-collab-2", "dw-emp-2", "dw-emp-3", "sess-2", "2026-07-30T11:00:00Z", 240_000),
        ("dw-collab-3", "dw-emp-1", "dw-emp-3", "sess-3", "2026-07-30T12:00:00Z", 90_000),
        ("dw-collab-4", "dw-emp-3", "dw-emp-2", "sess-4", "2026-07-30T13:00:00Z", 180_000),
    ]
    return {
        rid: DwCollaboration(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            peer_employee_id=peer, session_id=sess,
            started_at=ts, duration_ms=dur,
        )
        for rid, emp, peer, sess, ts, dur in rows
    }


def _seed_commits(tenant_id: str) -> dict[str, DwCommit]:
    rows = [
        ("dw-commit-1", "dw-emp-1", "kb", "kb-doc-1", "新增文档", "2026-07-30T10:30:00Z"),
        ("dw-commit-2", "dw-emp-2", "agent", "agent-1", "更新 prompt", "2026-07-30T11:30:00Z"),
        ("dw-commit-3", "dw-emp-3", "flow", "flow-1", "发布流程", "2026-07-30T12:30:00Z"),
        ("dw-commit-4", "dw-emp-1", "form", "form-1", "新增表单字段", "2026-07-30T13:30:00Z"),
        ("dw-commit-5", "dw-emp-2", "kb", "kb-doc-2", "修订文档", "2026-07-30T14:30:00Z"),
    ]
    return {
        rid: DwCommit(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            scope=scope, target_id=tid, summary=sm, committed_at=ts,
        )
        for rid, emp, scope, tid, sm, ts in rows
    }


def _seed_documents(tenant_id: str) -> dict[str, DwDocument]:
    rows = [
        ("dw-doc-1", "产品白皮书.pdf", "pdf", 524_288, "dw-emp-1", "2026-07-30T10:00:00Z", "dw-kb-1"),
        ("dw-doc-2", "用户手册.docx", "docx", 1_048_576, "dw-emp-1", "2026-07-30T10:10:00Z", "dw-kb-1"),
        ("dw-doc-3", "API 文档.md", "md", 32_768, "dw-emp-2", "2026-07-30T10:20:00Z", "dw-kb-2"),
        ("dw-doc-4", "FAQ.html", "html", 16_384, "dw-emp-2", "2026-07-30T10:30:00Z", "dw-kb-2"),
        ("dw-doc-5", "架构设计.pdf", "pdf", 2_097_152, "dw-emp-3", "2026-07-30T10:40:00Z", "dw-kb-3"),
        ("dw-doc-6", "运维手册.docx", "docx", 768_000, "dw-emp-3", "2026-07-30T10:50:00Z", "dw-kb-3"),
        ("dw-doc-7", "变更记录.md", "md", 24_576, "dw-emp-1", "2026-07-30T11:00:00Z", "dw-kb-1"),
        ("dw-doc-8", "测试报告.html", "html", 48_000, "dw-emp-2", "2026-07-30T11:10:00Z", "dw-kb-2"),
    ]
    return {
        rid: DwDocument(
            id=rid, tenant_id=tenant_id, name=name, kind=kind,
            size_bytes=size, uploaded_by=up, uploaded_at=ts, kb_id=kb,
        )
        for rid, name, kind, size, up, ts, kb in rows
    }


def _seed_employees(tenant_id: str) -> dict[str, DwEmployee]:
    rows = [
        ("dw-emp-1", "客服小艾", "EMP-CS-001", "CS_AGENT", "active", "model-openai", ("dw-kb-1",)),
        ("dw-emp-2", "销售小博", "EMP-SALES-001", "SALES", "active", "model-anthropic", ("dw-kb-2",)),
        ("dw-emp-3", "分析小查", "EMP-AN-001", "ANALYST", "idle", "model-doubao", ("dw-kb-3",)),
        ("dw-emp-4", "运维小卫", "EMP-OPS-001", "OPS", "active", "model-qwen", ("dw-kb-1", "dw-kb-2")),
        ("dw-emp-5", "客服小贝", "EMP-CS-002", "CS_AGENT", "offline", "model-openai", ("dw-kb-1",)),
        ("dw-emp-6", "销售小诚", "EMP-SALES-002", "SALES", "active", "model-anthropic", ("dw-kb-2",)),
    ]
    return {
        rid: DwEmployee(
            id=rid, tenant_id=tenant_id, name=name, code=code,
            role=role, status=st, model_id=mid, kb_ids=kbs,
        )
        for rid, name, code, role, st, mid, kbs in rows
    }


def _seed_employee_tasks(tenant_id: str) -> dict[str, DwEmployeeTask]:
    base = [
        ("dw-task-1", "dw-emp-1", "回复客户咨询", "success", "2026-07-30T10:00:00Z", "2026-07-30T10:02:00Z", 120_000),
        ("dw-task-2", "dw-emp-1", "处理退款", "success", "2026-07-30T10:30:00Z", "2026-07-30T10:35:00Z", 300_000),
        ("dw-task-3", "dw-emp-2", "发送报价", "success", "2026-07-30T11:00:00Z", "2026-07-30T11:01:00Z", 60_000),
        ("dw-task-4", "dw-emp-2", "跟进意向", "running", "2026-07-30T11:30:00Z", "", 0),
        ("dw-task-5", "dw-emp-3", "生成日报", "success", "2026-07-30T12:00:00Z", "2026-07-30T12:05:00Z", 300_000),
        ("dw-task-6", "dw-emp-3", "异常分析", "failed", "2026-07-30T12:30:00Z", "2026-07-30T12:31:00Z", 60_000),
        ("dw-task-7", "dw-emp-4", "巡检任务", "success", "2026-07-30T13:00:00Z", "2026-07-30T13:10:00Z", 600_000),
        ("dw-task-8", "dw-emp-4", "告警处理", "success", "2026-07-30T13:30:00Z", "2026-07-30T13:32:00Z", 120_000),
        ("dw-task-9", "dw-emp-1", "知识整理", "pending", "2026-07-30T14:00:00Z", "", 0),
        ("dw-task-10", "dw-emp-2", "客户回访", "success", "2026-07-30T14:30:00Z", "2026-07-30T14:33:00Z", 180_000),
        ("dw-task-11", "dw-emp-3", "指标监控", "running", "2026-07-30T15:00:00Z", "", 0),
        ("dw-task-12", "dw-emp-4", "故障恢复", "failed", "2026-07-30T15:30:00Z", "2026-07-30T15:31:00Z", 60_000),
    ]
    return {
        rid: DwEmployeeTask(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            title=title, status=st, started_at=ts,
            finished_at=ft if ft else None, duration_ms=dur,
        )
        for rid, emp, title, st, ts, ft, dur in base
    }


def _seed_evaluations(tenant_id: str) -> dict[str, DwEvaluation]:
    rows = [
        ("dw-eval-1", "dw-emp-1", "qa-cs-1", 92.5, True, "2026-07-30T16:00:00Z"),
        ("dw-eval-2", "dw-emp-2", "qa-sales-1", 88.0, True, "2026-07-30T16:10:00Z"),
        ("dw-eval-3", "dw-emp-3", "qa-an-1", 75.0, False, "2026-07-30T16:20:00Z"),
        ("dw-eval-4", "dw-emp-4", "qa-ops-1", 95.0, True, "2026-07-30T16:30:00Z"),
    ]
    return {
        rid: DwEvaluation(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            qa_set_id=qa, score=score, passed=passed, evaluated_at=ts,
        )
        for rid, emp, qa, score, passed, ts in rows
    }


def _seed_extracts(tenant_id: str) -> dict[str, DwExtract]:
    rows = [
        ("dw-extract-1", "dw-emp-1", "kb", "dw-kb-1", 15, "2026-07-30T17:00:00Z"),
        ("dw-extract-2", "dw-emp-2", "conversation", "sess-1", 8, "2026-07-30T17:10:00Z"),
        ("dw-extract-3", "dw-emp-3", "document", "dw-doc-5", 23, "2026-07-30T17:20:00Z"),
        ("dw-extract-4", "dw-emp-4", "kb", "dw-kb-2", 11, "2026-07-30T17:30:00Z"),
        ("dw-extract-5", "dw-emp-1", "document", "dw-doc-2", 17, "2026-07-30T17:40:00Z"),
    ]
    return {
        rid: DwExtract(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            source=src, source_id=sid, extracted_facts=n, extracted_at=ts,
        )
        for rid, emp, src, sid, n, ts in rows
    }


def _seed_knowledge_bases(tenant_id: str) -> dict[str, DwKnowledgeBase]:
    rows = [
        ("dw-kb-1", "客服知识库", "kb-cs", 128, 4096, "dw-emp-1", "2026-07-30T09:00:00Z"),
        ("dw-kb-2", "销售知识库", "kb-sales", 96, 3072, "dw-emp-2", "2026-07-30T09:10:00Z"),
        ("dw-kb-3", "分析知识库", "kb-an", 64, 2048, "dw-emp-3", "2026-07-30T09:20:00Z"),
        ("dw-kb-4", "运维知识库", "kb-ops", 80, 2560, "dw-emp-4", "2026-07-30T09:30:00Z"),
        ("dw-kb-5", "通用知识库", "kb-general", 200, 6144, "dw-emp-1", "2026-07-30T09:40:00Z"),
    ]
    return {
        rid: DwKnowledgeBase(
            id=rid, tenant_id=tenant_id, name=name, code=code,
            docs=docs, vectors=vecs, owner=owner, updated_at=ts,
        )
        for rid, name, code, docs, vecs, owner, ts in rows
    }


def _seed_learning_extracts(tenant_id: str) -> dict[str, DwLearningExtract]:
    rows = [
        ("dw-learn-ext-1", "dw-emp-1", "cs-refund", "2026-07-30T18:00:00Z", 5),
        ("dw-learn-ext-2", "dw-emp-2", "sales-quote", "2026-07-30T18:10:00Z", 7),
        ("dw-learn-ext-3", "dw-emp-3", "an-report", "2026-07-30T18:20:00Z", 4),
        ("dw-learn-ext-4", "dw-emp-4", "ops-inspect", "2026-07-30T18:30:00Z", 6),
        ("dw-learn-ext-5", "dw-emp-1", "cs-faq", "2026-07-30T18:40:00Z", 9),
        ("dw-learn-ext-6", "dw-emp-2", "sales-followup", "2026-07-30T18:50:00Z", 3),
    ]
    return {
        rid: DwLearningExtract(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            scenario=sc, extracted_at=ts, facts=n,
        )
        for rid, emp, sc, ts, n in rows
    }


def _seed_learning_feedback(tenant_id: str) -> dict[str, DwLearningFeedback]:
    rows = [
        ("dw-learn-fb-1", "dw-emp-1", "cs-refund", 5, "处理准确", "2026-07-30T19:00:00Z"),
        ("dw-learn-fb-2", "dw-emp-2", "sales-quote", 4, "可优化语气", "2026-07-30T19:10:00Z"),
        ("dw-learn-fb-3", "dw-emp-3", "an-report", 3, "缺少数据源", "2026-07-30T19:20:00Z"),
        ("dw-learn-fb-4", "dw-emp-4", "ops-inspect", 5, "巡检覆盖全面", "2026-07-30T19:30:00Z"),
        ("dw-learn-fb-5", "dw-emp-1", "cs-faq", 4, "可补充更多场景", "2026-07-30T19:40:00Z"),
        ("dw-learn-fb-6", "dw-emp-2", "sales-followup", 5, "时机把握精准", "2026-07-30T19:50:00Z"),
    ]
    return {
        rid: DwLearningFeedback(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            scenario=sc, rating=rating, comment=cm, feedback_at=ts,
        )
        for rid, emp, sc, rating, cm, ts in rows
    }


def _seed_models(tenant_id: str) -> dict[str, DwModel]:
    rows = [
        ("dw-model-1", "openai", "gpt-4o", "GPT-4o", "multimodal", True),
        ("dw-model-2", "anthropic", "claude-3-5-sonnet", "Claude 3.5 Sonnet", "text", True),
        ("dw-model-3", "doubao", "doubao-pro-32k", "Doubao Pro 32K", "text", True),
        ("dw-model-4", "qwen", "qwen-max", "Qwen Max", "text", True),
        ("dw-model-5", "openai", "gpt-4o-mini", "GPT-4o Mini", "multimodal", False),
    ]
    return {
        rid: DwModel(
            id=rid, tenant_id=tenant_id, provider=p,
            model_id=mid, display_name=dn, modality=m, enabled=en,
        )
        for rid, p, mid, dn, m, en in rows
    }


def _seed_tools(tenant_id: str) -> dict[str, DwTool]:
    rows = [
        ("dw-tool-1", "知识库检索", "kb-search", "mcp", True, 1280),
        ("dw-tool-2", "SQL 查询", "sql-exec", "function", True, 640),
        ("dw-tool-3", "流程触发", "flow-trigger", "flow", True, 320),
        ("dw-tool-4", "邮件发送", "mail-send", "function", True, 480),
        ("dw-tool-5", "短信通知", "sms-send", "function", True, 240),
        ("dw-tool-6", "文档解析", "doc-parse", "mcp", True, 800),
        ("dw-tool-7", "图像识别", "image-ocr", "function", False, 0),
        ("dw-tool-8", "语音转写", "voice-asr", "mcp", True, 160),
    ]
    return {
        rid: DwTool(
            id=rid, tenant_id=tenant_id, name=name, code=code,
            kind=kind, enabled=en, invocations=inv,
        )
        for rid, name, code, kind, en, inv in rows
    }


def _seed_traces(tenant_id: str) -> dict[str, DwTrace]:
    rows = [
        ("dw-trace-1", "dw-emp-1", "trace-001", 12, "ok", 1200, "2026-07-30T10:00:00Z"),
        ("dw-trace-2", "dw-emp-1", "trace-002", 8, "ok", 800, "2026-07-30T10:30:00Z"),
        ("dw-trace-3", "dw-emp-2", "trace-003", 15, "ok", 1500, "2026-07-30T11:00:00Z"),
        ("dw-trace-4", "dw-emp-2", "trace-004", 6, "error", 600, "2026-07-30T11:30:00Z"),
        ("dw-trace-5", "dw-emp-3", "trace-005", 10, "ok", 1000, "2026-07-30T12:00:00Z"),
        ("dw-trace-6", "dw-emp-3", "trace-006", 4, "timeout", 30000, "2026-07-30T12:30:00Z"),
        ("dw-trace-7", "dw-emp-4", "trace-007", 20, "ok", 2000, "2026-07-30T13:00:00Z"),
        ("dw-trace-8", "dw-emp-4", "trace-008", 9, "ok", 900, "2026-07-30T13:30:00Z"),
        ("dw-trace-9", "dw-emp-1", "trace-009", 7, "ok", 700, "2026-07-30T14:00:00Z"),
        ("dw-trace-10", "dw-emp-2", "trace-010", 11, "ok", 1100, "2026-07-30T14:30:00Z"),
    ]
    return {
        rid: DwTrace(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            trace_id=tid, span_count=sc, status=st,
            duration_ms=dur, started_at=ts,
        )
        for rid, emp, tid, sc, st, dur, ts in rows
    }


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_AUTH_LOGINS: dict[str, dict[str, DwAuthLogin]] = {}
_COLLABORATIONS: dict[str, dict[str, DwCollaboration]] = {}
_COMMITS: dict[str, dict[str, DwCommit]] = {}
_DOCUMENTS: dict[str, dict[str, DwDocument]] = {}
_EMPLOYEES: dict[str, dict[str, DwEmployee]] = {}
_EMPLOYEE_TASKS: dict[str, dict[str, DwEmployeeTask]] = {}
_EVALUATIONS: dict[str, dict[str, DwEvaluation]] = {}
_EXTRACTS: dict[str, dict[str, DwExtract]] = {}
_KNOWLEDGE_BASES: dict[str, dict[str, DwKnowledgeBase]] = {}
_LEARNING_EXTRACTS: dict[str, dict[str, DwLearningExtract]] = {}
_LEARNING_FEEDBACK: dict[str, dict[str, DwLearningFeedback]] = {}
_MODELS: dict[str, dict[str, DwModel]] = {}
_TOOLS: dict[str, dict[str, DwTool]] = {}
_TRACES: dict[str, dict[str, DwTrace]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return  # anonymous lookups return empty, see list_*() functions
    if tenant_id not in _AUTH_LOGINS:
        _AUTH_LOGINS[tenant_id] = _seed_auth_logins(tenant_id)
    if tenant_id not in _COLLABORATIONS:
        _COLLABORATIONS[tenant_id] = _seed_collaborations(tenant_id)
    if tenant_id not in _COMMITS:
        _COMMITS[tenant_id] = _seed_commits(tenant_id)
    if tenant_id not in _DOCUMENTS:
        _DOCUMENTS[tenant_id] = _seed_documents(tenant_id)
    if tenant_id not in _EMPLOYEES:
        _EMPLOYEES[tenant_id] = _seed_employees(tenant_id)
    if tenant_id not in _EMPLOYEE_TASKS:
        _EMPLOYEE_TASKS[tenant_id] = _seed_employee_tasks(tenant_id)
    if tenant_id not in _EVALUATIONS:
        _EVALUATIONS[tenant_id] = _seed_evaluations(tenant_id)
    if tenant_id not in _EXTRACTS:
        _EXTRACTS[tenant_id] = _seed_extracts(tenant_id)
    if tenant_id not in _KNOWLEDGE_BASES:
        _KNOWLEDGE_BASES[tenant_id] = _seed_knowledge_bases(tenant_id)
    if tenant_id not in _LEARNING_EXTRACTS:
        _LEARNING_EXTRACTS[tenant_id] = _seed_learning_extracts(tenant_id)
    if tenant_id not in _LEARNING_FEEDBACK:
        _LEARNING_FEEDBACK[tenant_id] = _seed_learning_feedback(tenant_id)
    if tenant_id not in _MODELS:
        _MODELS[tenant_id] = _seed_models(tenant_id)
    if tenant_id not in _TOOLS:
        _TOOLS[tenant_id] = _seed_tools(tenant_id)
    if tenant_id not in _TRACES:
        _TRACES[tenant_id] = _seed_traces(tenant_id)


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_auth_logins(tenant_id: str) -> list[DwAuthLogin]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_AUTH_LOGINS[tenant_id].values(), key=lambda x: x.login_at)


def list_collaborations(tenant_id: str) -> list[DwCollaboration]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_COLLABORATIONS[tenant_id].values(), key=lambda x: x.started_at)


def list_commits(tenant_id: str) -> list[DwCommit]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_COMMITS[tenant_id].values(), key=lambda x: x.committed_at)


def list_documents(tenant_id: str) -> list[DwDocument]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_DOCUMENTS[tenant_id].values(), key=lambda x: x.uploaded_at)


def append_document(tenant_id: str, doc: DwDocument) -> DwDocument:
    """Persist a new document. Used by POST /documents/upload."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _DOCUMENTS[tenant_id][doc.id] = doc
    return doc


def list_employees(tenant_id: str) -> list[DwEmployee]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_EMPLOYEES[tenant_id].values(), key=lambda x: x.code)


def list_employee_tasks(tenant_id: str) -> list[DwEmployeeTask]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_EMPLOYEE_TASKS[tenant_id].values(), key=lambda x: x.started_at)


def list_evaluations(tenant_id: str) -> list[DwEvaluation]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_EVALUATIONS[tenant_id].values(), key=lambda x: x.evaluated_at)


def list_extracts(tenant_id: str) -> list[DwExtract]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_EXTRACTS[tenant_id].values(), key=lambda x: x.extracted_at)


def list_knowledge_bases(tenant_id: str) -> list[DwKnowledgeBase]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_KNOWLEDGE_BASES[tenant_id].values(), key=lambda x: x.code)


def list_learning_extracts(tenant_id: str) -> list[DwLearningExtract]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_LEARNING_EXTRACTS[tenant_id].values(), key=lambda x: x.extracted_at)


def list_learning_feedback(tenant_id: str) -> list[DwLearningFeedback]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_LEARNING_FEEDBACK[tenant_id].values(), key=lambda x: x.feedback_at)


def list_models(tenant_id: str) -> list[DwModel]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_MODELS[tenant_id].values(), key=lambda x: (x.provider, x.model_id))


def list_tools(tenant_id: str) -> list[DwTool]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_TOOLS[tenant_id].values(), key=lambda x: x.code)


def list_traces(tenant_id: str) -> list[DwTrace]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_TRACES[tenant_id].values(), key=lambda x: x.started_at)


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _AUTH_LOGINS.clear()
    _COLLABORATIONS.clear()
    _COMMITS.clear()
    _DOCUMENTS.clear()
    _EMPLOYEES.clear()
    _EMPLOYEE_TASKS.clear()
    _EVALUATIONS.clear()
    _EXTRACTS.clear()
    _KNOWLEDGE_BASES.clear()
    _LEARNING_EXTRACTS.clear()
    _LEARNING_FEEDBACK.clear()
    _MODELS.clear()
    _TOOLS.clear()
    _TRACES.clear()


__all__ = [
    "DwAuthLogin", "DwCollaboration", "DwCommit", "DwDocument",
    "DwEmployee", "DwEmployeeTask", "DwEvaluation", "DwExtract",
    "DwKnowledgeBase", "DwLearningExtract", "DwLearningFeedback",
    "DwModel", "DwTool", "DwTrace",
    "list_auth_logins", "list_collaborations", "list_commits",
    "list_documents", "append_document", "list_employees",
    "list_employee_tasks", "list_evaluations", "list_extracts",
    "list_knowledge_bases", "list_learning_extracts",
    "list_learning_feedback", "list_models", "list_tools",
    "list_traces", "reset_store",
]
