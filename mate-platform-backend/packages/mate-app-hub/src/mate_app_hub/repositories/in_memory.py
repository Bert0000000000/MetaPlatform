"""In-memory repository for the apphub (P2-W2 batch).

Data shape:
    _APPS / _GROUPS / _MODULES / _PAGES / _TEMPLATES:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = entity dataclass

The store is intentionally tenant-scoped: callers MUST pass the
tenant binding (`ctx.tenant_id`) and the lookup rejects entities
that don't belong to that tenant. This is the layer at which the
ADR-0014 cross-tenant rule is enforced.

Seed data:
    >= 15 apps (kb / rag / llmgw / mcp / obs / msg / ont / agent /
    arch / copilot / dashboard / dw / a2a / wfe / data),
    3 groups, 8 modules, 12 pages, 6 templates per tenant. Tests
    rely on these minima; bumping them is allowed but tests
    assert `>= N` rather than equality.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ApphubApp:
    id: str
    tenant_id: str
    name: str
    code: str
    category: str
    description: str
    version: str = "1.0.0"
    owner: str = "platform-team"
    tags: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ApphubGroup:
    id: str
    tenant_id: str
    name: str
    code: str
    icon: str
    sort_order: int = 0


@dataclass(frozen=True)
class ApphubModule:
    id: str
    tenant_id: str
    name: str
    code: str
    app_code: str
    description: str
    entry_path: str


@dataclass(frozen=True)
class ApphubPage:
    id: str
    tenant_id: str
    name: str
    code: str
    module_code: str
    layout: str
    schema_version: int = 1


@dataclass(frozen=True)
class ApphubTemplate:
    id: str
    tenant_id: str
    name: str
    code: str
    template_type: str  # "workflow" | "form" | "approval" | ...
    description: str
    content: dict[str, Any]


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_apps(tenant_id: str) -> dict[str, ApphubApp]:
    catalog: list[tuple[str, str, str, str]] = [
        ("kb", "Knowledge Base", "knowledge", "向量检索 + RAG 知识库"),
        ("rag", "RAG Pipeline", "knowledge", "检索增强生成管道"),
        ("llmgw", "LLM Gateway", "platform", "统一 LLM 网关"),
        ("mcp", "MCP Servers", "platform", "Model Context Protocol 服务市场"),
        ("obs", "Observability", "platform", "日志 / 指标 / 链路追踪"),
        ("msg", "Messaging", "platform", "Kafka / RabbitMQ 事件总线"),
        ("ont", "Ontology", "knowledge", "业务本体概念库"),
        ("agent", "Agent Runtime", "knowledge", "Agent 编排执行"),
        ("arch", "Architecture Center", "platform", "应用 / 数据 / 流程治理"),
        ("copilot", "Copilot", "knowledge", "AI 业务助手"),
        ("dashboard", "Dashboard", "platform", "工作台 / 仪表盘"),
        ("dw", "Data Warehouse", "data", "湖仓 ADS / DWD / DWS"),
        ("a2a", "A2A Protocol", "platform", "Agent-to-Agent 协议"),
        ("wfe", "Workflow Engine", "platform", "Flowable BPMN 引擎"),
        ("data", "Data Assets", "data", "D0-D8 数据资产注册"),
    ]
    return {
        code: ApphubApp(
            id=f"app-{code}",
            tenant_id=tenant_id,
            name=name,
            code=code,
            category=category,
            description=desc,
            tags=(category, "p2w2"),
        )
        for code, name, category, desc in catalog
    }


def _seed_groups(tenant_id: str) -> dict[str, ApphubGroup]:
    return {
        "knowledge": ApphubGroup(
            id="grp-knowledge",
            tenant_id=tenant_id,
            name="Knowledge",
            code="knowledge",
            icon="book",
            sort_order=10,
        ),
        "platform": ApphubGroup(
            id="grp-platform",
            tenant_id=tenant_id,
            name="Platform",
            code="platform",
            icon="server",
            sort_order=20,
        ),
        "data": ApphubGroup(
            id="grp-data",
            tenant_id=tenant_id,
            name="Data",
            code="data",
            icon="database",
            sort_order=30,
        ),
    }


def _seed_modules(tenant_id: str) -> dict[str, ApphubModule]:
    modules: list[tuple[str, str, str, str, str]] = [
        ("kb-search", "kb", "kb", "语义检索", "/kb/search"),
        ("kb-doc", "kb", "kb", "文档管理", "/kb/docs"),
        ("rag-pipeline", "rag", "rag", "RAG 管道配置", "/rag/pipelines"),
        ("arch-apps", "arch", "arch", "应用注册", "/arch/applications"),
        ("arch-data", "arch", "arch", "数据资产", "/arch/data-assets"),
        ("dw-dwd", "dw", "dw", "明细层管理", "/dw/dwd"),
        ("dw-dws", "dw", "dw", "汇总层管理", "/dw/dws"),
        ("copilot-chat", "copilot", "copilot", "对话工作台", "/copilot/chat"),
    ]
    return {
        code: ApphubModule(
            id=f"mod-{code}",
            tenant_id=tenant_id,
            name=name,
            code=code,
            app_code=app_code,
            description=desc,
            entry_path=entry,
        )
        for code, name, app_code, desc, entry in modules
    }


def _seed_pages(tenant_id: str) -> dict[str, ApphubPage]:
    pages: list[tuple[str, str, str, str, str]] = [
        ("kb-list", "知识库列表", "kb", "kb", "two_col"),
        ("kb-detail", "知识库详情", "kb", "kb", "split"),
        ("rag-run", "RAG 执行页", "rag", "rag", "single"),
        ("arch-app-list", "应用列表", "arch", "arch", "two_col"),
        ("arch-app-detail", "应用详情", "arch", "arch", "tabs"),
        ("arch-data-list", "数据资产列表", "arch", "arch", "table"),
        ("dw-dwd-list", "DWD 列表", "dw", "dw", "table"),
        ("dw-dws-list", "DWS 列表", "dw", "dw", "table"),
        ("copilot-home", "Copilot 首页", "copilot", "copilot", "split"),
        ("copilot-thread", "对话页", "copilot", "copilot", "single"),
        ("dashboard-home", "工作台首页", "dashboard", "dashboard", "grid"),
        ("dashboard-metric", "指标详情", "dashboard", "dashboard", "single"),
    ]
    return {
        code: ApphubPage(
            id=f"page-{code}",
            tenant_id=tenant_id,
            name=name,
            code=code,
            module_code=module_code,
            layout=layout,
        )
        for code, name, _app_code, module_code, layout in pages
    }


def _seed_templates(tenant_id: str) -> dict[str, ApphubTemplate]:
    return {
        f"tpl-{kind}": ApphubTemplate(
            id=f"tpl-{kind}",
            tenant_id=tenant_id,
            name=name,
            code=kind,
            template_type=kind_type,
            description=desc,
            content={"nodes": [{"type": "start"}, {"type": "end"}]},
        )
        for kind, name, kind_type, desc in [
            ("approval", "通用审批模板", "workflow", "标准审批流"),
            ("notify", "通知发送模板", "workflow", "邮件 / 短信通知"),
            ("form-request", "通用申请表单", "form", "员工请假 / 报销"),
            ("form-feedback", "通用反馈表单", "form", "产品反馈"),
            ("approval-multi", "多级审批模板", "approval", "3 级审批"),
            ("form-survey", "问卷模板", "form", "满意度问卷"),
        ]
    }


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_APPS: dict[str, dict[str, ApphubApp]] = {}
_GROUPS: dict[str, dict[str, ApphubGroup]] = {}
_MODULES: dict[str, dict[str, ApphubModule]] = {}
_PAGES: dict[str, dict[str, ApphubPage]] = {}
_TEMPLATES: dict[str, dict[str, ApphubTemplate]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return  # anonymous lookups return empty, see list_*() functions
    if tenant_id not in _APPS:
        _APPS[tenant_id] = _seed_apps(tenant_id)
    if tenant_id not in _GROUPS:
        _GROUPS[tenant_id] = _seed_groups(tenant_id)
    if tenant_id not in _MODULES:
        _MODULES[tenant_id] = _seed_modules(tenant_id)
    if tenant_id not in _PAGES:
        _PAGES[tenant_id] = _seed_pages(tenant_id)
    if tenant_id not in _TEMPLATES:
        _TEMPLATES[tenant_id] = _seed_templates(tenant_id)


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_apps(tenant_id: str) -> list[ApphubApp]:
    """Return the registered applications for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_APPS[tenant_id].values(), key=lambda a: (a.category, a.name))


def list_groups(tenant_id: str) -> list[ApphubGroup]:
    """Return the application groups for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_GROUPS[tenant_id].values(), key=lambda g: g.sort_order)


def list_modules(tenant_id: str) -> list[ApphubModule]:
    """Return the business modules for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_MODULES[tenant_id].values(), key=lambda m: m.app_code)


def list_pages(tenant_id: str) -> list[ApphubPage]:
    """Return the page templates for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_PAGES[tenant_id].values(), key=lambda p: p.module_code)


def list_templates(tenant_id: str) -> list[ApphubTemplate]:
    """Return workflow / form templates for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_TEMPLATES[tenant_id].values(), key=lambda t: (t.template_type, t.name))


# ---------------------------------------------------------------------------
# Public write API (BUSINESS-SLICES deep implementation)
# ---------------------------------------------------------------------------
def get_app(tenant_id: str, code: str) -> ApphubApp | None:
    """Return a single app by code, or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _APPS[tenant_id].get(code)


def put_app(tenant_id: str, app: ApphubApp) -> ApphubApp:
    """Insert or replace an app."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _APPS[tenant_id][app.code] = app
    return app


def delete_app(tenant_id: str, code: str) -> bool:
    """Delete an app by code. Returns True if deleted."""
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if code not in _APPS[tenant_id]:
        return False
    del _APPS[tenant_id][code]
    return True


def get_group(tenant_id: str, code: str) -> ApphubGroup | None:
    """Return a single group by code, or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _GROUPS[tenant_id].get(code)


def put_group(tenant_id: str, group: ApphubGroup) -> ApphubGroup:
    """Insert or replace a group."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _GROUPS[tenant_id][group.code] = group
    return group


def delete_group(tenant_id: str, code: str) -> bool:
    """Delete a group by code. Returns True if deleted."""
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if code not in _GROUPS[tenant_id]:
        return False
    del _GROUPS[tenant_id][code]
    return True


def get_module(tenant_id: str, code: str) -> ApphubModule | None:
    """Return a single module by code, or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _MODULES[tenant_id].get(code)


def put_module(tenant_id: str, module: ApphubModule) -> ApphubModule:
    """Insert or replace a module."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _MODULES[tenant_id][module.code] = module
    return module


def put_page(tenant_id: str, page: ApphubPage) -> ApphubPage:
    """Insert or replace a page."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _PAGES[tenant_id][page.code] = page
    return page


def get_template(tenant_id: str, code: str) -> ApphubTemplate | None:
    """Return a single template by code, or None."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _TEMPLATES[tenant_id].get(code)


def put_template(tenant_id: str, template: ApphubTemplate) -> ApphubTemplate:
    """Insert or replace a template."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    _TEMPLATES[tenant_id][template.code] = template
    return template


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _APPS.clear()
    _GROUPS.clear()
    _MODULES.clear()
    _PAGES.clear()
    _TEMPLATES.clear()
