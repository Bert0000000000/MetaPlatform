"""FastAPI router for the architecture center (FR-ARCH-001..027).

27 GET endpoints under `/api/v1/arch/*`. Every handler enforces
ADR-0014 step 2 (`require_tenant(ctx)`) before touching the
repository.
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Query, Request

from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
    list_applications,
    list_business_processes,
    list_capability_mappings,
    list_capability_tree,
    list_data_assets,
    list_data_domains,
    list_data_entities,
    list_data_flows,
    list_data_standards,
    list_deployments,
    list_governance_principle_categories,
    list_governance_principles,
    list_impact_analysis,
    list_infrastructures,
    list_ontology_mapping_changes,
    list_ontology_mapping_rules,
    list_org_roles,
    list_org_tree,
    list_review_templates,
    list_review_tickets,
    list_tech_debts,
    list_tech_stacks,
    list_technology_components,
    list_technology_radar,
    list_technology_stacks,
    list_value_streams,
)

router = APIRouter(prefix="/api/v1/arch", tags=["arch"])


def _tid(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _items(rows) -> list[dict]:
    return [asdict(r) for r in rows]


def _resp(rows) -> dict:
    items = _items(rows)
    return {"items": items, "total": len(items)}


# --- applications / business-processes / capabilities ---
@router.get("/applications")
async def get_applications(
    request: Request,
    category: str | None = Query(default=None),
) -> dict:
    tid = _tid(request)
    items = list_applications(tid)
    if category:
        items = [a for a in items if a.category == category]
    return _resp(items)


@router.get("/business-processes")
async def get_business_processes(request: Request) -> dict:
    return _resp(list_business_processes(_tid(request)))


@router.get("/capabilities/tree")
async def get_capability_tree(request: Request) -> dict:
    tree = list_capability_tree(_tid(request))
    return {"tree": tree}


@router.get("/capabilities/mappings")
async def get_capability_mappings(request: Request) -> dict:
    items = list_capability_mappings(_tid(request))
    return {"items": items, "total": len(items)}


# --- data-assets / data-entities / data-flows / data-standards / data/domains ---
@router.get("/data-assets")
async def get_data_assets(
    request: Request,
    layer: str | None = Query(default=None),
) -> dict:
    tid = _tid(request)
    items = list_data_assets(tid)
    if layer:
        items = [a for a in items if a.layer == layer]
    return _resp(items)


@router.get("/data-assets/catalog")
async def get_data_assets_catalog(request: Request) -> dict:
    return _resp(list_data_assets(_tid(request)))


@router.get("/data-entities")
async def get_data_entities(request: Request) -> dict:
    return _resp(list_data_entities(_tid(request)))


@router.get("/data-flows")
async def get_data_flows(request: Request) -> dict:
    return _resp(list_data_flows(_tid(request)))


@router.get("/data-standards")
async def get_data_standards(request: Request) -> dict:
    return _resp(list_data_standards(_tid(request)))


@router.get("/data/domains")
async def get_data_domains(request: Request) -> dict:
    return _resp(list_data_domains(_tid(request)))


# --- deployments / infrastructures ---
@router.get("/deployments")
async def get_deployments(request: Request) -> dict:
    return _resp(list_deployments(_tid(request)))


@router.get("/infrastructures")
async def get_infrastructures(request: Request) -> dict:
    return _resp(list_infrastructures(_tid(request)))


# --- governance ---
@router.get("/governance/principle-categories")
async def get_principle_categories(request: Request) -> dict:
    return _resp(list_governance_principle_categories(_tid(request)))


@router.get("/governance/principles")
async def get_principles(request: Request) -> dict:
    return _resp(list_governance_principles(_tid(request)))


@router.get("/governance/review-templates")
async def get_review_templates(request: Request) -> dict:
    return _resp(list_review_templates(_tid(request)))


@router.get("/governance/review-tickets")
async def get_review_tickets(request: Request) -> dict:
    return _resp(list_review_tickets(_tid(request)))


@router.get("/governance/tech-debts")
async def get_tech_debts(request: Request) -> dict:
    return _resp(list_tech_debts(_tid(request)))


# --- impact-analysis / ontology-mappings ---
@router.get("/impact-analysis")
async def get_impact_analysis(
    request: Request,
    node_id: str = Query(..., description="Capability node to analyze"),
) -> dict:
    items = list_impact_analysis(_tid(request), node_id)
    return {"items": [asdict(r) for r in items], "total": len(items)}


@router.get("/ontology-mappings/changes")
async def get_ontology_mapping_changes(request: Request) -> dict:
    return _resp(list_ontology_mapping_changes(_tid(request)))


@router.get("/ontology-mappings/rules")
async def get_ontology_mapping_rules(request: Request) -> dict:
    return _resp(list_ontology_mapping_rules(_tid(request)))


# --- orgs / roles ---
@router.get("/orgs/tree")
async def get_org_tree(request: Request) -> dict:
    tree = list_org_tree(_tid(request))
    return {"tree": tree}


@router.get("/orgs/roles")
async def get_org_roles(request: Request) -> dict:
    return _resp(list_org_roles(_tid(request)))


# --- tech-stacks / technology-* ---
@router.get("/tech-stacks")
async def get_tech_stacks(request: Request) -> dict:
    return _resp(list_tech_stacks(_tid(request)))


@router.get("/technology-components")
async def get_technology_components(request: Request) -> dict:
    return _resp(list_technology_components(_tid(request)))


@router.get("/technology-radar")
async def get_technology_radar(
    request: Request,
    ring: str | None = Query(default=None),
) -> dict:
    tid = _tid(request)
    items = list_technology_radar(tid)
    if ring:
        items = [e for e in items if e.ring == ring]
    return _resp(items)


@router.get("/technology-stacks")
async def get_technology_stacks(request: Request) -> dict:
    return _resp(list_technology_stacks(_tid(request)))


# --- value-streams ---
@router.get("/value-streams")
async def get_value_streams(request: Request) -> dict:
    return _resp(list_value_streams(_tid(request)))
