"""In-memory repository for the architecture center (P2-W2 batch).

All entities are tenant-scoped. Seeds:
    >= 20 applications, 15 capabilities, 10 data-assets,
    5 orgs, 5 principles, 10 tech-stack entries.

Dataclasses are framework-agnostic so the v3.2 Paimon / Postgres
adapter can reuse them without leaking FastAPI types.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Application:
    id: str
    tenant_id: str
    name: str
    code: str
    category: str
    owner: str
    status: str = "active"
    description: str = ""


@dataclass(frozen=True)
class BusinessProcess:
    id: str
    tenant_id: str
    name: str
    code: str
    application_id: str
    description: str = ""


@dataclass(frozen=True)
class Capability:
    id: str
    tenant_id: str
    name: str
    code: str
    parent_id: str = ""
    level: int = 1
    description: str = ""


@dataclass(frozen=True)
class DataAsset:
    id: str
    tenant_id: str
    name: str
    code: str
    layer: str  # D0-D8
    domain: str
    owner: str
    status: str = "accepted"


@dataclass(frozen=True)
class DataEntity:
    id: str
    tenant_id: str
    name: str
    code: str
    data_asset_id: str
    fields: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class DataFlow:
    id: str
    tenant_id: str
    name: str
    code: str
    source_entity_id: str
    target_entity_id: str
    pipeline_spec: str = ""


@dataclass(frozen=True)
class DataStandard:
    id: str
    tenant_id: str
    name: str
    code: str
    domain: str
    description: str = ""


@dataclass(frozen=True)
class DataDomain:
    id: str
    tenant_id: str
    name: str
    code: str
    parent_id: str = ""


@dataclass(frozen=True)
class Deployment:
    id: str
    tenant_id: str
    name: str
    code: str
    application_id: str
    environment: str = "staging"
    cluster: str = "default"


@dataclass(frozen=True)
class Infrastructure:
    id: str
    tenant_id: str
    name: str
    code: str
    kind: str  # k8s / vm / rds / ...
    region: str = "cn-beijing"


@dataclass(frozen=True)
class GovernancePrincipleCategory:
    id: str
    tenant_id: str
    name: str
    code: str
    sort_order: int = 0


@dataclass(frozen=True)
class GovernancePrinciple:
    id: str
    tenant_id: str
    name: str
    code: str
    category_id: str
    description: str = ""


@dataclass(frozen=True)
class ReviewTemplate:
    id: str
    tenant_id: str
    name: str
    code: str
    category: str
    checklist: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ReviewTicket:
    id: str
    tenant_id: str
    title: str
    application_id: str
    template_id: str
    status: str = "open"


@dataclass(frozen=True)
class TechDebt:
    id: str
    tenant_id: str
    title: str
    application_id: str
    severity: str = "medium"
    status: str = "open"


@dataclass(frozen=True)
class ImpactAnalysisResult:
    node_id: str
    node_type: str
    impacted_ids: tuple[str, ...]


@dataclass(frozen=True)
class OntologyMappingRule:
    id: str
    tenant_id: str
    name: str
    code: str
    source_concept: str
    target_concept: str


@dataclass(frozen=True)
class OntologyMappingChange:
    id: str
    tenant_id: str
    rule_id: str
    change_type: str  # created / updated / deleted
    description: str = ""


@dataclass(frozen=True)
class Org:
    id: str
    tenant_id: str
    name: str
    code: str
    parent_id: str = ""
    level: int = 1


@dataclass(frozen=True)
class Role:
    id: str
    tenant_id: str
    name: str
    code: str
    org_id: str


@dataclass(frozen=True)
class TechStack:
    id: str
    tenant_id: str
    name: str
    code: str
    category: str


@dataclass(frozen=True)
class TechnologyComponent:
    id: str
    tenant_id: str
    name: str
    code: str
    category: str
    vendor: str = "open-source"


@dataclass(frozen=True)
class TechnologyRadarEntry:
    id: str
    tenant_id: str
    name: str
    code: str
    quadrant: str  # techniques / platforms / tools / languages
    ring: str  # adopt / trial / assess / hold


@dataclass(frozen=True)
class TechnologyStack:
    id: str
    tenant_id: str
    name: str
    code: str
    application_id: str
    component_ids: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ValueStream:
    id: str
    tenant_id: str
    name: str
    code: str
    stages: tuple[str, ...] = field(default_factory=tuple)
    description: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
_APPS_CATALOG: list[tuple[str, str, str, str]] = [
    ("kb", "Knowledge Base", "knowledge", "知识库"),
    ("rag", "RAG Pipeline", "knowledge", "检索增强生成"),
    ("llmgw", "LLM Gateway", "platform", "LLM 网关"),
    ("mcp", "MCP Servers", "platform", "Model Context Protocol"),
    ("obs", "Observability", "platform", "可观测性"),
    ("msg", "Messaging", "platform", "消息总线"),
    ("ont", "Ontology", "knowledge", "业务本体"),
    ("agent", "Agent Runtime", "knowledge", "Agent 运行时"),
    ("arch", "Architecture Center", "platform", "架构中心"),
    ("copilot", "Copilot", "knowledge", "AI 助手"),
    ("dashboard", "Dashboard", "platform", "工作台"),
    ("dw", "Data Warehouse", "data", "湖仓"),
    ("a2a", "A2A Protocol", "platform", "Agent-to-Agent"),
    ("wfe", "Workflow Engine", "platform", "工作流引擎"),
    ("data", "Data Assets", "data", "数据资产"),
    ("iam", "Identity & Access", "platform", "IAM"),
    ("sec", "Security", "platform", "安全合规"),
    ("billing", "Billing", "platform", "计费"),
    ("notify", "Notifications", "platform", "通知中心"),
    ("search", "Search", "platform", "全局搜索"),
]


def _seed_applications(tenant_id: str) -> dict[str, Application]:
    return {
        code: Application(
            id=f"app-{code}",
            tenant_id=tenant_id,
            name=name,
            code=code,
            category=category,
            owner=f"{code}-team",
            description=desc,
        )
        for code, name, category, desc in _APPS_CATALOG
    }


def _seed_business_processes(tenant_id: str) -> dict[str, BusinessProcess]:
    items: list[tuple[str, str, str]] = [
        ("kb-ingest", "KB Ingest", "kb"),
        ("kb-query", "KB Query", "kb"),
        ("rag-build", "RAG Build", "rag"),
        ("rag-query", "RAG Query", "rag"),
        ("arch-review", "Arch Review", "arch"),
        ("deploy-app", "Deploy Application", "arch"),
        ("dw-etl", "DW ETL", "dw"),
        ("dw-query", "DW Query", "dw"),
    ]
    return {
        code: BusinessProcess(
            id=f"bp-{code}",
            tenant_id=tenant_id,
            name=name,
            code=code,
            application_id=f"app-{app_code}",
        )
        for code, name, app_code in items
    }


def _seed_capabilities(tenant_id: str) -> dict[str, Capability]:
    # 3-level capability tree (root → child → grandchild)
    items: list[tuple[str, str, str, int]] = [
        ("cap-data", "Data", "", 1),
        ("cap-data-ingest", "Data Ingest", "cap-data", 2),
        ("cap-data-store", "Data Store", "cap-data", 2),
        ("cap-data-query", "Data Query", "cap-data", 2),
        ("cap-data-ingest-batch", "Batch Ingest", "cap-data-ingest", 3),
        ("cap-data-ingest-stream", "Stream Ingest", "cap-data-ingest", 3),
        ("cap-data-store-dwd", "DWD Store", "cap-data-store", 3),
        ("cap-data-store-dws", "DWS Store", "cap-data-store", 3),
        ("cap-data-query-olap", "OLAP Query", "cap-data-query", 3),
        ("cap-data-query-bi", "BI Query", "cap-data-query", 3),
        ("cap-knowledge", "Knowledge", "", 1),
        ("cap-knowledge-index", "Indexing", "cap-knowledge", 2),
        ("cap-knowledge-search", "Search", "cap-knowledge", 2),
        ("cap-knowledge-rag", "RAG", "cap-knowledge", 2),
        ("cap-platform", "Platform", "", 1),
    ]
    return {
        code: Capability(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            parent_id=parent,
            level=level,
        )
        for code, name, parent, level in items
    }


_DATA_LAYERS = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]


def _seed_data_assets(tenant_id: str) -> dict[str, DataAsset]:
    items: list[tuple[str, str, str, str]] = [
        ("da-user-events", "User Events", "D3", "user"),
        ("da-user-profile", "User Profile", "D5", "user"),
        ("da-order-fact", "Order Fact", "D5", "order"),
        ("da-order-detail", "Order Detail", "D3", "order"),
        ("da-payment", "Payment", "D5", "finance"),
        ("da-product-catalog", "Product Catalog", "D2", "product"),
        ("da-inventory", "Inventory", "D3", "supply"),
        ("da-log-access", "Access Logs", "D0", "ops"),
        ("da-log-audit", "Audit Logs", "D1", "ops"),
        ("da-metric-kpi", "KPI Metrics", "D8", "ops"),
        ("da-vector-embedding", "Vector Embeddings", "D7", "ai"),
        ("da-graph-ontology", "Ontology Graph", "D7", "ai"),
    ]
    return {
        code: DataAsset(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            layer=layer,
            domain=domain,
            owner=f"{domain}-team",
        )
        for code, name, layer, domain in items
    }


def _seed_data_entities(tenant_id: str) -> dict[str, DataEntity]:
    items: list[tuple[str, str, str, tuple[str, ...]]] = [
        ("de-user-events", "user_events", "da-user-events", ("uid", "event", "ts")),
        ("de-user-profile", "user_profile", "da-user-profile", ("uid", "name", "email")),
        ("de-order-fact", "order_fact", "da-order-fact", ("order_id", "uid", "amount")),
        ("de-order-detail", "order_detail", "da-order-detail", ("order_id", "sku", "qty")),
        ("de-payment", "payment", "da-payment", ("pay_id", "order_id", "method")),
    ]
    return {
        code: DataEntity(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            data_asset_id=asset,
            fields=fields,
        )
        for code, name, asset, fields in items
    }


def _seed_data_flows(tenant_id: str) -> dict[str, DataFlow]:
    items: list[tuple[str, str, str, str]] = [
        ("df-events-to-profile", "Events → Profile", "de-user-events", "de-user-profile"),
        ("df-detail-to-fact", "Detail → Fact", "de-order-detail", "de-order-fact"),
        ("df-fact-to-payment", "Fact → Payment", "de-order-fact", "de-payment"),
    ]
    return {
        code: DataFlow(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            source_entity_id=src,
            target_entity_id=tgt,
        )
        for code, name, src, tgt in items
    }


def _seed_data_standards(tenant_id: str) -> dict[str, DataStandard]:
    items: list[tuple[str, str, str]] = [
        ("ds-naming", "Naming Convention", "global"),
        ("ds-types", "Type System", "global"),
        ("ds-partition", "Partition Spec", "data"),
        ("ds-lineage", "Lineage Spec", "data"),
    ]
    return {
        code: DataStandard(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            domain=domain,
        )
        for code, name, domain in items
    }


def _seed_data_domains(tenant_id: str) -> dict[str, DataDomain]:
    items: list[tuple[str, str, str]] = [
        ("dd-user", "User", ""),
        ("dd-order", "Order", ""),
        ("dd-finance", "Finance", ""),
        ("dd-product", "Product", ""),
        ("dd-supply", "Supply", ""),
        ("dd-ops", "Ops", ""),
        ("dd-ai", "AI", ""),
        ("dd-global", "Global", ""),
    ]
    return {
        code: DataDomain(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
        )
        for code, name, _parent in items
    }


def _seed_deployments(tenant_id: str) -> dict[str, Deployment]:
    items: list[tuple[str, str, str]] = [
        ("dep-kb-prod", "kb", "kb"),
        ("dep-rag-prod", "rag", "rag"),
        ("dep-arch-prod", "arch", "arch"),
        ("dep-dw-prod", "dw", "dw"),
    ]
    return {
        code: Deployment(
            id=code,
            tenant_id=tenant_id,
            name=f"{app_code} prod",
            code=code,
            application_id=f"app-{app_code}",
            environment="production",
        )
        for code, app_code, _ in items
    }


def _seed_infrastructures(tenant_id: str) -> dict[str, Infrastructure]:
    items: list[tuple[str, str, str]] = [
        ("infra-k8s-prod", "Kubernetes Prod", "k8s"),
        ("infra-k8s-staging", "Kubernetes Staging", "k8s"),
        ("infra-pg-primary", "PostgreSQL Primary", "rds"),
        ("infra-redis", "Redis Cluster", "redis"),
        ("infra-minio", "MinIO", "minio"),
    ]
    return {
        code: Infrastructure(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            kind=kind,
        )
        for code, name, kind in items
    }


def _seed_principle_categories(tenant_id: str) -> dict[str, GovernancePrincipleCategory]:
    items: list[tuple[str, str, int]] = [
        ("gpc-data", "Data", 10),
        ("gpc-app", "Application", 20),
        ("gpc-sec", "Security", 30),
        ("gpc-ops", "Operations", 40),
    ]
    return {
        code: GovernancePrincipleCategory(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            sort_order=sort,
        )
        for code, name, sort in items
    }


def _seed_principles(tenant_id: str) -> dict[str, GovernancePrinciple]:
    items: list[tuple[str, str, str]] = [
        ("gp-naming", "Naming Convention", "gpc-data"),
        ("gp-lineage", "Lineage Mandatory", "gpc-data"),
        ("gp-tenant-isolation", "Tenant Isolation", "gpc-sec"),
        ("gp-least-privilege", "Least Privilege", "gpc-sec"),
        ("gp-idempotent", "Idempotent APIs", "gpc-app"),
        ("gp-observability", "Observability First", "gpc-ops"),
    ]
    return {
        code: GovernancePrinciple(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            category_id=cat,
        )
        for code, name, cat in items
    }


def _seed_review_templates(tenant_id: str) -> dict[str, ReviewTemplate]:
    items: list[tuple[str, str, str, tuple[str, ...]]] = [
        ("rt-launch", "Launch Checklist", "launch", ("命名规范", "依赖检查", "SLO 配置")),
        ("rt-data", "Data Checklist", "data", ("字段命名", "分区规范", "血缘接入")),
        ("rt-security", "Security Checklist", "security", ("鉴权检查", "PII 脱敏", "审计日志")),
    ]
    return {
        code: ReviewTemplate(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            category=category,
            checklist=checklist,
        )
        for code, name, category, checklist in items
    }


def _seed_review_tickets(tenant_id: str) -> dict[str, ReviewTicket]:
    items: list[tuple[str, str, str, str]] = [
        ("rv-1", "kb launch review", "kb", "rt-launch"),
        ("rv-2", "rag data review", "rag", "rt-data"),
        ("rv-3", "iam security review", "iam", "rt-security"),
    ]
    return {
        tid: ReviewTicket(
            id=tid,
            tenant_id=tenant_id,
            title=title,
            application_id=f"app-{app_code}",
            template_id=tpl,
        )
        for tid, title, app_code, tpl in items
    }


def _seed_tech_debts(tenant_id: str) -> dict[str, TechDebt]:
    items: list[tuple[str, str, str, str]] = [
        ("td-1", "Replace legacy JWT verifier", "iam", "high"),
        ("td-2", "Migrate kb index to milvus 2.5", "kb", "medium"),
        ("td-3", "Flowable BPMN upgrade", "wfe", "low"),
    ]
    return {
        tid: TechDebt(
            id=tid,
            tenant_id=tenant_id,
            title=title,
            application_id=f"app-{app_code}",
            severity=sev,
        )
        for tid, title, app_code, sev in items
    }


def _seed_ontology_rules(tenant_id: str) -> dict[str, OntologyMappingRule]:
    items: list[tuple[str, str, str, str]] = [
        ("omr-user-concept", "User", "user", "person"),
        ("omr-order-concept", "Order", "order", "transaction"),
        ("omr-product-concept", "Product", "product", "catalog_item"),
    ]
    return {
        code: OntologyMappingRule(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            source_concept=src,
            target_concept=tgt,
        )
        for code, name, src, tgt in items
    }


def _seed_ontology_changes(tenant_id: str) -> dict[str, OntologyMappingChange]:
    items: list[tuple[str, str, str]] = [
        ("omc-1", "omr-user-concept", "created"),
        ("omc-2", "omr-order-concept", "updated"),
    ]
    return {
        cid: OntologyMappingChange(
            id=cid,
            tenant_id=tenant_id,
            rule_id=rid,
            change_type=ctype,
        )
        for cid, rid, ctype in items
    }


def _seed_orgs(tenant_id: str) -> dict[str, Org]:
    items: list[tuple[str, str, str, int]] = [
        ("org-root", "Engineering", "", 1),
        ("org-data", "Data Team", "org-root", 2),
        ("org-platform", "Platform Team", "org-root", 2),
        ("org-knowledge", "Knowledge Team", "org-root", 2),
        ("org-sec", "Security Team", "org-root", 2),
    ]
    return {
        code: Org(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            parent_id=parent,
            level=level,
        )
        for code, name, parent, level in items
    }


def _seed_roles(tenant_id: str) -> dict[str, Role]:
    items: list[tuple[str, str, str]] = [
        ("role-admin", "Platform Admin", "org-platform"),
        ("role-viewer", "Platform Viewer", "org-platform"),
        ("role-data-eng", "Data Engineer", "org-data"),
        ("role-data-steward", "Data Steward", "org-data"),
        ("role-kb-editor", "KB Editor", "org-knowledge"),
    ]
    return {
        code: Role(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            org_id=org,
        )
        for code, name, org in items
    }


def _seed_tech_stacks(tenant_id: str) -> dict[str, TechStack]:
    items: list[tuple[str, str, str]] = [
        ("ts-backend", "Backend", "python"),
        ("ts-frontend", "Frontend", "typescript"),
        ("ts-data", "Data", "python"),
        ("ts-infra", "Infrastructure", "terraform"),
    ]
    return {
        code: TechStack(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            category=category,
        )
        for code, name, category in items
    }


def _seed_technology_components(tenant_id: str) -> dict[str, TechnologyComponent]:
    items: list[tuple[str, str, str, str]] = [
        ("tc-fastapi", "FastAPI", "backend", "open-source"),
        ("tc-react", "React", "frontend", "open-source"),
        ("tc-postgres", "PostgreSQL", "data", "open-source"),
        ("tc-milvus", "Milvus", "data", "open-source"),
        ("tc-redis", "Redis", "data", "open-source"),
        ("tc-kafka", "Kafka", "data", "open-source"),
        ("tc-minio", "MinIO", "data", "open-source"),
        ("tc-keycloak", "Keycloak", "security", "open-source"),
        ("tc-flowable", "Flowable", "platform", "open-source"),
        ("tc-opentelemetry", "OpenTelemetry", "observability", "open-source"),
    ]
    return {
        code: TechnologyComponent(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            category=category,
            vendor=vendor,
        )
        for code, name, category, vendor in items
    }


def _seed_technology_radar(tenant_id: str) -> dict[str, TechnologyRadarEntry]:
    items: list[tuple[str, str, str, str]] = [
        ("tr-fastapi", "FastAPI", "platforms", "adopt"),
        ("tr-milvus", "Milvus", "platforms", "adopt"),
        ("tr-react", "React", "platforms", "adopt"),
        ("tr-langchain", "LangChain", "platforms", "trial"),
        ("tr-langgraph", "LangGraph", "platforms", "trial"),
        ("tr-mcp", "MCP", "techniques", "assess"),
        ("tr-uv", "uv", "tools", "adopt"),
        ("tr-temporal", "Temporal", "platforms", "assess"),
        ("tr-paimon", "Apache Paimon", "platforms", "trial"),
        ("tr-iceberg", "Apache Iceberg", "platforms", "assess"),
    ]
    return {
        code: TechnologyRadarEntry(
            id=code,
            tenant_id=tenant_id,
            name=name,
            code=code,
            quadrant=quad,
            ring=ring,
        )
        for code, name, quad, ring in items
    }


def _seed_technology_stacks(tenant_id: str) -> dict[str, TechnologyStack]:
    items: list[tuple[str, str, tuple[str, ...]]] = [
        ("tst-kb", "kb", ("tc-fastapi", "tc-postgres", "tc-milvus", "tc-redis")),
        ("tst-rag", "rag", ("tc-fastapi", "tc-milvus", "tc-redis", "tc-kafka")),
        ("tst-dw", "dw", ("tc-fastapi", "tc-postgres", "tc-kafka", "tc-minio")),
    ]
    return {
        tid: TechnologyStack(
            id=tid,
            tenant_id=tenant_id,
            name=f"{app_code} stack",
            code=tid,
            application_id=f"app-{app_code}",
            component_ids=components,
        )
        for tid, app_code, components in items
    }


def _seed_value_streams(tenant_id: str) -> dict[str, ValueStream]:
    items: list[tuple[str, tuple[str, ...]]] = [
        ("vs-data-product", ("Ingest", "Process", "Serve", "Consume")),
        ("vs-ai-app", ("Prompt", "Retrieve", "Generate", "Evaluate")),
        ("vs-release", ("Code", "Review", "Deploy", "Observe")),
    ]
    return {
        code: ValueStream(
            id=code,
            tenant_id=tenant_id,
            name=code.replace("-", " ").title(),
            code=code,
            stages=stages,
        )
        for code, stages in items
    }


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_STORES: dict[str, dict[str, Any]] = {}


def _ensure_tenant(tenant_id: str) -> dict[str, Any]:
    if not tenant_id:
        return {}
    if tenant_id not in _STORES:
        _STORES[tenant_id] = {
            "applications": _seed_applications(tenant_id),
            "business_processes": _seed_business_processes(tenant_id),
            "capabilities": _seed_capabilities(tenant_id),
            "data_assets": _seed_data_assets(tenant_id),
            "data_entities": _seed_data_entities(tenant_id),
            "data_flows": _seed_data_flows(tenant_id),
            "data_standards": _seed_data_standards(tenant_id),
            "data_domains": _seed_data_domains(tenant_id),
            "deployments": _seed_deployments(tenant_id),
            "infrastructures": _seed_infrastructures(tenant_id),
            "principle_categories": _seed_principle_categories(tenant_id),
            "principles": _seed_principles(tenant_id),
            "review_templates": _seed_review_templates(tenant_id),
            "review_tickets": _seed_review_tickets(tenant_id),
            "tech_debts": _seed_tech_debts(tenant_id),
            "ontology_rules": _seed_ontology_rules(tenant_id),
            "ontology_changes": _seed_ontology_changes(tenant_id),
            "orgs": _seed_orgs(tenant_id),
            "roles": _seed_roles(tenant_id),
            "tech_stacks": _seed_tech_stacks(tenant_id),
            "technology_components": _seed_technology_components(tenant_id),
            "technology_radar": _seed_technology_radar(tenant_id),
            "technology_stacks": _seed_technology_stacks(tenant_id),
            "value_streams": _seed_value_streams(tenant_id),
        }
    return _STORES[tenant_id]


def _list(tenant_id: str, key: str) -> list[Any]:
    store = _ensure_tenant(tenant_id)
    return sorted(store.get(key, {}).values(), key=lambda x: getattr(x, "code", x.id))


# ---------------------------------------------------------------------------
# Public list functions (27 endpoints)
# ---------------------------------------------------------------------------
def list_applications(tenant_id: str) -> list[Application]:
    return _list(tenant_id, "applications")


def list_business_processes(tenant_id: str) -> list[BusinessProcess]:
    return _list(tenant_id, "business_processes")


def list_capability_tree(tenant_id: str) -> list[dict[str, Any]]:
    """Return capabilities as a nested tree structure."""
    caps = _list(tenant_id, "capabilities")
    nodes = {c.code: {"id": c.id, "code": c.code, "name": c.name,
                      "level": c.level, "children": []} for c in caps}
    roots = []
    for c in caps:
        node = nodes[c.code]
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots


def list_capability_mappings(tenant_id: str) -> list[dict[str, Any]]:
    """Map capabilities to applications via business processes."""
    bps = _list(tenant_id, "business_processes")
    return [
        {
            "capability_code": "cap-platform",
            "application_code": bp.application_id.replace("app-", ""),
            "business_process_code": bp.code,
        }
        for bp in bps
    ]


def list_data_assets(tenant_id: str) -> list[DataAsset]:
    return _list(tenant_id, "data_assets")


def list_data_entities(tenant_id: str) -> list[DataEntity]:
    return _list(tenant_id, "data_entities")


def list_data_flows(tenant_id: str) -> list[DataFlow]:
    return _list(tenant_id, "data_flows")


def list_data_standards(tenant_id: str) -> list[DataStandard]:
    return _list(tenant_id, "data_standards")


def list_data_domains(tenant_id: str) -> list[DataDomain]:
    return _list(tenant_id, "data_domains")


def list_deployments(tenant_id: str) -> list[Deployment]:
    return _list(tenant_id, "deployments")


def list_infrastructures(tenant_id: str) -> list[Infrastructure]:
    return _list(tenant_id, "infrastructures")


def list_governance_principle_categories(tenant_id: str) -> list[GovernancePrincipleCategory]:
    return _list(tenant_id, "principle_categories")


def list_governance_principles(tenant_id: str) -> list[GovernancePrinciple]:
    return _list(tenant_id, "principles")


def list_review_templates(tenant_id: str) -> list[ReviewTemplate]:
    return _list(tenant_id, "review_templates")


def list_review_tickets(tenant_id: str) -> list[ReviewTicket]:
    return _list(tenant_id, "review_tickets")


def list_tech_debts(tenant_id: str) -> list[TechDebt]:
    return _list(tenant_id, "tech_debts")


def list_ontology_mapping_rules(tenant_id: str) -> list[OntologyMappingRule]:
    return _list(tenant_id, "ontology_rules")


def list_ontology_mapping_changes(tenant_id: str) -> list[OntologyMappingChange]:
    return _list(tenant_id, "ontology_changes")


def list_org_tree(tenant_id: str) -> list[dict[str, Any]]:
    """Return orgs as a nested tree structure."""
    orgs = _list(tenant_id, "orgs")
    nodes = {o.code: {"id": o.id, "code": o.code, "name": o.name,
                      "level": o.level, "children": []} for o in orgs}
    roots = []
    for o in orgs:
        node = nodes[o.code]
        if o.parent_id and o.parent_id in nodes:
            nodes[o.parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots


def list_org_roles(tenant_id: str) -> list[Role]:
    return _list(tenant_id, "roles")


def list_capabilities(tenant_id: str) -> list[Capability]:
    """Flat capability list (counterpart to list_capability_tree)."""
    return _list(tenant_id, "capabilities")


def list_orgs(tenant_id: str) -> list[Org]:
    """Flat org list (counterpart to list_org_tree)."""
    return _list(tenant_id, "orgs")


def list_roles(tenant_id: str) -> list[Role]:
    """Flat role list (semantic alias of list_org_roles for /roles)."""
    return _list(tenant_id, "roles")


def list_tech_stacks(tenant_id: str) -> list[TechStack]:
    return _list(tenant_id, "tech_stacks")


def list_technology_components(tenant_id: str) -> list[TechnologyComponent]:
    return _list(tenant_id, "technology_components")


def list_technology_radar(tenant_id: str) -> list[TechnologyRadarEntry]:
    return _list(tenant_id, "technology_radar")


def list_technology_stacks(tenant_id: str) -> list[TechnologyStack]:
    return _list(tenant_id, "technology_stacks")


def list_value_streams(tenant_id: str) -> list[ValueStream]:
    return _list(tenant_id, "value_streams")


def list_impact_analysis(
    tenant_id: str,
    node_id: str,
) -> list[ImpactAnalysisResult]:
    """BFS from `node_id` over the capability tree.

    Returns the node plus all descendants (transitive closure).
    """
    caps = _ensure_tenant(tenant_id).get("capabilities", {})
    if node_id not in caps:
        return []
    children_map: dict[str, list[str]] = {}
    for c in caps.values():
        children_map.setdefault(c.parent_id, []).append(c.code)

    visited: list[str] = []
    queue = deque([node_id])
    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.append(current)
        for child in children_map.get(current, []):
            if child not in visited:
                queue.append(child)

    return [
        ImpactAnalysisResult(
            node_id=node_id,
            node_type="capability",
            impacted_ids=tuple(visited),
        )
    ]


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data."""
    _STORES.clear()
