"""In-memory repository for the copilot (P2-W2 batch).

Data shape:
    _CONVERSATIONS / _QUERIES / _PLANS / _INTENTS / _TEMPLATES /
    _ACTIONS / _DATASOURCES / _KNOWLEDGE_BASES / _MODELS / _ASSETS:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = entity dataclass

The store is tenant-scoped: callers MUST pass the tenant binding
(``ctx.tenant_id``) and the lookup rejects entities that don't belong
to that tenant (ADR-0014 cross-tenant rule).

Seed data per tenant:
    >= 10 conversations, >= 20 queries, >= 5 plans, >= 5 intents,
    >= 5 templates, >= 10 actions, >= 3 datasources,
    >= 5 knowledge-bases, >= 3 models.
Tests rely on these minima; bumping is allowed but tests assert
``>= N`` rather than equality.
"""
from __future__ import annotations

from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Conversation:
    id: str
    tenant_id: str
    title: str
    summary: str = ""
    message_count: int = 0
    created_at: str = ""


@dataclass(frozen=True)
class QueryLog:
    id: str
    tenant_id: str
    sql: str
    datasource_id: str
    status: str = "ok"
    row_count: int = 0
    created_at: str = ""


@dataclass(frozen=True)
class Plan:
    id: str
    tenant_id: str
    name: str
    goal: str
    steps: tuple[str, ...] = field(default_factory=tuple)
    status: str = "draft"


@dataclass(frozen=True)
class Intent:
    id: str
    tenant_id: str
    name: str
    keywords: tuple[str, ...] = field(default_factory=tuple)
    confidence: float = 0.0


@dataclass(frozen=True)
class Template:
    id: str
    tenant_id: str
    name: str
    category: str
    description: str = ""


@dataclass(frozen=True)
class Action:
    id: str
    tenant_id: str
    name: str
    description: str
    category: str = "general"
    keywords: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class CodeGen:
    id: str
    tenant_id: str
    language: str
    framework: str
    snippet: str


@dataclass(frozen=True)
class Datasource:
    id: str
    tenant_id: str
    name: str
    type: str
    description: str = ""
    status: str = "active"


@dataclass(frozen=True)
class KnowledgeBase:
    id: str
    tenant_id: str
    name: str
    description: str
    doc_count: int = 0


@dataclass(frozen=True)
class ModelInfo:
    id: str
    tenant_id: str
    name: str
    provider: str
    modality: str = "multimodal"
    status: str = "available"


@dataclass
class AssetRecord:
    id: str
    tenant_id: str
    filename: str
    content_type: str
    embedding_dim: int = 1536


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_conversations(tenant_id: str) -> dict[str, Conversation]:
    rows = [
        ("conv-1", "Sales pipeline analysis", "Q3 pipeline review"),
        ("conv-2", "Customer churn prediction", "Identify at-risk accounts"),
        ("conv-3", "Financial reconciliation", "Monthly close automation"),
        ("conv-4", "Contract risk review", "Flag non-standard clauses"),
        ("conv-5", "Onboarding checklist", "New employee setup flow"),
        ("conv-6", "Inventory optimization", "Reduce stockout rate"),
        ("conv-7", "Marketing campaign ROI", "Channel attribution"),
        ("conv-8", "HR leave balance", "PTO accrual query"),
        ("conv-9", "IT incident triage", "P1 ticket routing"),
        ("conv-10", "Vendor performance", "SLA compliance scorecard"),
    ]
    return {
        rid: Conversation(id=rid, tenant_id=tenant_id, title=title, summary=summary)
        for rid, title, summary in rows
    }


def _seed_queries(tenant_id: str) -> dict[str, QueryLog]:
    base = [
        "SELECT * FROM orders WHERE status='paid'",
        "SELECT COUNT(*) FROM customers WHERE created_at > '2026-01-01'",
        "SELECT name, email FROM users ORDER BY created_at DESC LIMIT 50",
        "SELECT product_name, SUM(qty) FROM sales GROUP BY product_name",
        "SELECT region, AVG(revenue) FROM territories GROUP BY region",
        "SELECT id FROM contracts WHERE risk_level='high'",
        "SELECT dept, COUNT(*) FROM employees GROUP BY dept",
        "SELECT ticket_id, priority FROM incidents WHERE status='open'",
        "SELECT vendor, on_time_rate FROM deliveries ORDER BY on_time_rate",
        "SELECT sku, stock_qty FROM inventory WHERE stock_qty < 10",
        "SELECT campaign, clicks, conversions FROM ads WHERE clicks > 100",
        "SELECT account, balance FROM ledger WHERE balance < 0",
        "SELECT project, progress FROM tasks WHERE progress < 0.5",
        "SELECT employee, leave_days FROM pto WHERE leave_days > 10",
        "SELECT channel, roi FROM marketing ORDER BY roi DESC",
        "SELECT customer, lifetime_value FROM crm ORDER BY lifetime_value DESC",
        "SELECT supplier, defect_rate FROM qc WHERE defect_rate > 0.02",
        "SELECT warehouse, capacity FROM storage WHERE capacity < 0.2",
        "SELECT team, velocity FROM sprints ORDER BY velocity DESC",
        "SELECT country, users FROM geo WHERE users > 1000",
    ]
    return {
        f"q-{i+1}": QueryLog(
            id=f"q-{i+1}",
            tenant_id=tenant_id,
            sql=sql,
            datasource_id="ds-1",
            row_count=(i * 7) % 100,
        )
        for i, sql in enumerate(base)
    }


def _seed_plans(tenant_id: str) -> dict[str, Plan]:
    rows = [
        ("plan-1", "Monthly close", "Automate financial reconciliation",
         ("Extract ledger", "Reconcile accounts", "Generate report")),
        ("plan-2", "Customer onboarding", "Streamline new account setup",
         ("Verify identity", "Create workspace", "Send welcome")),
        ("plan-3", "Incident response", "Triage and resolve P1 incidents",
         ("Classify severity", "Assign owner", "Escalate")),
        ("plan-4", "Campaign launch", "Coordinate multi-channel rollout",
         ("Brief creative", "Schedule posts", "Track metrics")),
        ("plan-5", "Vendor renewal", "Review and renegotiate contracts",
         ("Collect usage", "Score vendors", "Negotiate terms")),
    ]
    return {
        rid: Plan(id=rid, tenant_id=tenant_id, name=name, goal=goal, steps=steps)
        for rid, name, goal, steps in rows
    }


def _seed_intents(tenant_id: str) -> dict[str, Intent]:
    rows = [
        ("intent-schedule", "schedule", ("schedule", "meeting", "calendar", "book")),
        ("intent-query", "query", ("query", "select", "data", "report", "sql")),
        ("intent-generate", "generate", ("generate", "create", "build", "make")),
        ("intent-analyze", "analyze", ("analyze", "review", "audit", "check")),
        ("intent-approve", "approve", ("approve", "reject", "sign", "confirm")),
    ]
    return {
        rid: Intent(id=rid, tenant_id=tenant_id, name=name, keywords=kw)
        for rid, name, kw in rows
    }


def _seed_templates(tenant_id: str) -> dict[str, Template]:
    rows = [
        ("tpl-dashboard", "Dashboard", "report", "KPI dashboard skeleton"),
        ("tpl-form", "Form", "form", "Input form specification"),
        ("tpl-approval", "Approval flow", "workflow", "Multi-step approval"),
        ("tpl-report", "Report", "report", "Periodic summary report"),
        ("tpl-notify", "Notification", "workflow", "Alert / reminder template"),
    ]
    return {
        rid: Template(id=rid, tenant_id=tenant_id, name=name, category=cat, description=desc)
        for rid, name, cat, desc in rows
    }


def _seed_actions(tenant_id: str) -> dict[str, Action]:
    rows = [
        ("act-create-order", "Create Order", "Place a new sales order", "sales", ("order", "create", "buy")),
        ("act-send-email", "Send Email", "Dispatch an email notification", "comms", ("email", "send", "notify")),
        ("act-approve-leave", "Approve Leave", "Approve an employee leave request", "hr", ("leave", "approve", "pto")),
        ("act-run-report", "Run Report", "Execute a scheduled report job", "reporting", ("report", "run", "generate")),
        ("act-update-crm", "Update CRM", "Modify a customer record", "crm", ("customer", "update", "edit")),
        ("act-close-ticket", "Close Ticket", "Resolve a support ticket", "support", ("ticket", "close", "resolve")),
        ("act-raise-invoice", "Raise Invoice", "Issue an invoice to a customer", "finance", ("invoice", "bill", "charge")),
        ("act-schedule-meeting", "Schedule Meeting", "Book a calendar meeting", "calendar", ("meeting", "schedule", "book")),
        ("act-export-data", "Export Data", "Download data as CSV/Excel", "data", ("export", "download", "csv")),
        ("act-onboard-employee", "Onboard Employee", "Provision a new employee account", "hr", ("onboard", "provision", "setup")),
    ]
    return {
        rid: Action(
            id=rid, tenant_id=tenant_id, name=name, description=desc,
            category=cat, keywords=kw,
        )
        for rid, name, desc, cat, kw in rows
    }


def _seed_datasources(tenant_id: str) -> dict[str, Datasource]:
    rows = [
        ("ds-1", "Primary PostgreSQL", "postgresql", "Main OLTP database"),
        ("ds-2", "Data Warehouse", "clickhouse", "Analytical warehouse"),
        ("ds-3", "Object Storage", "minio", "S3-compatible object store"),
    ]
    return {
        rid: Datasource(id=rid, tenant_id=tenant_id, name=name, type=typ, description=desc)
        for rid, name, typ, desc in rows
    }


def _seed_knowledge_bases(tenant_id: str) -> dict[str, KnowledgeBase]:
    rows = [
        ("kb-1", "Product Manual", "Platform product documentation", 320),
        ("kb-2", "Customer Contracts", "Signed contract repository", 1287),
        ("kb-3", "HR Policies", "Internal HR handbook", 45),
        ("kb-4", "API Reference", "OpenAPI specs and examples", 112),
        ("kb-5", "Runbooks", "Operations and on-call runbooks", 28),
    ]
    return {
        rid: KnowledgeBase(id=rid, tenant_id=tenant_id, name=name, description=desc, doc_count=docs)
        for rid, name, desc, docs in rows
    }


def _seed_models(tenant_id: str) -> dict[str, ModelInfo]:
    rows = [
        ("model-doubao-vl", "Doubao Vision", "Volcano", "multimodal"),
        ("model-gpt4o", "GPT-4o", "OpenAI", "multimodal"),
        ("model-claude", "Claude Sonnet", "Anthropic", "text"),
    ]
    return {
        rid: ModelInfo(id=rid, tenant_id=tenant_id, name=name, provider=prov, modality=mod)
        for rid, name, prov, mod in rows
    }


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_CONVERSATIONS: dict[str, dict[str, Conversation]] = {}
_QUERIES: dict[str, dict[str, QueryLog]] = {}
_PLANS: dict[str, dict[str, Plan]] = {}
_INTENTS: dict[str, dict[str, Intent]] = {}
_TEMPLATES: dict[str, dict[str, Template]] = {}
_ACTIONS: dict[str, dict[str, Action]] = {}
_DATASOURCES: dict[str, dict[str, Datasource]] = {}
_KNOWLEDGE_BASES: dict[str, dict[str, KnowledgeBase]] = {}
_MODELS: dict[str, dict[str, ModelInfo]] = {}
_ASSETS: dict[str, dict[str, AssetRecord]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return
    if tenant_id not in _CONVERSATIONS:
        _CONVERSATIONS[tenant_id] = _seed_conversations(tenant_id)
    if tenant_id not in _QUERIES:
        _QUERIES[tenant_id] = _seed_queries(tenant_id)
    if tenant_id not in _PLANS:
        _PLANS[tenant_id] = _seed_plans(tenant_id)
    if tenant_id not in _INTENTS:
        _INTENTS[tenant_id] = _seed_intents(tenant_id)
    if tenant_id not in _TEMPLATES:
        _TEMPLATES[tenant_id] = _seed_templates(tenant_id)
    if tenant_id not in _ACTIONS:
        _ACTIONS[tenant_id] = _seed_actions(tenant_id)
    if tenant_id not in _DATASOURCES:
        _DATASOURCES[tenant_id] = _seed_datasources(tenant_id)
    if tenant_id not in _KNOWLEDGE_BASES:
        _KNOWLEDGE_BASES[tenant_id] = _seed_knowledge_bases(tenant_id)
    if tenant_id not in _MODELS:
        _MODELS[tenant_id] = _seed_models(tenant_id)
    _ASSETS.setdefault(tenant_id, {})


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_conversations(tenant_id: str) -> list[Conversation]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_CONVERSATIONS[tenant_id].values(), key=lambda c: c.id)


def list_queries(tenant_id: str) -> list[QueryLog]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_QUERIES[tenant_id].values(), key=lambda q: q.id)


def list_plans(tenant_id: str) -> list[Plan]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_PLANS[tenant_id].values(), key=lambda p: p.id)


def list_intents(tenant_id: str) -> list[Intent]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_INTENTS[tenant_id].values(), key=lambda i: i.id)


def list_templates(tenant_id: str) -> list[Template]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_TEMPLATES[tenant_id].values(), key=lambda t: t.id)


def list_actions(tenant_id: str) -> list[Action]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_ACTIONS[tenant_id].values(), key=lambda a: a.id)


def list_datasources(tenant_id: str) -> list[Datasource]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_DATASOURCES[tenant_id].values(), key=lambda d: d.id)


def list_knowledge_bases(tenant_id: str) -> list[KnowledgeBase]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_KNOWLEDGE_BASES[tenant_id].values(), key=lambda k: k.id)


def list_models(tenant_id: str) -> list[ModelInfo]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_MODELS[tenant_id].values(), key=lambda m: m.id)


def put_asset(tenant_id: str, asset: AssetRecord) -> AssetRecord:
    if not tenant_id:
        return asset
    _ensure_tenant(tenant_id)
    _ASSETS[tenant_id][asset.id] = asset
    return asset


def get_asset(tenant_id: str, asset_id: str) -> AssetRecord | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _ASSETS[tenant_id].get(asset_id)


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _CONVERSATIONS.clear()
    _QUERIES.clear()
    _PLANS.clear()
    _INTENTS.clear()
    _TEMPLATES.clear()
    _ACTIONS.clear()
    _DATASOURCES.clear()
    _KNOWLEDGE_BASES.clear()
    _MODELS.clear()
    _ASSETS.clear()
