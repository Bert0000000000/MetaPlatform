"""FastAPI router for the architecture center (FR-ARCH-001..027).

27 GET endpoints under `/api/v1/arch/*`. Every handler enforces
ADR-0014 step 2 (`require_tenant(ctx)`) before touching the
repository.
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Body, HTTPException, Query, Request

from mate_platform.tenancy.guards import require_tenant

from ..repositories import (
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
    Infrastructure,
    OntologyMappingRule,
    Org,
    ReviewTemplate,
    ReviewTicket,
    Role,
    TechDebt,
    TechStack,
    TechnologyComponent,
    TechnologyRadarEntry,
    TechnologyStack,
    ValueStream,
    add_value_stream_stage,
    delete_value_stream_stage,
    gen_id,
    list_applications,
    list_business_processes,
    list_capabilities,
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
    list_orgs,
    list_roles,
    list_review_templates,
    list_review_tickets,
    list_tech_debts,
    list_tech_stacks,
    list_technology_components,
    list_technology_radar,
    list_technology_stacks,
    list_value_streams,
    move_capability,
    resolve_ontology_change,
    store_create,
    store_delete,
    store_get,
    store_update,
    update_value_stream_stage,
)

router = APIRouter(prefix="/api/v1/arch", tags=["arch"])


def _tid(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _items(rows: list) -> list[dict]:
    return [asdict(r) for r in rows]


def _resp(rows: list) -> dict:
    items = _items(rows)
    return {"items": items, "total": len(items)}


def _paginate(rows: list, page: int, size: int) -> dict:
    """Paginate a list of dataclass/dict rows into a cursor-free page envelope."""
    items = []
    for r in rows:
        items.append(r if isinstance(r, dict) else asdict(r))
    total = len(items)
    pages = (total + size - 1) // size if size > 0 else 0
    start = (page - 1) * size
    end = start + size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


def _ok(data=None) -> dict:
    """Standard write-operation response envelope."""
    return {"code": 0, "data": data, "message": "ok"}


def _changes(body: dict) -> dict:
    """Extract updatable fields from body (excludes id and tenant_id)."""
    return {k: v for k, v in body.items() if k not in ("id", "tenant_id")}


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


@router.get("/capabilities")
async def get_capabilities(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Flat capability list (FR-ARCH-ARCHGETARCHCAPABILITIES)."""
    rows = list_capabilities(_tid(request))
    return _paginate(rows, page, size)


@router.get("/capability-mappings")
async def get_capability_mappings_flat(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Flat capability→application mappings (FR-ARCH-ARCHGETARCHCAPABILITYMAPPINGS).

    Alias of /capabilities/mappings exposed at the canonical EA path.
    """
    rows = list_capability_mappings(_tid(request))
    return _paginate(rows, page, size)


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


@router.get("/orgs")
async def get_orgs(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Flat org list (FR-ARCH-ARCHGETARCHORGS)."""
    rows = list_orgs(_tid(request))
    return _paginate(rows, page, size)


@router.get("/roles")
async def get_roles(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Flat role list (FR-ARCH-ARCHGETARCHROLES)."""
    rows = list_roles(_tid(request))
    return _paginate(rows, page, size)


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


# ===========================================================================
# Write operations (POST / PUT / DELETE)
# ===========================================================================

# --- Application CRUD ---
@router.post("/applications")
async def create_application(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "applications", Application(
        id=gen_id("app"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("app")),
        category=body.get("category", ""), owner=body.get("owner", ""),
        status=body.get("status", "active"), description=body.get("description", ""),
    ))
    return _ok(asdict(item))


@router.put("/applications/{item_id}")
async def update_application(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "applications", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/applications/{item_id}")
async def delete_application(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "applications", item_id)
    return _ok()


# --- Capability CRUD + move ---
@router.post("/capabilities")
async def create_capability(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "capabilities", Capability(
        id=gen_id("cap"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("cap")),
        parent_id=body.get("parentId", body.get("parent_id", "")),
        level=body.get("level", 1),
        description=body.get("description", ""),
    ))
    return _ok(asdict(item))


@router.put("/capabilities/{item_id}")
async def update_capability(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "capabilities", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.put("/capabilities/{item_id}/move")
async def move_capability_node(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    new_parent = body.get("newParentId", body.get("new_parent_id", ""))
    item = move_capability(tid, item_id, new_parent)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/capabilities/{item_id}")
async def delete_capability(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "capabilities", item_id)
    return _ok()


# --- ValueStream CRUD + stages + capabilities ---
@router.post("/value-streams")
async def create_value_stream(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "value_streams", ValueStream(
        id=gen_id("vs"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("vs")),
        stages=tuple(body.get("stages", [])),
        description=body.get("description", ""),
    ))
    return _ok(asdict(item))


@router.put("/value-streams/{item_id}")
async def update_value_stream(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "value_streams", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/value-streams/{item_id}")
async def delete_value_stream(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "value_streams", item_id)
    return _ok()


@router.post("/value-streams/{vs_id}/stages")
async def add_vs_stage(
    request: Request, vs_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    stage_name = body.get("name", body.get("stageName", ""))
    item = add_value_stream_stage(tid, vs_id, stage_name)
    if not item:
        raise HTTPException(status_code=404, detail="Value stream not found")
    return _ok(asdict(item))


@router.put("/value-streams/{vs_id}/stages/{stage_id}")
async def update_vs_stage(
    request: Request, vs_id: str, stage_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    new_name = body.get("name", body.get("stageName", stage_id))
    item = update_value_stream_stage(tid, vs_id, stage_id, new_name)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/value-streams/{vs_id}/stages/{stage_id}")
async def delete_vs_stage(
    request: Request, vs_id: str, stage_id: str,
) -> dict:
    tid = _tid(request)
    delete_value_stream_stage(tid, vs_id, stage_id)
    return _ok()


@router.post("/value-streams/{vs_id}/capabilities")
async def link_vs_capabilities(
    request: Request, vs_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    cap_ids = body.get("capabilityIds", body.get("capability_ids", []))
    stage_name = body.get("stageName", body.get("stage_name", ""))
    return _ok({
        "valueStreamId": vs_id,
        "linked": len(cap_ids),
        "stageName": stage_name,
    })


# --- BusinessProcess CRUD + roles ---
@router.post("/business-processes")
async def create_business_process(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "business_processes", BusinessProcess(
        id=gen_id("bp"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("bp")),
        application_id=body.get("applicationId", body.get("application_id", "")),
        description=body.get("description", ""),
    ))
    return _ok(asdict(item))


@router.put("/business-processes/{item_id}")
async def update_business_process(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "business_processes", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/business-processes/{item_id}")
async def delete_business_process(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "business_processes", item_id)
    return _ok()


@router.post("/business-processes/{bp_id}/roles")
async def link_bp_roles(
    request: Request, bp_id: str, body: dict = Body(...),
) -> dict:
    _tid(request)
    role_ids = body.get("roleIds", body.get("role_ids", []))
    relationship = body.get("relationship", "owner")
    return _ok({
        "businessProcessId": bp_id,
        "linked": len(role_ids),
        "relationship": relationship,
    })


# --- Org CRUD ---
@router.post("/orgs")
async def create_org(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "orgs", Org(
        id=gen_id("org"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("org")),
        parent_id=body.get("parentId", body.get("parent_id", "")),
        level=body.get("level", 1),
    ))
    return _ok(asdict(item))


@router.put("/orgs/{item_id}")
async def update_org(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "orgs", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/orgs/{item_id}")
async def delete_org(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "orgs", item_id)
    return _ok()


# --- Role CRUD ---
@router.post("/roles")
async def create_role(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "roles", Role(
        id=gen_id("role"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("role")),
        org_id=body.get("orgId", body.get("org_id", "")),
    ))
    return _ok(asdict(item))


@router.put("/roles/{item_id}")
async def update_role(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "roles", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/roles/{item_id}")
async def delete_role(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "roles", item_id)
    return _ok()


# --- DataDomain (POST + DELETE only) ---
@router.post("/data/domains")
async def create_data_domain(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "data_domains", DataDomain(
        id=gen_id("dd"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("dd")),
        parent_id=body.get("parentId", body.get("parent_id", "")),
    ))
    return _ok(asdict(item))


@router.delete("/data/domains/{item_id}")
async def delete_data_domain(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "data_domains", item_id)
    return _ok()


# --- DataEntity CRUD ---
@router.post("/data-entities")
async def create_data_entity(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "data_entities", DataEntity(
        id=gen_id("de"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("de")),
        data_asset_id=body.get("dataAssetId", body.get("data_asset_id", "")),
        fields=tuple(body.get("fields", [])),
    ))
    return _ok(asdict(item))


@router.put("/data-entities/{item_id}")
async def update_data_entity(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "data_entities", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/data-entities/{item_id}")
async def delete_data_entity(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "data_entities", item_id)
    return _ok()


# --- DataFlow CRUD ---
@router.post("/data-flows")
async def create_data_flow(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "data_flows", DataFlow(
        id=gen_id("df"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("df")),
        source_entity_id=body.get(
            "sourceEntityId", body.get("source_entity_id", "")),
        target_entity_id=body.get(
            "targetEntityId", body.get("target_entity_id", "")),
        pipeline_spec=body.get(
            "pipelineSpec", body.get("pipeline_spec", "")),
    ))
    return _ok(asdict(item))


@router.put("/data-flows/{item_id}")
async def update_data_flow(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "data_flows", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/data-flows/{item_id}")
async def delete_data_flow(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "data_flows", item_id)
    return _ok()


# --- DataStandard CRUD ---
@router.post("/data-standards")
async def create_data_standard(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "data_standards", DataStandard(
        id=gen_id("ds"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("ds")),
        domain=body.get("domain", ""),
        description=body.get("description", ""),
    ))
    return _ok(asdict(item))


@router.put("/data-standards/{item_id}")
async def update_data_standard(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "data_standards", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/data-standards/{item_id}")
async def delete_data_standard(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "data_standards", item_id)
    return _ok()


# --- DataAsset CRUD ---
@router.post("/data-assets")
async def create_data_asset(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "data_assets", DataAsset(
        id=gen_id("da"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("da")),
        layer=body.get("layer", ""), domain=body.get("domain", ""),
        owner=body.get("owner", ""), status=body.get("status", "accepted"),
    ))
    return _ok(asdict(item))


@router.put("/data-assets/{item_id}")
async def update_data_asset(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "data_assets", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/data-assets/{item_id}")
async def delete_data_asset(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "data_assets", item_id)
    return _ok()


# --- Deployment CRUD ---
@router.post("/deployments")
async def create_deployment(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "deployments", Deployment(
        id=gen_id("dep"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("dep")),
        application_id=body.get(
            "applicationId", body.get("application_id", "")),
        environment=body.get("environment", "staging"),
        cluster=body.get("cluster", "default"),
    ))
    return _ok(asdict(item))


@router.put("/deployments/{item_id}")
async def update_deployment(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "deployments", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/deployments/{item_id}")
async def delete_deployment(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "deployments", item_id)
    return _ok()


# --- PrincipleCategory CRUD ---
@router.post("/governance/principle-categories")
async def create_principle_category(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "principle_categories", GovernancePrincipleCategory(
        id=gen_id("gpc"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("gpc")),
        sort_order=body.get("sortOrder", body.get("sort_order", 0)),
    ))
    return _ok(asdict(item))


@router.put("/governance/principle-categories/{item_id}")
async def update_principle_category(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "principle_categories", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/governance/principle-categories/{item_id}")
async def delete_principle_category(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "principle_categories", item_id)
    return _ok()


# --- Principle CRUD ---
@router.post("/governance/principles")
async def create_principle(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "principles", GovernancePrinciple(
        id=gen_id("gp"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("gp")),
        category_id=body.get(
            "categoryId", body.get("category_id", "")),
        description=body.get("description", ""),
    ))
    return _ok(asdict(item))


@router.put("/governance/principles/{item_id}")
async def update_principle(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "principles", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/governance/principles/{item_id}")
async def delete_principle(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "principles", item_id)
    return _ok()


# --- ReviewTemplate CRUD ---
@router.post("/governance/review-templates")
async def create_review_template(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "review_templates", ReviewTemplate(
        id=gen_id("rt"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("rt")),
        category=body.get("category", ""),
        checklist=tuple(body.get("checklist", [])),
    ))
    return _ok(asdict(item))


@router.put("/governance/review-templates/{item_id}")
async def update_review_template(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "review_templates", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/governance/review-templates/{item_id}")
async def delete_review_template(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "review_templates", item_id)
    return _ok()


# --- ReviewTicket CRUD + actions ---
@router.post("/governance/review-tickets")
async def create_review_ticket(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "review_tickets", ReviewTicket(
        id=gen_id("rv"), tenant_id=tid,
        title=body.get("title", ""),
        application_id=body.get(
            "applicationId", body.get("application_id", "")),
        template_id=body.get(
            "templateId", body.get("template_id", "")),
        status=body.get("status", "open"),
    ))
    return _ok(asdict(item))


@router.put("/governance/review-tickets/{item_id}")
async def update_review_ticket(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "review_tickets", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/governance/review-tickets/{item_id}")
async def delete_review_ticket(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "review_tickets", item_id)
    return _ok()


@router.post("/governance/review-tickets/{item_id}/start")
async def start_review_ticket(
    request: Request, item_id: str,
    reviewer: str = Query(...),
) -> dict:
    tid = _tid(request)
    item = store_update(
        tid, "review_tickets", item_id, {"status": "in_review"})
    if not item:
        raise HTTPException(status_code=404, detail="Review ticket not found")
    return _ok(asdict(item))


@router.post("/governance/review-tickets/{item_id}/approve")
async def approve_review_ticket(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(
        tid, "review_tickets", item_id, {"status": "approved"})
    if not item:
        raise HTTPException(status_code=404, detail="Review ticket not found")
    return _ok(asdict(item))


@router.post("/governance/review-tickets/{item_id}/reject")
async def reject_review_ticket(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(
        tid, "review_tickets", item_id, {"status": "rejected"})
    if not item:
        raise HTTPException(status_code=404, detail="Review ticket not found")
    return _ok(asdict(item))


@router.post("/governance/review-tickets/{item_id}/comments")
async def add_review_ticket_comment(
    request: Request, item_id: str,
    reviewer: str = Query(...),
    comment: str = Query(...),
) -> dict:
    _tid(request)
    return _ok({"ticketId": item_id, "reviewer": reviewer, "comment": comment})


# --- TechDebt CRUD ---
@router.post("/governance/tech-debts")
async def create_tech_debt(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "tech_debts", TechDebt(
        id=gen_id("td"), tenant_id=tid,
        title=body.get("title", ""),
        application_id=body.get(
            "applicationId", body.get("application_id", "")),
        severity=body.get("severity", "medium"),
        status=body.get("status", "open"),
    ))
    return _ok(asdict(item))


@router.put("/governance/tech-debts/{item_id}")
async def update_tech_debt(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "tech_debts", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/governance/tech-debts/{item_id}")
async def delete_tech_debt(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "tech_debts", item_id)
    return _ok()


# --- OntologyMappingRule CRUD + actions ---
@router.post("/ontology-mappings/rules")
async def create_ontology_mapping_rule(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "ontology_rules", OntologyMappingRule(
        id=gen_id("omr"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("omr")),
        source_concept=body.get(
            "sourceConcept", body.get("source_concept", "")),
        target_concept=body.get(
            "targetConcept", body.get("target_concept", "")),
    ))
    return _ok(asdict(item))


@router.put("/ontology-mappings/rules/{item_id}")
async def update_ontology_mapping_rule(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "ontology_rules", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/ontology-mappings/rules/{item_id}")
async def delete_ontology_mapping_rule(
    request: Request, item_id: str,
) -> dict:
    tid = _tid(request)
    store_delete(tid, "ontology_rules", item_id)
    return _ok()


@router.post("/ontology-mappings/sync-to-ontology")
async def sync_to_ontology(
    request: Request,
    assetType: str | None = Query(default=None),
) -> dict:
    _tid(request)
    return _ok({"synced": 0})


@router.post("/ontology-mappings/sync-from-ontology")
async def sync_from_ontology(
    request: Request,
    assetType: str | None = Query(default=None),
) -> dict:
    _tid(request)
    return _ok({"synced": 0})


@router.post("/ontology-mappings/changes/{change_id}/resolve")
async def resolve_ontology_mapping_change(
    request: Request, change_id: str,
) -> dict:
    tid = _tid(request)
    resolve_ontology_change(tid, change_id)
    return _ok({"resolved": True})


# --- ImpactAnalysis POST ---
@router.post("/impact-analysis")
async def post_impact_analysis(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    node_id = body.get("capabilityId", body.get("capability_id", ""))
    items = list_impact_analysis(tid, node_id)
    return {"items": [asdict(r) for r in items], "total": len(items)}


# --- TechnologyComponent CRUD ---
@router.post("/technology-components")
async def create_technology_component(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "technology_components", TechnologyComponent(
        id=gen_id("tc"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("tc")),
        category=body.get("category", ""),
        vendor=body.get("vendor", "open-source"),
    ))
    return _ok(asdict(item))


@router.put("/technology-components/{item_id}")
async def update_technology_component(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "technology_components", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/technology-components/{item_id}")
async def delete_technology_component(
    request: Request, item_id: str,
) -> dict:
    tid = _tid(request)
    store_delete(tid, "technology_components", item_id)
    return _ok()


# --- TechnologyRadar CRUD ---
@router.post("/technology-radar")
async def create_technology_radar(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "technology_radar", TechnologyRadarEntry(
        id=gen_id("tr"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("tr")),
        quadrant=body.get("quadrant", ""),
        ring=body.get("ring", ""),
    ))
    return _ok(asdict(item))


@router.put("/technology-radar/{item_id}")
async def update_technology_radar(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "technology_radar", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/technology-radar/{item_id}")
async def delete_technology_radar(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "technology_radar", item_id)
    return _ok()


# --- TechnologyStack CRUD ---
@router.post("/technology-stacks")
async def create_technology_stack(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "technology_stacks", TechnologyStack(
        id=gen_id("tst"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("tst")),
        application_id=body.get(
            "applicationId", body.get("application_id", "")),
        component_ids=tuple(
            body.get("componentIds", body.get("component_ids", []))),
    ))
    return _ok(asdict(item))


@router.put("/technology-stacks/{item_id}")
async def update_technology_stack(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "technology_stacks", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/technology-stacks/{item_id}")
async def delete_technology_stack(
    request: Request, item_id: str,
) -> dict:
    tid = _tid(request)
    store_delete(tid, "technology_stacks", item_id)
    return _ok()


# --- TechStack CRUD ---
@router.post("/tech-stacks")
async def create_tech_stack(request: Request, body: dict = Body(...)) -> dict:
    tid = _tid(request)
    item = store_create(tid, "tech_stacks", TechStack(
        id=gen_id("ts"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("ts")),
        category=body.get("category", ""),
    ))
    return _ok(asdict(item))


@router.put("/tech-stacks/{item_id}")
async def update_tech_stack(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "tech_stacks", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/tech-stacks/{item_id}")
async def delete_tech_stack(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "tech_stacks", item_id)
    return _ok()


# --- Infrastructure CRUD ---
@router.post("/infrastructures")
async def create_infrastructure(
    request: Request, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_create(tid, "infrastructures", Infrastructure(
        id=gen_id("infra"), tenant_id=tid,
        name=body.get("name", ""), code=body.get("code", gen_id("infra")),
        kind=body.get("kind", ""),
        region=body.get("region", "cn-beijing"),
    ))
    return _ok(asdict(item))


@router.put("/infrastructures/{item_id}")
async def update_infrastructure(
    request: Request, item_id: str, body: dict = Body(...),
) -> dict:
    tid = _tid(request)
    item = store_update(tid, "infrastructures", item_id, _changes(body))
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return _ok(asdict(item))


@router.delete("/infrastructures/{item_id}")
async def delete_infrastructure(request: Request, item_id: str) -> dict:
    tid = _tid(request)
    store_delete(tid, "infrastructures", item_id)
    return _ok()
