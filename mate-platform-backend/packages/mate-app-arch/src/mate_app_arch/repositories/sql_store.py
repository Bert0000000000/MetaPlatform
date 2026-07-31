"""SQL-backed repository for the architecture center — SQLAlchemy 2.0.

Provides read + write for the most important entity types
(Application, Capability, DataEntity, DataFlow, DataAsset). Other
entities fall through to in_memory.

Tuple fields (e.g. ``DataEntity.fields``) are serialised as
newline-separated TEXT on write and re-hydrated to tuples on read.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from mate_tech_db.base import get_session

from . import sql_models as models
from .in_memory import (
    Application,
    BusinessProcess,
    Capability,
    DataAsset,
    DataDomain,
    DataEntity,
    DataFlow,
    DataStandard,
    Deployment,
    GovernancePrinciple,
    GovernancePrincipleCategory,
    ImpactAnalysisResult,
    Infrastructure,
    OntologyMappingChange,
    OntologyMappingRule,
    Org,
    ReviewTemplate,
    ReviewTicket,
    Role,
    TechDebt,
    TechnologyComponent,
    TechnologyRadarEntry,
    TechnologyStack,
    TechStack,
    ValueStream,
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


def _orm_to_application(row: models.ApplicationORM) -> Application:
    return Application(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        category=row.category or "",
        owner=row.owner or "",
        status=row.status or "active",
        description=row.description or "",
    )


def _orm_to_capability(row: models.CapabilityORM) -> Capability:
    return Capability(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        parent_id=row.parent_id or "",
        level=row.level,
        description=row.description or "",
    )


def _orm_to_data_asset(row: models.DataAssetORM) -> DataAsset:
    return DataAsset(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        layer=row.layer or "",
        domain=row.domain or "",
        owner=row.owner or "",
        status=row.status or "accepted",
    )


def _orm_to_data_entity(row: models.DataEntityORM) -> DataEntity:
    return DataEntity(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        data_asset_id=row.data_asset_id or "",
        fields=_split_lines(row.fields or ""),
    )


def _orm_to_data_flow(row: models.DataFlowORM) -> DataFlow:
    return DataFlow(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        source_entity_id=row.source_entity_id or "",
        target_entity_id=row.target_entity_id or "",
        pipeline_spec=row.pipeline_spec or "",
    )


# ---------------------------------------------------------------------------
# Read API — mirrors in_memory function names
# ---------------------------------------------------------------------------
def list_applications(tenant_id: str) -> list[Application]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ApplicationORM)
        .where(models.ApplicationORM.tenant_id == tenant_id)
        .order_by(models.ApplicationORM.code)
    ).scalars().all()
    return [_orm_to_application(r) for r in rows]


def list_capabilities(tenant_id: str) -> list[Capability]:
    """Return flat list of capabilities (sorted by code)."""
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.CapabilityORM)
        .where(models.CapabilityORM.tenant_id == tenant_id)
        .order_by(models.CapabilityORM.code)
    ).scalars().all()
    return [_orm_to_capability(r) for r in rows]


def list_capability_tree(tenant_id: str) -> list[dict[str, Any]]:
    """Return capabilities as a nested tree structure."""
    caps = list_capabilities(tenant_id)
    nodes: dict[str, dict[str, Any]] = {
        c.code: {
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "level": c.level,
            "children": [],
        }
        for c in caps
    }
    roots: list[dict[str, Any]] = []
    for c in caps:
        node = nodes[c.code]
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots


def list_data_assets(tenant_id: str) -> list[DataAsset]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataAssetORM)
        .where(models.DataAssetORM.tenant_id == tenant_id)
        .order_by(models.DataAssetORM.code)
    ).scalars().all()
    return [_orm_to_data_asset(r) for r in rows]


def list_data_entities(tenant_id: str) -> list[DataEntity]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataEntityORM)
        .where(models.DataEntityORM.tenant_id == tenant_id)
        .order_by(models.DataEntityORM.code)
    ).scalars().all()
    return [_orm_to_data_entity(r) for r in rows]


def list_data_flows(tenant_id: str) -> list[DataFlow]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataFlowORM)
        .where(models.DataFlowORM.tenant_id == tenant_id)
        .order_by(models.DataFlowORM.code)
    ).scalars().all()
    return [_orm_to_data_flow(r) for r in rows]


# ---------------------------------------------------------------------------
# Write API
# ---------------------------------------------------------------------------
def put_application(tenant_id: str, app: Application) -> Application:
    if not tenant_id:
        return app
    s = _session()
    existing = s.get(models.ApplicationORM, app.id)
    if existing:
        existing.name = app.name
        existing.category = app.category
        existing.owner = app.owner
        existing.status = app.status
        existing.description = app.description
    else:
        s.add(models.ApplicationORM(
            id=app.id, tenant_id=tenant_id, name=app.name, code=app.code,
            category=app.category, owner=app.owner, status=app.status,
            description=app.description,
        ))
    s.commit()
    return app


def put_capability(tenant_id: str, cap: Capability) -> Capability:
    if not tenant_id:
        return cap
    s = _session()
    existing = s.get(models.CapabilityORM, cap.id)
    if existing:
        existing.name = cap.name
        existing.parent_id = cap.parent_id
        existing.level = cap.level
        existing.description = cap.description
    else:
        s.add(models.CapabilityORM(
            id=cap.id, tenant_id=tenant_id, name=cap.name, code=cap.code,
            parent_id=cap.parent_id, level=cap.level, description=cap.description,
        ))
    s.commit()
    return cap


def put_data_asset(tenant_id: str, asset: DataAsset) -> DataAsset:
    if not tenant_id:
        return asset
    s = _session()
    existing = s.get(models.DataAssetORM, asset.id)
    if existing:
        existing.name = asset.name
        existing.layer = asset.layer
        existing.domain = asset.domain
        existing.owner = asset.owner
        existing.status = asset.status
    else:
        s.add(models.DataAssetORM(
            id=asset.id, tenant_id=tenant_id, name=asset.name, code=asset.code,
            layer=asset.layer, domain=asset.domain, owner=asset.owner,
            status=asset.status,
        ))
    s.commit()
    return asset


def put_data_entity(tenant_id: str, entity: DataEntity) -> DataEntity:
    if not tenant_id:
        return entity
    s = _session()
    fields_str = _join_lines(entity.fields)
    existing = s.get(models.DataEntityORM, entity.id)
    if existing:
        existing.name = entity.name
        existing.data_asset_id = entity.data_asset_id
        existing.fields = fields_str
    else:
        s.add(models.DataEntityORM(
            id=entity.id, tenant_id=tenant_id, name=entity.name, code=entity.code,
            data_asset_id=entity.data_asset_id, fields=fields_str,
        ))
    s.commit()
    return entity


def put_data_flow(tenant_id: str, flow: DataFlow) -> DataFlow:
    if not tenant_id:
        return flow
    s = _session()
    existing = s.get(models.DataFlowORM, flow.id)
    if existing:
        existing.name = flow.name
        existing.source_entity_id = flow.source_entity_id
        existing.target_entity_id = flow.target_entity_id
        existing.pipeline_spec = flow.pipeline_spec
    else:
        s.add(models.DataFlowORM(
            id=flow.id, tenant_id=tenant_id, name=flow.name, code=flow.code,
            source_entity_id=flow.source_entity_id,
            target_entity_id=flow.target_entity_id,
            pipeline_spec=flow.pipeline_spec,
        ))
    s.commit()
    return flow


# ---------------------------------------------------------------------------
# ORM → dataclass helpers (remaining 20 entities)
# ---------------------------------------------------------------------------
def _orm_to_business_process(row: models.BusinessProcessORM) -> BusinessProcess:
    return BusinessProcess(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        application_id=row.application_id or "",
        description=row.description or "",
    )


def _orm_to_data_domain(row: models.DataDomainORM) -> DataDomain:
    return DataDomain(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        parent_id=row.parent_id or "",
    )


def _orm_to_data_standard(row: models.DataStandardORM) -> DataStandard:
    return DataStandard(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        domain=row.domain or "",
        description=row.description or "",
    )


def _orm_to_deployment(row: models.DeploymentORM) -> Deployment:
    return Deployment(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        application_id=row.application_id or "",
        environment=row.environment or "staging",
        cluster=row.cluster or "default",
    )


def _orm_to_infrastructure(row: models.InfrastructureORM) -> Infrastructure:
    return Infrastructure(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        kind=row.kind or "",
        region=row.region or "cn-beijing",
    )


def _orm_to_governance_principle(row: models.GovernancePrincipleORM) -> GovernancePrinciple:
    return GovernancePrinciple(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        category_id=row.category_id or "",
        description=row.description or "",
    )


def _orm_to_governance_principle_category(
    row: models.GovernancePrincipleCategoryORM,
) -> GovernancePrincipleCategory:
    return GovernancePrincipleCategory(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        sort_order=row.sort_order,
    )


def _orm_to_review_template(row: models.ReviewTemplateORM) -> ReviewTemplate:
    return ReviewTemplate(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        category=row.category or "",
        checklist=_split_lines(row.checklist or ""),
    )


def _orm_to_review_ticket(row: models.ReviewTicketORM) -> ReviewTicket:
    return ReviewTicket(
        id=row.id,
        tenant_id=row.tenant_id,
        title=row.title,
        application_id=row.application_id or "",
        template_id=row.template_id or "",
        status=row.status or "open",
    )


def _orm_to_tech_debt(row: models.TechDebtORM) -> TechDebt:
    return TechDebt(
        id=row.id,
        tenant_id=row.tenant_id,
        title=row.title,
        application_id=row.application_id or "",
        severity=row.severity or "medium",
        status=row.status or "open",
    )


def _orm_to_impact_analysis(row: models.ImpactAnalysisResultORM) -> ImpactAnalysisResult:
    return ImpactAnalysisResult(
        node_id=row.node_id,
        node_type=row.node_type or "",
        impacted_ids=_split_lines(row.impacted_ids or ""),
    )


def _orm_to_ontology_mapping_rule(row: models.OntologyMappingRuleORM) -> OntologyMappingRule:
    return OntologyMappingRule(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        source_concept=row.source_concept or "",
        target_concept=row.target_concept or "",
    )


def _orm_to_ontology_mapping_change(
    row: models.OntologyMappingChangeORM,
) -> OntologyMappingChange:
    return OntologyMappingChange(
        id=row.id,
        tenant_id=row.tenant_id,
        rule_id=row.rule_id or "",
        change_type=row.change_type or "",
        description=row.description or "",
    )


def _orm_to_org(row: models.OrgORM) -> Org:
    return Org(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        parent_id=row.parent_id or "",
        level=row.level,
    )


def _orm_to_role(row: models.RoleORM) -> Role:
    return Role(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        org_id=row.org_id or "",
    )


def _orm_to_tech_stack(row: models.TechStackORM) -> TechStack:
    return TechStack(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        category=row.category or "",
    )


def _orm_to_technology_component(row: models.TechnologyComponentORM) -> TechnologyComponent:
    return TechnologyComponent(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        category=row.category or "",
        vendor=row.vendor or "open-source",
    )


def _orm_to_technology_radar_entry(
    row: models.TechnologyRadarEntryORM,
) -> TechnologyRadarEntry:
    return TechnologyRadarEntry(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        quadrant=row.quadrant or "",
        ring=row.ring or "",
    )


def _orm_to_technology_stack(row: models.TechnologyStackORM) -> TechnologyStack:
    return TechnologyStack(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        application_id=row.application_id or "",
        component_ids=_split_lines(row.component_ids or ""),
    )


def _orm_to_value_stream(row: models.ValueStreamORM) -> ValueStream:
    return ValueStream(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        code=row.code,
        stages=_split_lines(row.stages or ""),
        description=row.description or "",
    )


# ---------------------------------------------------------------------------
# Read API — remaining 20 entities
# ---------------------------------------------------------------------------
def list_business_processes(tenant_id: str) -> list[BusinessProcess]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.BusinessProcessORM)
        .where(models.BusinessProcessORM.tenant_id == tenant_id)
        .order_by(models.BusinessProcessORM.code)
    ).scalars().all()
    return [_orm_to_business_process(r) for r in rows]


def list_data_domains(tenant_id: str) -> list[DataDomain]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataDomainORM)
        .where(models.DataDomainORM.tenant_id == tenant_id)
        .order_by(models.DataDomainORM.code)
    ).scalars().all()
    return [_orm_to_data_domain(r) for r in rows]


def list_data_standards(tenant_id: str) -> list[DataStandard]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DataStandardORM)
        .where(models.DataStandardORM.tenant_id == tenant_id)
        .order_by(models.DataStandardORM.code)
    ).scalars().all()
    return [_orm_to_data_standard(r) for r in rows]


def list_deployments(tenant_id: str) -> list[Deployment]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.DeploymentORM)
        .where(models.DeploymentORM.tenant_id == tenant_id)
        .order_by(models.DeploymentORM.code)
    ).scalars().all()
    return [_orm_to_deployment(r) for r in rows]


def list_infrastructures(tenant_id: str) -> list[Infrastructure]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.InfrastructureORM)
        .where(models.InfrastructureORM.tenant_id == tenant_id)
        .order_by(models.InfrastructureORM.code)
    ).scalars().all()
    return [_orm_to_infrastructure(r) for r in rows]


def list_governance_principles(tenant_id: str) -> list[GovernancePrinciple]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.GovernancePrincipleORM)
        .where(models.GovernancePrincipleORM.tenant_id == tenant_id)
        .order_by(models.GovernancePrincipleORM.code)
    ).scalars().all()
    return [_orm_to_governance_principle(r) for r in rows]


def list_governance_principle_categories(
    tenant_id: str,
) -> list[GovernancePrincipleCategory]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.GovernancePrincipleCategoryORM)
        .where(models.GovernancePrincipleCategoryORM.tenant_id == tenant_id)
        .order_by(models.GovernancePrincipleCategoryORM.code)
    ).scalars().all()
    return [_orm_to_governance_principle_category(r) for r in rows]


def list_review_templates(tenant_id: str) -> list[ReviewTemplate]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ReviewTemplateORM)
        .where(models.ReviewTemplateORM.tenant_id == tenant_id)
        .order_by(models.ReviewTemplateORM.code)
    ).scalars().all()
    return [_orm_to_review_template(r) for r in rows]


def list_review_tickets(tenant_id: str) -> list[ReviewTicket]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ReviewTicketORM)
        .where(models.ReviewTicketORM.tenant_id == tenant_id)
        .order_by(models.ReviewTicketORM.id)
    ).scalars().all()
    return [_orm_to_review_ticket(r) for r in rows]


def list_tech_debts(tenant_id: str) -> list[TechDebt]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.TechDebtORM)
        .where(models.TechDebtORM.tenant_id == tenant_id)
        .order_by(models.TechDebtORM.id)
    ).scalars().all()
    return [_orm_to_tech_debt(r) for r in rows]


def list_impact_analysis(tenant_id: str, node_id: str) -> list[ImpactAnalysisResult]:
    if not node_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ImpactAnalysisResultORM)
        .where(models.ImpactAnalysisResultORM.node_id == node_id)
    ).scalars().all()
    return [_orm_to_impact_analysis(r) for r in rows]


def list_ontology_mapping_rules(tenant_id: str) -> list[OntologyMappingRule]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OntologyMappingRuleORM)
        .where(models.OntologyMappingRuleORM.tenant_id == tenant_id)
        .order_by(models.OntologyMappingRuleORM.code)
    ).scalars().all()
    return [_orm_to_ontology_mapping_rule(r) for r in rows]


def list_ontology_mapping_changes(tenant_id: str) -> list[OntologyMappingChange]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OntologyMappingChangeORM)
        .where(models.OntologyMappingChangeORM.tenant_id == tenant_id)
        .order_by(models.OntologyMappingChangeORM.id)
    ).scalars().all()
    return [_orm_to_ontology_mapping_change(r) for r in rows]


def list_orgs(tenant_id: str) -> list[Org]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.OrgORM)
        .where(models.OrgORM.tenant_id == tenant_id)
        .order_by(models.OrgORM.code)
    ).scalars().all()
    return [_orm_to_org(r) for r in rows]


def list_org_roles(tenant_id: str) -> list[Role]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.RoleORM)
        .where(models.RoleORM.tenant_id == tenant_id)
        .order_by(models.RoleORM.code)
    ).scalars().all()
    return [_orm_to_role(r) for r in rows]


def list_tech_stacks(tenant_id: str) -> list[TechStack]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.TechStackORM)
        .where(models.TechStackORM.tenant_id == tenant_id)
        .order_by(models.TechStackORM.code)
    ).scalars().all()
    return [_orm_to_tech_stack(r) for r in rows]


def list_technology_components(tenant_id: str) -> list[TechnologyComponent]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.TechnologyComponentORM)
        .where(models.TechnologyComponentORM.tenant_id == tenant_id)
        .order_by(models.TechnologyComponentORM.code)
    ).scalars().all()
    return [_orm_to_technology_component(r) for r in rows]


def list_technology_radar(tenant_id: str) -> list[TechnologyRadarEntry]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.TechnologyRadarEntryORM)
        .where(models.TechnologyRadarEntryORM.tenant_id == tenant_id)
        .order_by(models.TechnologyRadarEntryORM.code)
    ).scalars().all()
    return [_orm_to_technology_radar_entry(r) for r in rows]


def list_technology_stacks(tenant_id: str) -> list[TechnologyStack]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.TechnologyStackORM)
        .where(models.TechnologyStackORM.tenant_id == tenant_id)
        .order_by(models.TechnologyStackORM.code)
    ).scalars().all()
    return [_orm_to_technology_stack(r) for r in rows]


def list_value_streams(tenant_id: str) -> list[ValueStream]:
    if not tenant_id:
        return []
    s = _session()
    rows = s.execute(
        select(models.ValueStreamORM)
        .where(models.ValueStreamORM.tenant_id == tenant_id)
        .order_by(models.ValueStreamORM.code)
    ).scalars().all()
    return [_orm_to_value_stream(r) for r in rows]


# ---------------------------------------------------------------------------
# Write API — remaining 20 entities
# ---------------------------------------------------------------------------
def put_business_process(tenant_id: str, bp: BusinessProcess) -> BusinessProcess:
    if not tenant_id:
        return bp
    s = _session()
    existing = s.get(models.BusinessProcessORM, bp.id)
    if existing:
        existing.name = bp.name
        existing.application_id = bp.application_id
        existing.description = bp.description
    else:
        s.add(models.BusinessProcessORM(
            id=bp.id, tenant_id=tenant_id, name=bp.name, code=bp.code,
            application_id=bp.application_id, description=bp.description,
        ))
    s.commit()
    return bp


def put_data_domain(tenant_id: str, domain: DataDomain) -> DataDomain:
    if not tenant_id:
        return domain
    s = _session()
    existing = s.get(models.DataDomainORM, domain.id)
    if existing:
        existing.name = domain.name
        existing.parent_id = domain.parent_id
    else:
        s.add(models.DataDomainORM(
            id=domain.id, tenant_id=tenant_id, name=domain.name, code=domain.code,
            parent_id=domain.parent_id,
        ))
    s.commit()
    return domain


def put_data_standard(tenant_id: str, std: DataStandard) -> DataStandard:
    if not tenant_id:
        return std
    s = _session()
    existing = s.get(models.DataStandardORM, std.id)
    if existing:
        existing.name = std.name
        existing.domain = std.domain
        existing.description = std.description
    else:
        s.add(models.DataStandardORM(
            id=std.id, tenant_id=tenant_id, name=std.name, code=std.code,
            domain=std.domain, description=std.description,
        ))
    s.commit()
    return std


def put_deployment(tenant_id: str, dep: Deployment) -> Deployment:
    if not tenant_id:
        return dep
    s = _session()
    existing = s.get(models.DeploymentORM, dep.id)
    if existing:
        existing.name = dep.name
        existing.application_id = dep.application_id
        existing.environment = dep.environment
        existing.cluster = dep.cluster
    else:
        s.add(models.DeploymentORM(
            id=dep.id, tenant_id=tenant_id, name=dep.name, code=dep.code,
            application_id=dep.application_id, environment=dep.environment,
            cluster=dep.cluster,
        ))
    s.commit()
    return dep


def put_infrastructure(tenant_id: str, infra: Infrastructure) -> Infrastructure:
    if not tenant_id:
        return infra
    s = _session()
    existing = s.get(models.InfrastructureORM, infra.id)
    if existing:
        existing.name = infra.name
        existing.kind = infra.kind
        existing.region = infra.region
    else:
        s.add(models.InfrastructureORM(
            id=infra.id, tenant_id=tenant_id, name=infra.name, code=infra.code,
            kind=infra.kind, region=infra.region,
        ))
    s.commit()
    return infra


def put_governance_principle(
    tenant_id: str, principle: GovernancePrinciple,
) -> GovernancePrinciple:
    if not tenant_id:
        return principle
    s = _session()
    existing = s.get(models.GovernancePrincipleORM, principle.id)
    if existing:
        existing.name = principle.name
        existing.category_id = principle.category_id
        existing.description = principle.description
    else:
        s.add(models.GovernancePrincipleORM(
            id=principle.id, tenant_id=tenant_id, name=principle.name,
            code=principle.code, category_id=principle.category_id,
            description=principle.description,
        ))
    s.commit()
    return principle


def put_governance_principle_category(
    tenant_id: str, cat: GovernancePrincipleCategory,
) -> GovernancePrincipleCategory:
    if not tenant_id:
        return cat
    s = _session()
    existing = s.get(models.GovernancePrincipleCategoryORM, cat.id)
    if existing:
        existing.name = cat.name
        existing.sort_order = cat.sort_order
    else:
        s.add(models.GovernancePrincipleCategoryORM(
            id=cat.id, tenant_id=tenant_id, name=cat.name, code=cat.code,
            sort_order=cat.sort_order,
        ))
    s.commit()
    return cat


def put_review_template(tenant_id: str, tpl: ReviewTemplate) -> ReviewTemplate:
    if not tenant_id:
        return tpl
    s = _session()
    checklist_str = _join_lines(tpl.checklist)
    existing = s.get(models.ReviewTemplateORM, tpl.id)
    if existing:
        existing.name = tpl.name
        existing.category = tpl.category
        existing.checklist = checklist_str
    else:
        s.add(models.ReviewTemplateORM(
            id=tpl.id, tenant_id=tenant_id, name=tpl.name, code=tpl.code,
            category=tpl.category, checklist=checklist_str,
        ))
    s.commit()
    return tpl


def put_review_ticket(tenant_id: str, ticket: ReviewTicket) -> ReviewTicket:
    if not tenant_id:
        return ticket
    s = _session()
    existing = s.get(models.ReviewTicketORM, ticket.id)
    if existing:
        existing.title = ticket.title
        existing.application_id = ticket.application_id
        existing.template_id = ticket.template_id
        existing.status = ticket.status
    else:
        s.add(models.ReviewTicketORM(
            id=ticket.id, tenant_id=tenant_id, title=ticket.title,
            application_id=ticket.application_id, template_id=ticket.template_id,
            status=ticket.status,
        ))
    s.commit()
    return ticket


def put_tech_debt(tenant_id: str, debt: TechDebt) -> TechDebt:
    if not tenant_id:
        return debt
    s = _session()
    existing = s.get(models.TechDebtORM, debt.id)
    if existing:
        existing.title = debt.title
        existing.application_id = debt.application_id
        existing.severity = debt.severity
        existing.status = debt.status
    else:
        s.add(models.TechDebtORM(
            id=debt.id, tenant_id=tenant_id, title=debt.title,
            application_id=debt.application_id, severity=debt.severity,
            status=debt.status,
        ))
    s.commit()
    return debt


def put_impact_analysis(result: ImpactAnalysisResult) -> ImpactAnalysisResult:
    s = _session()
    impacted_str = _join_lines(result.impacted_ids)
    existing = s.get(models.ImpactAnalysisResultORM, result.node_id)
    if existing:
        existing.node_type = result.node_type
        existing.impacted_ids = impacted_str
    else:
        s.add(models.ImpactAnalysisResultORM(
            node_id=result.node_id,
            node_type=result.node_type,
            impacted_ids=impacted_str,
        ))
    s.commit()
    return result


def put_ontology_mapping_rule(
    tenant_id: str, rule: OntologyMappingRule,
) -> OntologyMappingRule:
    if not tenant_id:
        return rule
    s = _session()
    existing = s.get(models.OntologyMappingRuleORM, rule.id)
    if existing:
        existing.name = rule.name
        existing.source_concept = rule.source_concept
        existing.target_concept = rule.target_concept
    else:
        s.add(models.OntologyMappingRuleORM(
            id=rule.id, tenant_id=tenant_id, name=rule.name, code=rule.code,
            source_concept=rule.source_concept, target_concept=rule.target_concept,
        ))
    s.commit()
    return rule


def put_ontology_mapping_change(
    tenant_id: str, change: OntologyMappingChange,
) -> OntologyMappingChange:
    if not tenant_id:
        return change
    s = _session()
    existing = s.get(models.OntologyMappingChangeORM, change.id)
    if existing:
        existing.rule_id = change.rule_id
        existing.change_type = change.change_type
        existing.description = change.description
    else:
        s.add(models.OntologyMappingChangeORM(
            id=change.id, tenant_id=tenant_id, rule_id=change.rule_id,
            change_type=change.change_type, description=change.description,
        ))
    s.commit()
    return change


def put_org(tenant_id: str, org: Org) -> Org:
    if not tenant_id:
        return org
    s = _session()
    existing = s.get(models.OrgORM, org.id)
    if existing:
        existing.name = org.name
        existing.parent_id = org.parent_id
        existing.level = org.level
    else:
        s.add(models.OrgORM(
            id=org.id, tenant_id=tenant_id, name=org.name, code=org.code,
            parent_id=org.parent_id, level=org.level,
        ))
    s.commit()
    return org


def put_role(tenant_id: str, role: Role) -> Role:
    if not tenant_id:
        return role
    s = _session()
    existing = s.get(models.RoleORM, role.id)
    if existing:
        existing.name = role.name
        existing.org_id = role.org_id
    else:
        s.add(models.RoleORM(
            id=role.id, tenant_id=tenant_id, name=role.name, code=role.code,
            org_id=role.org_id,
        ))
    s.commit()
    return role


def put_tech_stack(tenant_id: str, stack: TechStack) -> TechStack:
    if not tenant_id:
        return stack
    s = _session()
    existing = s.get(models.TechStackORM, stack.id)
    if existing:
        existing.name = stack.name
        existing.category = stack.category
    else:
        s.add(models.TechStackORM(
            id=stack.id, tenant_id=tenant_id, name=stack.name, code=stack.code,
            category=stack.category,
        ))
    s.commit()
    return stack


def put_technology_component(
    tenant_id: str, comp: TechnologyComponent,
) -> TechnologyComponent:
    if not tenant_id:
        return comp
    s = _session()
    existing = s.get(models.TechnologyComponentORM, comp.id)
    if existing:
        existing.name = comp.name
        existing.category = comp.category
        existing.vendor = comp.vendor
    else:
        s.add(models.TechnologyComponentORM(
            id=comp.id, tenant_id=tenant_id, name=comp.name, code=comp.code,
            category=comp.category, vendor=comp.vendor,
        ))
    s.commit()
    return comp


def put_technology_radar_entry(
    tenant_id: str, entry: TechnologyRadarEntry,
) -> TechnologyRadarEntry:
    if not tenant_id:
        return entry
    s = _session()
    existing = s.get(models.TechnologyRadarEntryORM, entry.id)
    if existing:
        existing.name = entry.name
        existing.quadrant = entry.quadrant
        existing.ring = entry.ring
    else:
        s.add(models.TechnologyRadarEntryORM(
            id=entry.id, tenant_id=tenant_id, name=entry.name, code=entry.code,
            quadrant=entry.quadrant, ring=entry.ring,
        ))
    s.commit()
    return entry


def put_technology_stack(tenant_id: str, stack: TechnologyStack) -> TechnologyStack:
    if not tenant_id:
        return stack
    s = _session()
    comp_str = _join_lines(stack.component_ids)
    existing = s.get(models.TechnologyStackORM, stack.id)
    if existing:
        existing.name = stack.name
        existing.application_id = stack.application_id
        existing.component_ids = comp_str
    else:
        s.add(models.TechnologyStackORM(
            id=stack.id, tenant_id=tenant_id, name=stack.name, code=stack.code,
            application_id=stack.application_id, component_ids=comp_str,
        ))
    s.commit()
    return stack


def put_value_stream(tenant_id: str, vs: ValueStream) -> ValueStream:
    if not tenant_id:
        return vs
    s = _session()
    stages_str = _join_lines(vs.stages)
    existing = s.get(models.ValueStreamORM, vs.id)
    if existing:
        existing.name = vs.name
        existing.stages = stages_str
        existing.description = vs.description
    else:
        s.add(models.ValueStreamORM(
            id=vs.id, tenant_id=tenant_id, name=vs.name, code=vs.code,
            stages=stages_str, description=vs.description,
        ))
    s.commit()
    return vs


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def seed_from_inmemory(tenant_id: str) -> dict[str, int]:
    """Seed the SQL store from in_memory seed data (one-time bootstrap).

    Returns counts of rows inserted per table.
    """
    from . import in_memory as mem  # noqa: PLC0415

    counts: dict[str, int] = {}
    counts["applications"] = len(
        [put_application(tenant_id, a) for a in mem.list_applications(tenant_id)]
    )
    counts["business_processes"] = len(
        [put_business_process(tenant_id, b) for b in mem.list_business_processes(tenant_id)]
    )
    counts["capabilities"] = len(
        [put_capability(tenant_id, c) for c in _mem_capabilities(tenant_id)]
    )
    counts["data_assets"] = len(
        [put_data_asset(tenant_id, a) for a in mem.list_data_assets(tenant_id)]
    )
    counts["data_entities"] = len(
        [put_data_entity(tenant_id, e) for e in mem.list_data_entities(tenant_id)]
    )
    counts["data_flows"] = len(
        [put_data_flow(tenant_id, f) for f in mem.list_data_flows(tenant_id)]
    )
    counts["data_standards"] = len(
        [put_data_standard(tenant_id, d) for d in mem.list_data_standards(tenant_id)]
    )
    counts["data_domains"] = len(
        [put_data_domain(tenant_id, d) for d in mem.list_data_domains(tenant_id)]
    )
    counts["deployments"] = len(
        [put_deployment(tenant_id, d) for d in mem.list_deployments(tenant_id)]
    )
    counts["infrastructures"] = len(
        [put_infrastructure(tenant_id, i) for i in mem.list_infrastructures(tenant_id)]
    )
    counts["governance_principle_categories"] = len(
        [put_governance_principle_category(tenant_id, c)
         for c in mem.list_governance_principle_categories(tenant_id)]
    )
    counts["governance_principles"] = len(
        [put_governance_principle(tenant_id, p)
         for p in mem.list_governance_principles(tenant_id)]
    )
    counts["review_templates"] = len(
        [put_review_template(tenant_id, t) for t in mem.list_review_templates(tenant_id)]
    )
    counts["review_tickets"] = len(
        [put_review_ticket(tenant_id, t) for t in mem.list_review_tickets(tenant_id)]
    )
    counts["tech_debts"] = len(
        [put_tech_debt(tenant_id, d) for d in mem.list_tech_debts(tenant_id)]
    )
    counts["ontology_mapping_rules"] = len(
        [put_ontology_mapping_rule(tenant_id, r)
         for r in mem.list_ontology_mapping_rules(tenant_id)]
    )
    counts["ontology_mapping_changes"] = len(
        [put_ontology_mapping_change(tenant_id, c)
         for c in mem.list_ontology_mapping_changes(tenant_id)]
    )
    counts["orgs"] = len(
        [put_org(tenant_id, o) for o in _mem_orgs(tenant_id)]
    )
    counts["roles"] = len(
        [put_role(tenant_id, r) for r in mem.list_org_roles(tenant_id)]
    )
    counts["tech_stacks"] = len(
        [put_tech_stack(tenant_id, t) for t in mem.list_tech_stacks(tenant_id)]
    )
    counts["technology_components"] = len(
        [put_technology_component(tenant_id, c)
         for c in mem.list_technology_components(tenant_id)]
    )
    counts["technology_radar"] = len(
        [put_technology_radar_entry(tenant_id, r)
         for r in mem.list_technology_radar(tenant_id)]
    )
    counts["technology_stacks"] = len(
        [put_technology_stack(tenant_id, t)
         for t in mem.list_technology_stacks(tenant_id)]
    )
    counts["value_streams"] = len(
        [put_value_stream(tenant_id, v) for v in mem.list_value_streams(tenant_id)]
    )
    counts["impact_analysis"] = len(
        [put_impact_analysis(r) for r in _mem_impact_analysis(tenant_id)]
    )
    return counts


def _mem_capabilities(tenant_id: str) -> list[Capability]:
    """Flatten the capability tree from in_memory into a flat list.

    in_memory exposes list_capability_tree (nested) but not a flat
    list_capabilities, so we walk the tree to collect all nodes and
    reconstruct parent_id from the nesting structure.
    """
    from . import in_memory as mem  # noqa: PLC0415

    result: list[Capability] = []

    def _walk(nodes: list[dict[str, Any]], parent_code: str = "") -> None:
        for node in nodes:
            result.append(Capability(
                id=node["id"],
                tenant_id=tenant_id,
                name=node["name"],
                code=node["code"],
                parent_id=parent_code,
                level=node.get("level", 1),
            ))
            _walk(node.get("children", []), node["code"])

    _walk(mem.list_capability_tree(tenant_id))
    return result


def _mem_orgs(tenant_id: str) -> list[Org]:
    """Flatten the org tree from in_memory into a flat list.

    in_memory exposes list_org_tree (nested) but not a flat
    list_orgs, so we walk the tree to collect all nodes.
    """
    from . import in_memory as mem  # noqa: PLC0415

    result: list[Org] = []

    def _walk(nodes: list[dict[str, Any]], parent_code: str = "") -> None:
        for node in nodes:
            result.append(Org(
                id=node["id"],
                tenant_id=tenant_id,
                name=node["name"],
                code=node["code"],
                parent_id=parent_code,
                level=node.get("level", 1),
            ))
            _walk(node.get("children", []), node["code"])

    _walk(mem.list_org_tree(tenant_id))
    return result


def _mem_impact_analysis(tenant_id: str) -> list[ImpactAnalysisResult]:
    """Compute impact-analysis results for all root capability nodes."""
    from . import in_memory as mem  # noqa: PLC0415

    results: list[ImpactAnalysisResult] = []
    for root in mem.list_capability_tree(tenant_id):
        results.extend(mem.list_impact_analysis(tenant_id, root["code"]))
    return results
