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
    document_id: str = ""  # mate-tech-rag 入库的 doc id（upload 后回填）
    chunk_count: int = 0  # RAG 入库切片数


@dataclass(frozen=True)
class DwEmployee:
    id: str
    tenant_id: str
    name: str
    code: str
    role: str  # kernel AgentRole slug: ontology/workflow/app/data_product/obs/security/knowledge（+ 自定义）
    status: str  # active / idle / offline
    model_id: str
    kb_ids: tuple[str, ...] = field(default_factory=tuple)
    is_builtin: bool = False  # 内置共享员工（CLAUDE.md 7+1 类）
    system_prompt: str = ""  # 系统提示词（能力配置 systemPrompt）
    tools: tuple[str, ...] = field(default_factory=tuple)  # 可用工具（skill 注册表就绪前为 stub）
    action_rids: tuple[str, ...] = field(default_factory=tuple)  # 可触发 ActionType rid
    temperature: float = 0.7
    max_tokens: int = 4096
    top_p: float = 0.9
    retrieval_method: str = "hybrid"  # hybrid / vector / keyword
    top_k: int = 5
    rerank: bool = True


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
    promoted_document_id: str = ""  # promote to RAG KB 后写入的 rag document_id
    promoted_at: str = ""  # promote 时间戳(ISO8601 UTC)


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
# 会话（数字员工端）—— 每用户 × 每员工独立 conversation，持久化聊天历史。
# 与 kernel SessionSandbox 配合：conv_id 即 session_id，下游 dispatch 时透传。
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class DwEmployeeConversation:
    id: str
    tenant_id: str
    user_id: str
    employee_id: str
    title: str = ""
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class DwEmployeeMessage:
    id: str
    tenant_id: str
    conversation_id: str
    role: str  # 'user' / 'assistant'
    content: str
    status: str = "completed"  # 'local' / 'in_progress' / 'incomplete' / 'completed' / 'failed'
    model: str = ""
    sequence: int = 0
    created_at: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _tenant_alias(tenant_id: str) -> str:
    """Short tenant id for prefixing seed entities (e.g. 'tenant-acme' -> 'acme').

    Used to namespace employee / dependent ids so that two tenants cannot
    collide on a shared in-memory store. Real persistence would key on
    (tenant_id, id) instead, but the in-memory seed must look distinct.
    """
    return tenant_id.split("tenant-", 1)[-1]


def _emp_id(tenant_id: str, n: int) -> str:
    """Tenant-scoped employee id: dw-emp-<alias>-<n>."""
    return f"dw-emp-{_tenant_alias(tenant_id)}-{n}"


def _seed_auth_logins(tenant_id: str) -> dict[str, DwAuthLogin]:
    e1, e2, e3 = _emp_id(tenant_id, 1), _emp_id(tenant_id, 2), _emp_id(tenant_id, 3)
    rows = [
        ("dw-auth-1", e1, "2026-07-30T09:00:00Z", "10.0.0.1", "success"),
        ("dw-auth-2", e2, "2026-07-30T09:05:00Z", "10.0.0.2", "success"),
        ("dw-auth-3", e3, "2026-07-30T09:10:00Z", "10.0.0.3", "failed"),
    ]
    return {
        rid: DwAuthLogin(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            login_at=ts, ip=ip, status=st,
        )
        for rid, emp, ts, ip, st in rows
    }


def _seed_collaborations(tenant_id: str) -> dict[str, DwCollaboration]:
    e1, e2, e3 = _emp_id(tenant_id, 1), _emp_id(tenant_id, 2), _emp_id(tenant_id, 3)
    rows = [
        ("dw-collab-1", e1, e2, "sess-1", "2026-07-30T10:00:00Z", 120_000),
        ("dw-collab-2", e2, e3, "sess-2", "2026-07-30T11:00:00Z", 240_000),
        ("dw-collab-3", e1, e3, "sess-3", "2026-07-30T12:00:00Z", 90_000),
        ("dw-collab-4", e3, e2, "sess-4", "2026-07-30T13:00:00Z", 180_000),
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
    e1, e2, e3 = _emp_id(tenant_id, 1), _emp_id(tenant_id, 2), _emp_id(tenant_id, 3)
    rows = [
        ("dw-commit-1", e1, "kb", "kb-doc-1", "新增文档", "2026-07-30T10:30:00Z"),
        ("dw-commit-2", e2, "agent", "agent-1", "更新 prompt", "2026-07-30T11:30:00Z"),
        ("dw-commit-3", e3, "flow", "flow-1", "发布流程", "2026-07-30T12:30:00Z"),
        ("dw-commit-4", e1, "form", "form-1", "新增表单字段", "2026-07-30T13:30:00Z"),
        ("dw-commit-5", e2, "kb", "kb-doc-2", "修订文档", "2026-07-30T14:30:00Z"),
    ]
    return {
        rid: DwCommit(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            scope=scope, target_id=tid, summary=sm, committed_at=ts,
        )
        for rid, emp, scope, tid, sm, ts in rows
    }


def _seed_documents(tenant_id: str) -> dict[str, DwDocument]:
    e1, e2, e3 = _emp_id(tenant_id, 1), _emp_id(tenant_id, 2), _emp_id(tenant_id, 3)
    rows = [
        ("dw-doc-1", "产品白皮书.pdf", "pdf", 524_288, e1, "2026-07-30T10:00:00Z", "dw-kb-1"),
        ("dw-doc-2", "用户手册.docx", "docx", 1_048_576, e1, "2026-07-30T10:10:00Z", "dw-kb-1"),
        ("dw-doc-3", "API 文档.md", "md", 32_768, e2, "2026-07-30T10:20:00Z", "dw-kb-2"),
        ("dw-doc-4", "FAQ.html", "html", 16_384, e2, "2026-07-30T10:30:00Z", "dw-kb-2"),
        ("dw-doc-5", "架构设计.pdf", "pdf", 2_097_152, e3, "2026-07-30T10:40:00Z", "dw-kb-3"),
        ("dw-doc-6", "运维手册.docx", "docx", 768_000, e3, "2026-07-30T10:50:00Z", "dw-kb-3"),
        ("dw-doc-7", "变更记录.md", "md", 24_576, e1, "2026-07-30T11:00:00Z", "dw-kb-1"),
        ("dw-doc-8", "测试报告.html", "html", 48_000, e2, "2026-07-30T11:10:00Z", "dw-kb-2"),
    ]
    return {
        rid: DwDocument(
            id=rid, tenant_id=tenant_id, name=name, kind=kind,
            size_bytes=size, uploaded_by=up, uploaded_at=ts, kb_id=kb,
        )
        for rid, name, kind, size, up, ts, kb in rows
    }


def _seed_employees(tenant_id: str) -> dict[str, DwEmployee]:
    # CLAUDE.md 7 + 1 类数字员工：7 个内置共享员工（is_builtin=True），
    # 严格对齐 kernel AgentRole（ontology/workflow/app/data_product/obs/security/knowledge）。
    # role 字段即 kernel AgentRole slug；system prompt 由 app.py 从 kernel SYSTEM_PROMPTS 取。
    # 员工 id 带 tenant 前缀（_emp_id），保证不同 tenant 不共享同一份员工数据。
    rows = [
        (_emp_id(tenant_id, 1), "本体建模师", "EMP-ONT-001", "ontology", "active", "model-doubao", ("dw-kb-1",), True),
        (_emp_id(tenant_id, 2), "流程工程师", "EMP-WF-001", "workflow", "active", "model-openai", ("dw-kb-2",), True),
        (_emp_id(tenant_id, 3), "应用构建师", "EMP-APP-001", "app", "idle", "model-openai", ("dw-kb-3",), True),
        (_emp_id(tenant_id, 4), "数据产品师", "EMP-DATA-001", "data_product", "active", "model-qwen", ("dw-kb-1", "dw-kb-2"), True),
        (_emp_id(tenant_id, 5), "可观测工程师", "EMP-OBS-001", "obs", "offline", "model-qwen", ("dw-kb-3",), True),
        (_emp_id(tenant_id, 6), "安全合规官", "EMP-SEC-001", "security", "active", "model-anthropic", ("dw-kb-2",), True),
        (_emp_id(tenant_id, 7), "知识管理员", "EMP-KB-001", "knowledge", "active", "model-doubao", ("dw-kb-4",), True),
    ]
    return {
        rid: DwEmployee(
            id=rid, tenant_id=tenant_id, name=name, code=code,
            role=role, status=st, model_id=mid, kb_ids=kbs, is_builtin=builtin,
        )
        for rid, name, code, role, st, mid, kbs, builtin in rows
    }


def _seed_employee_tasks(tenant_id: str) -> dict[str, DwEmployeeTask]:
    e1, e2, e3, e4 = (_emp_id(tenant_id, n) for n in (1, 2, 3, 4))
    base = [
        ("dw-task-1", e1, "回复客户咨询", "success", "2026-07-30T10:00:00Z", "2026-07-30T10:02:00Z", 120_000),
        ("dw-task-2", e1, "处理退款", "success", "2026-07-30T10:30:00Z", "2026-07-30T10:35:00Z", 300_000),
        ("dw-task-3", e2, "发送报价", "success", "2026-07-30T11:00:00Z", "2026-07-30T11:01:00Z", 60_000),
        ("dw-task-4", e2, "跟进意向", "running", "2026-07-30T11:30:00Z", "", 0),
        ("dw-task-5", e3, "生成日报", "success", "2026-07-30T12:00:00Z", "2026-07-30T12:05:00Z", 300_000),
        ("dw-task-6", e3, "异常分析", "failed", "2026-07-30T12:30:00Z", "2026-07-30T12:31:00Z", 60_000),
        ("dw-task-7", e4, "巡检任务", "success", "2026-07-30T13:00:00Z", "2026-07-30T13:10:00Z", 600_000),
        ("dw-task-8", e4, "告警处理", "success", "2026-07-30T13:30:00Z", "2026-07-30T13:32:00Z", 120_000),
        ("dw-task-9", e1, "知识整理", "pending", "2026-07-30T14:00:00Z", "", 0),
        ("dw-task-10", e2, "客户回访", "success", "2026-07-30T14:30:00Z", "2026-07-30T14:33:00Z", 180_000),
        ("dw-task-11", e3, "指标监控", "running", "2026-07-30T15:00:00Z", "", 0),
        ("dw-task-12", e4, "故障恢复", "failed", "2026-07-30T15:30:00Z", "2026-07-30T15:31:00Z", 60_000),
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
    e1, e2, e3, e4 = (_emp_id(tenant_id, n) for n in (1, 2, 3, 4))
    rows = [
        ("dw-eval-1", e1, "qa-cs-1", 92.5, True, "2026-07-30T16:00:00Z"),
        ("dw-eval-2", e2, "qa-sales-1", 88.0, True, "2026-07-30T16:10:00Z"),
        ("dw-eval-3", e3, "qa-an-1", 75.0, False, "2026-07-30T16:20:00Z"),
        ("dw-eval-4", e4, "qa-ops-1", 95.0, True, "2026-07-30T16:30:00Z"),
    ]
    return {
        rid: DwEvaluation(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            qa_set_id=qa, score=score, passed=passed, evaluated_at=ts,
        )
        for rid, emp, qa, score, passed, ts in rows
    }


def _seed_extracts(tenant_id: str) -> dict[str, DwExtract]:
    e1, e2, e3, e4 = (_emp_id(tenant_id, n) for n in (1, 2, 3, 4))
    rows = [
        ("dw-extract-1", e1, "kb", "dw-kb-1", 15, "2026-07-30T17:00:00Z"),
        ("dw-extract-2", e2, "conversation", "sess-1", 8, "2026-07-30T17:10:00Z"),
        ("dw-extract-3", e3, "document", "dw-doc-5", 23, "2026-07-30T17:20:00Z"),
        ("dw-extract-4", e4, "kb", "dw-kb-2", 11, "2026-07-30T17:30:00Z"),
        ("dw-extract-5", e1, "document", "dw-doc-2", 17, "2026-07-30T17:40:00Z"),
    ]
    return {
        rid: DwExtract(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            source=src, source_id=sid, extracted_facts=n, extracted_at=ts,
        )
        for rid, emp, src, sid, n, ts in rows
    }


def _seed_knowledge_bases(tenant_id: str) -> dict[str, DwKnowledgeBase]:
    e1, e2, e3, e4 = (_emp_id(tenant_id, n) for n in (1, 2, 3, 4))
    rows = [
        ("dw-kb-1", "客服知识库", "kb-cs", 128, 4096, e1, "2026-07-30T09:00:00Z"),
        ("dw-kb-2", "销售知识库", "kb-sales", 96, 3072, e2, "2026-07-30T09:10:00Z"),
        ("dw-kb-3", "分析知识库", "kb-an", 64, 2048, e3, "2026-07-30T09:20:00Z"),
        ("dw-kb-4", "运维知识库", "kb-ops", 80, 2560, e4, "2026-07-30T09:30:00Z"),
        ("dw-kb-5", "通用知识库", "kb-general", 200, 6144, e1, "2026-07-30T09:40:00Z"),
    ]
    return {
        rid: DwKnowledgeBase(
            id=rid, tenant_id=tenant_id, name=name, code=code,
            docs=docs, vectors=vecs, owner=owner, updated_at=ts,
        )
        for rid, name, code, docs, vecs, owner, ts in rows
    }


def _seed_learning_extracts(tenant_id: str) -> dict[str, DwLearningExtract]:
    e1, e2, e3, e4 = (_emp_id(tenant_id, n) for n in (1, 2, 3, 4))
    rows = [
        ("dw-learn-ext-1", e1, "cs-refund", "2026-07-30T18:00:00Z", 5),
        ("dw-learn-ext-2", e2, "sales-quote", "2026-07-30T18:10:00Z", 7),
        ("dw-learn-ext-3", e3, "an-report", "2026-07-30T18:20:00Z", 4),
        ("dw-learn-ext-4", e4, "ops-inspect", "2026-07-30T18:30:00Z", 6),
        ("dw-learn-ext-5", e1, "cs-faq", "2026-07-30T18:40:00Z", 9),
        ("dw-learn-ext-6", e2, "sales-followup", "2026-07-30T18:50:00Z", 3),
    ]
    return {
        rid: DwLearningExtract(
            id=rid, tenant_id=tenant_id, employee_id=emp,
            scenario=sc, extracted_at=ts, facts=n,
        )
        for rid, emp, sc, ts, n in rows
    }


def _seed_learning_feedback(tenant_id: str) -> dict[str, DwLearningFeedback]:
    e1, e2, e3, e4 = (_emp_id(tenant_id, n) for n in (1, 2, 3, 4))
    rows = [
        ("dw-learn-fb-1", e1, "cs-refund", 5, "处理准确", "2026-07-30T19:00:00Z"),
        ("dw-learn-fb-2", e2, "sales-quote", 4, "可优化语气", "2026-07-30T19:10:00Z"),
        ("dw-learn-fb-3", e3, "an-report", 3, "缺少数据源", "2026-07-30T19:20:00Z"),
        ("dw-learn-fb-4", e4, "ops-inspect", 5, "巡检覆盖全面", "2026-07-30T19:30:00Z"),
        ("dw-learn-fb-5", e1, "cs-faq", 4, "可补充更多场景", "2026-07-30T19:40:00Z"),
        ("dw-learn-fb-6", e2, "sales-followup", 5, "时机把握精准", "2026-07-30T19:50:00Z"),
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
    e1, e2, e3, e4 = (_emp_id(tenant_id, n) for n in (1, 2, 3, 4))
    rows = [
        ("dw-trace-1", e1, "trace-001", 12, "ok", 1200, "2026-07-30T10:00:00Z"),
        ("dw-trace-2", e1, "trace-002", 8, "ok", 800, "2026-07-30T10:30:00Z"),
        ("dw-trace-3", e2, "trace-003", 15, "ok", 1500, "2026-07-30T11:00:00Z"),
        ("dw-trace-4", e2, "trace-004", 6, "error", 600, "2026-07-30T11:30:00Z"),
        ("dw-trace-5", e3, "trace-005", 10, "ok", 1000, "2026-07-30T12:00:00Z"),
        ("dw-trace-6", e3, "trace-006", 4, "timeout", 30000, "2026-07-30T12:30:00Z"),
        ("dw-trace-7", e4, "trace-007", 20, "ok", 2000, "2026-07-30T13:00:00Z"),
        ("dw-trace-8", e4, "trace-008", 9, "ok", 900, "2026-07-30T13:30:00Z"),
        ("dw-trace-9", e1, "trace-009", 7, "ok", 700, "2026-07-30T14:00:00Z"),
        ("dw-trace-10", e2, "trace-010", 11, "ok", 1100, "2026-07-30T14:30:00Z"),
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
_EMPLOYEE_CONVERSATIONS: dict[str, dict[str, DwEmployeeConversation]] = {}
_EMPLOYEE_MESSAGES: dict[str, dict[str, DwEmployeeMessage]] = {}


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


def delete_document(tenant_id: str, doc_id: str) -> bool:
    """Delete a single document row. Used by DELETE /api/v1/dw/documents/{id}.

    Returns True if the row was removed, False if it was not present.
    The RAG fan-out (chunk + graph + lifecycle removal) is the API layer's
    responsibility — callers invoke the upstream /api/v1/rag/documents
    endpoint before/after this to keep RAG indexes in lock-step with
    the DW catalog.
    """
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if doc_id not in _DOCUMENTS.get(tenant_id, {}):
        return False
    del _DOCUMENTS[tenant_id][doc_id]
    return True


def get_employee(tenant_id: str, employee_id: str) -> DwEmployee | None:
    """Return a single employee by id, or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _EMPLOYEES[tenant_id].get(employee_id)


def create_employee(tenant_id: str, employee: DwEmployee) -> DwEmployee:
    """Create a new employee record."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _EMPLOYEES[tenant_id][employee.id] = employee
    return employee


def update_employee(tenant_id: str, employee_id: str, **kwargs) -> DwEmployee | None:
    """Update an employee's fields. Returns the updated employee or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    emp = _EMPLOYEES[tenant_id].get(employee_id)
    if emp is None:
        return None
    # Build updated employee (DwEmployee is frozen=True, so create new)
    data = {
        'id': emp.id, 'tenant_id': emp.tenant_id, 'name': emp.name,
        'code': emp.code, 'role': emp.role, 'status': emp.status,
        'model_id': emp.model_id, 'kb_ids': emp.kb_ids,
        'is_builtin': emp.is_builtin, 'system_prompt': emp.system_prompt,
        'tools': emp.tools, 'action_rids': emp.action_rids,
        'temperature': emp.temperature, 'max_tokens': emp.max_tokens,
        'top_p': emp.top_p, 'retrieval_method': emp.retrieval_method,
        'top_k': emp.top_k, 'rerank': emp.rerank,
    }
    data.update(kwargs)
    updated = DwEmployee(**data)
    _EMPLOYEES[tenant_id][employee_id] = updated
    return updated


def delete_employee(tenant_id: str, employee_id: str) -> bool:
    """Delete an employee. Returns True if deleted, False if not found."""
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if employee_id in _EMPLOYEES[tenant_id]:
        del _EMPLOYEES[tenant_id][employee_id]
        return True
    return False


def append_employee_task(
    tenant_id: str, task: DwEmployeeTask,
) -> DwEmployeeTask:
    """Persist a new employee task. Used by POST /employees/{id}/tasks."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _EMPLOYEE_TASKS[tenant_id][task.id] = task
    return task


def get_employee_task(
    tenant_id: str, task_id: str,
) -> DwEmployeeTask | None:
    """Return a single employee task by id, or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _EMPLOYEE_TASKS[tenant_id].get(task_id)


def update_employee_task(
    tenant_id: str, task_id: str, *, status: str, finished_at: str | None = None,
    duration_ms: int | None = None,
) -> DwEmployeeTask | None:
    """Update an employee task's status. Returns the updated task or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    task = _EMPLOYEE_TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    updated = DwEmployeeTask(
        id=task.id, tenant_id=task.tenant_id, employee_id=task.employee_id,
        title=task.title, status=status, started_at=task.started_at,
        finished_at=finished_at if finished_at is not None else task.finished_at,
        duration_ms=duration_ms if duration_ms is not None else task.duration_ms,
    )
    _EMPLOYEE_TASKS[tenant_id][task_id] = updated
    return updated


def append_evaluation(
    tenant_id: str, evaluation: DwEvaluation,
) -> DwEvaluation:
    """Persist a new evaluation. Used by POST /employees/{id}/evaluations."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _EVALUATIONS[tenant_id][evaluation.id] = evaluation
    return evaluation


def append_learning_feedback(
    tenant_id: str, feedback: DwLearningFeedback,
) -> DwLearningFeedback:
    """Persist learning feedback. Used by POST /learning/feedback."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _LEARNING_FEEDBACK[tenant_id][feedback.id] = feedback
    return feedback


def get_learning_feedback(
    tenant_id: str, feedback_id: str,
) -> DwLearningFeedback | None:
    """Return a single learning-feedback record by id, or None."""
    if not tenant_id or not feedback_id:
        return None
    _ensure_tenant(tenant_id)
    return _LEARNING_FEEDBACK[tenant_id].get(feedback_id)


def update_learning_feedback(
    tenant_id: str, feedback_id: str, **kwargs,
) -> DwLearningFeedback | None:
    """Update a learning feedback record. Returns updated or None if missing.

    Recognized kwargs (frozen dataclass → rebuild):
      - ``promoted_document_id`` (str): RAG document_id this feedback was
        promoted into (P2.10: feedback → KB re-ingest).
      - ``promoted_at`` (str): ISO8601 UTC timestamp of the promote action.
    Unknown kwargs are ignored (the field must exist on DwLearningFeedback).
    """
    if not tenant_id or not feedback_id:
        return None
    _ensure_tenant(tenant_id)
    fb = _LEARNING_FEEDBACK[tenant_id].get(feedback_id)
    if fb is None:
        return None
    data = {
        "id": fb.id, "tenant_id": fb.tenant_id, "employee_id": fb.employee_id,
        "scenario": fb.scenario, "rating": fb.rating, "comment": fb.comment,
        "feedback_at": fb.feedback_at,
        "promoted_document_id": fb.promoted_document_id,
        "promoted_at": fb.promoted_at,
    }
    for key, value in kwargs.items():
        if key in data:
            data[key] = value
    updated = DwLearningFeedback(**data)
    _LEARNING_FEEDBACK[tenant_id][feedback_id] = updated
    return updated


def append_collaboration(
    tenant_id: str, collab: DwCollaboration,
) -> DwCollaboration:
    """Persist a collaboration session. Used by POST /collaborations."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _COLLABORATIONS[tenant_id][collab.id] = collab
    return collab


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
# 数字员工端会话 / 消息（持久化用户与单个数字员工的对话历史）
# 关键约束：
#  1. tenant + user + employee 三维隔离（无 cross-tenant / cross-user）
#  2. conversation_id 即 Kernel SessionSandbox.session_id，dispatch 透传
#  3. 消息按 sequence 严格递增（避免分页乱序）
# ---------------------------------------------------------------------------
def _ensure_conv_buckets(tenant_id: str) -> None:
    _EMPLOYEE_CONVERSATIONS.setdefault(tenant_id, {})
    _EMPLOYEE_MESSAGES.setdefault(tenant_id, {})


def list_employee_conversations(
    tenant_id: str, user_id: str, employee_id: str,
) -> list[DwEmployeeConversation]:
    if not tenant_id or not user_id or not employee_id:
        return []
    _ensure_tenant(tenant_id)
    _ensure_conv_buckets(tenant_id)
    out = [
        c for c in _EMPLOYEE_CONVERSATIONS[tenant_id].values()
        if c.user_id == user_id and c.employee_id == employee_id
    ]
    return sorted(out, key=lambda c: c.updated_at, reverse=True)


def get_employee_conversation(
    tenant_id: str, conversation_id: str,
) -> DwEmployeeConversation | None:
    if not tenant_id or not conversation_id:
        return None
    _ensure_tenant(tenant_id)
    _ensure_conv_buckets(tenant_id)
    c = _EMPLOYEE_CONVERSATIONS[tenant_id].get(conversation_id)
    if c is None:
        return None
    return c


def put_employee_conversation(
    tenant_id: str, entity: DwEmployeeConversation,
) -> DwEmployeeConversation:
    if not tenant_id:
        return entity
    _ensure_tenant(tenant_id)
    _ensure_conv_buckets(tenant_id)
    _EMPLOYEE_CONVERSATIONS[tenant_id][entity.id] = entity
    return entity


def list_employee_messages(
    tenant_id: str, conversation_id: str,
) -> list[DwEmployeeMessage]:
    if not tenant_id or not conversation_id:
        return []
    _ensure_tenant(tenant_id)
    _ensure_conv_buckets(tenant_id)
    msgs = [
        m for m in _EMPLOYEE_MESSAGES[tenant_id].values()
        if m.conversation_id == conversation_id
    ]
    return sorted(msgs, key=lambda m: m.sequence)


def put_employee_message(
    tenant_id: str, entity: DwEmployeeMessage,
) -> DwEmployeeMessage:
    if not tenant_id:
        return entity
    _ensure_tenant(tenant_id)
    _ensure_conv_buckets(tenant_id)
    _EMPLOYEE_MESSAGES[tenant_id][entity.id] = entity
    # 触达会话 updated_at（直接读实体，调用方传新 updated_at 即可）
    conv = _EMPLOYEE_CONVERSATIONS[tenant_id].get(entity.conversation_id)
    if conv is not None:
        _EMPLOYEE_CONVERSATIONS[tenant_id][entity.conversation_id] = DwEmployeeConversation(
            id=conv.id, tenant_id=conv.tenant_id, user_id=conv.user_id,
            employee_id=conv.employee_id, title=conv.title,
            created_at=conv.created_at, updated_at=entity.created_at,
        )
    return entity


def next_employee_message_sequence(
    tenant_id: str, conversation_id: str,
) -> int:
    """返回 conversation 内下一条消息 sequence（已存在 + 1）。"""
    msgs = list_employee_messages(tenant_id, conversation_id)
    return (max((m.sequence for m in msgs), default=0) + 1)


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
    _EMPLOYEE_CONVERSATIONS.clear()
    _EMPLOYEE_MESSAGES.clear()


__all__ = [
    "DwAuthLogin", "DwCollaboration", "DwCommit", "DwDocument",
    "DwEmployee", "DwEmployeeTask", "DwEvaluation", "DwExtract",
    "DwKnowledgeBase", "DwLearningExtract", "DwLearningFeedback",
    "DwModel", "DwTool", "DwTrace",
    "DwEmployeeConversation", "DwEmployeeMessage",
    "list_auth_logins", "list_collaborations", "list_commits",
    "list_documents", "append_document", "list_employees",
    "list_employee_tasks", "list_evaluations", "list_extracts",
    "list_knowledge_bases", "list_learning_extracts",
    "list_learning_feedback", "list_models", "list_tools",
    "list_traces", "reset_store",
    "create_employee", "update_employee", "delete_employee",
    "list_employee_conversations", "get_employee_conversation",
    "put_employee_conversation", "list_employee_messages",
    "put_employee_message", "next_employee_message_sequence",
    "get_learning_feedback", "update_learning_feedback",
]
