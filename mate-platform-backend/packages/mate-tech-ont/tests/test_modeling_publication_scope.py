from copy import deepcopy

import pytest

from mate_tech_ont.modeling.core import (
    Draft,
    digest,
    profile_rows,
    validate_draft,
    validate_ontology,
)

ROWS = [{"sheet": "业务表", "row": 2, "values": {"编码": "P1", "名称": "产品"}}]


def draft():
    return {
        "name": "产品模型",
        "classes": [
            {
                "id": "product",
                "name": "产品",
                "properties": [
                    {"id": "code", "name": "编码", "dataType": "text"},
                    {"id": "name", "name": "名称", "dataType": "text"},
                ],
                "identity": ["code"],
                "labelProperty": "name",
                "accepted": True,
            }
        ],
        "mappings": [
            {
                "id": "product_rows",
                "classId": "product",
                "sheet": "业务表",
                "bindings": {"code": "编码", "name": "名称"},
                "accepted": True,
            }
        ],
        "relationships": [],
    }


def test_structure_publication_is_independent_of_missing_identity_and_mapping_approval():
    value = draft()
    value["mappings"][0]["accepted"] = False
    broken = deepcopy(ROWS)
    for row in broken:
        row["values"]["编码"] = None
    assert validate_draft(value, broken)["errors"] > 0
    report = validate_ontology(value)
    assert report["scope"] == "ontology"
    assert report["canPublish"] and report["errors"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["人员", "组织", "产品"])
async def test_exact_name_conflicts_are_independent_of_similarity_and_catalog_page(
    monkeypatch, name
):
    from types import SimpleNamespace

    from mate_tech_ont.modeling import publication

    value = draft()
    value["classes"][0].update(id="new-concept", name=name)
    source = {"revision": 1, "draft": value, "resolutions": {}}
    monkeypatch.setattr(
        publication.native, "_ctx", lambda request: SimpleNamespace(tenant_id="test")
    )

    async def missing(*args):
        return None

    pages = []

    async def catalog(request, limit, offset):
        pages.append(offset)
        items = (
            [
                {"rid": f"ont.test.obj.crm.unrelated-{i}.v1", "display_name": f"无关{i}"}
                for i in range(100)
            ]
            if offset == 0
            else [
                {"rid": f"ont.test.obj.crm.existing-{i}.v1", "display_name": name} for i in range(6)
            ]
        )
        return [SimpleNamespace(model_dump=lambda item=item: item) for item in items]

    monkeypatch.setattr(publication, "current_type", missing)
    monkeypatch.setattr(publication.native, "list_object_types", catalog)
    issues = await publication.new_type_conflicts(None, source)
    assert len(issues) == 1
    assert issues[0]["item"] == "new-concept" and issues[0]["severity"] == "error"
    assert "精确同名" in issues[0]["message"]
    assert all(f"existing-{i}" in issues[0]["message"] for i in range(6))
    assert pages == [0, 100]
    source["resolutions"] = {"new-concept": {"mode": "new", "propertyMap": {}}}
    assert await publication.new_type_conflicts(None, source) == []

    async def valid(*args):
        return {"valid": True}

    async def similar(*args):
        return SimpleNamespace(model_dump=lambda: {"candidates": []})

    async def no_sources(*args):
        return []

    monkeypatch.setattr(publication.native, "validate_model_endpoint", valid)
    monkeypatch.setattr(publication.native, "precheck_object_type", similar)
    monkeypatch.setattr(publication.native, "list_backing_datasources", no_sources)
    plan = await publication.prepare(None, source)
    assert plan["types"][0]["mode"] == "new"
    notice = next(w for w in plan["warnings"] if "精确同名" in w)
    assert all(f"existing-{i}" in notice for i in range(6))
    source["resolutions"] = {}
    with pytest.raises(ValueError, match="精确同名"):
        await publication.prepare(None, source)


@pytest.mark.asyncio
@pytest.mark.parametrize("matching", [True, False])
async def test_same_named_own_completed_type_does_not_block_valid_retry(monkeypatch, matching):
    from types import SimpleNamespace

    from mate_tech_ont.modeling import publication
    from mate_tech_ont.modeling.core import digest

    value = draft()
    other = deepcopy(value["classes"][0])
    other["id"] = "remaining"
    value["classes"].append(other)
    source = {"draft": value, "resolutions": {}}
    input_hash = digest(
        {k: source.get(k) for k in ("draft", "context", "questions", "resolutions")}
    )
    own_rid = "ont.test.obj.data.product.v1"
    source["plan"] = {
        "configHash": "plan",
        "inputHash": input_hash,
        "types": [{"rid": own_rid}, {"rid": "ont.test.obj.data.remaining.v1"}],
    }
    source["publication"] = {
        "configHash": "plan" if matching else "stale",
        "inputHash": input_hash,
        "completed": [own_rid],
    }
    monkeypatch.setattr(
        publication.native, "_ctx", lambda request: SimpleNamespace(tenant_id="test")
    )

    async def missing(*args):
        return None

    catalog = [{"rid": own_rid, "display_name": "产品"}]

    async def native_catalog(*args):
        return catalog

    monkeypatch.setattr(publication, "current_type", missing)
    monkeypatch.setattr(publication, "native_type_catalog", native_catalog)
    issues = await publication.new_type_conflicts(None, source)
    assert bool(issues) is not matching
    catalog.append({"rid": "ont.test.obj.crm.external.v1", "display_name": "产品"})
    issues = await publication.new_type_conflicts(None, source)
    assert any("external" in issue["message"] for issue in issues)


@pytest.mark.asyncio
@pytest.mark.parametrize("started", ["intent", "completed", "none"])
@pytest.mark.parametrize("matching", [True, False])
async def test_blocked_precheck_preserves_only_matching_started_publication_plan(
    monkeypatch, started, matching
):
    from mate_tech_ont.modeling import api

    source = {
        "draft": Draft.model_validate(draft()).model_dump(),
        "profile": profile_rows(ROWS),
        "context": "",
        "questions": [],
        "resolutions": {},
    }
    input_hash = digest(
        {key: source[key] for key in ("draft", "context", "questions", "resolutions")}
    )
    reviewed = {
        "inputHash": input_hash,
        "configHash": "reviewed-plan",
        "types": [{"rid": "native-type"}],
    }
    source["plan"] = reviewed
    source["publication"] = {
        "inputHash": input_hash if matching else "stale-input",
        "configHash": reviewed["configHash"],
        "completed": ["native-type"] if started == "completed" else [],
        "inFlight": "native-type" if started == "intent" else None,
    }

    async def changed_native(*args):
        return [{"severity": "error", "item": "native", "message": "Native definition changed"}]

    monkeypatch.setattr(api.publication, "new_type_conflicts", changed_native)
    result = await api.validation_result(None, source, ROWS, prepare_publication=True)
    assert not result["validation"]["canPublish"]
    assert any(
        issue["message"] == "Native definition changed" for issue in result["validation"]["issues"]
    )
    assert result["plan"] == (reviewed if matching and started != "none" else None)


@pytest.mark.asyncio
async def test_similar_customer_requires_explicit_new_decision(monkeypatch):
    from types import SimpleNamespace

    from mate_tech_ont.modeling import publication

    value = draft()
    value["classes"][0].update(id="customer", name="客户")
    value["mappings"] = []
    source = {"revision": 1, "draft": value, "resolutions": {}}
    monkeypatch.setattr(
        publication.native, "_ctx", lambda request: SimpleNamespace(tenant_id="test")
    )

    async def missing(*args):
        return None

    async def valid(*args):
        return {"valid": True}

    async def no_sources(*args):
        return []

    async def similar(*args):
        return SimpleNamespace(
            model_dump=lambda: {
                "candidates": [
                    {
                        "rid": "ont.test.obj.crm.customer.v1",
                        "display_name": "Customer",
                        "similarity": 0.95,
                    }
                ]
            }
        )

    monkeypatch.setattr(publication, "current_type", missing)
    monkeypatch.setattr(publication.native, "validate_model_endpoint", valid)
    monkeypatch.setattr(publication.native, "precheck_object_type", similar)
    monkeypatch.setattr(publication.native, "list_backing_datasources", no_sources)
    monkeypatch.setattr(publication, "native_type_catalog", no_sources)
    with pytest.raises(ValueError, match="显式选择"):
        await publication.prepare(None, source)
    source["resolutions"] = {"customer": {"mode": "new", "propertyMap": {}}}
    plan = await publication.prepare(None, source)
    assert plan["types"][0]["mode"] == "new"
    assert plan["types"][0]["rid"] != "ont.test.obj.crm.customer.v1"


def test_structure_still_requires_approval_and_valid_references():
    value = draft()
    value["classes"][0]["accepted"] = False
    assert not validate_ontology(value)["canPublish"]
    value["classes"][0]["accepted"] = True
    value["classes"][0]["identity"] = ["missing"]
    assert not validate_ontology(value)["canPublish"]


def test_data_problems_are_aggregated_beyond_the_bounded_issue_sample():
    value = draft()
    rows = [
        {"sheet": "业务表", "row": n + 2, "values": {"编码": None, "名称": "对象", "数量": 1}}
        for n in range(900)
    ]
    report = validate_draft(value, rows)
    assert len(report["issues"]) <= 200
    group = next(g for g in report["issueGroups"] if "身份属性存在空值" in g["message"])
    assert group["count"] == 900


@pytest.mark.asyncio
async def test_native_conflicts_are_reported_for_all_candidates(monkeypatch):
    from types import SimpleNamespace

    from mate_tech_ont.modeling import publication

    value = draft()
    other = deepcopy(value["classes"][0])
    other.update(id="other", name="另一个对象")
    value["classes"].append(other)
    source = {"draft": value, "resolutions": {}, "context": "", "questions": []}
    monkeypatch.setattr(
        publication.native, "_ctx", lambda request: SimpleNamespace(tenant_id="test")
    )

    async def existing(request, rid):
        return {"rid": rid}

    monkeypatch.setattr(publication, "current_type", existing)
    issues = await publication.new_type_conflicts(None, source)
    assert {issue["item"] for issue in issues} == {"product", "other"}
    assert all("复用" in issue["message"] for issue in issues)


def test_deferred_candidate_is_preserved_but_not_validated_or_compiled():
    from mate_tech_ont.modeling.core import compile_graph

    value = draft()
    deferred = deepcopy(value["classes"][0])
    deferred.update(id="later", accepted=False, identityStatus="proposed", included=False)
    value["classes"].append(deferred)
    value["relationships"] = [
        {
            "id": "later_link",
            "name": "稍后关联",
            "source": "product",
            "target": "later",
            "joins": [{"sourceProperty": "code", "targetProperty": "code"}],
            "included": False,
        }
    ]
    before = deepcopy(value)
    report = validate_ontology(value)
    assert report["canPublish"], report
    assert report["counts"]["classes"] == 1
    nodes, edges = compile_graph(value, ROWS)
    assert len(nodes) == 1 and not edges
    assert value == before


def test_deferred_property_is_preserved_but_removed_from_mapping_and_compiled_nodes():
    import json

    from mate_tech_ont.modeling.core import compile_graph
    from mate_tech_ont.modeling.scope import publication_scope

    value = draft()
    value["classes"][0]["properties"].append(
        {
            "id": "quantity",
            "name": "数量",
            "dataType": "number",
            "included": False,
            "deferReason": "来源不完整",
        }
    )
    value["mappings"][0]["bindings"]["quantity"] = "数量"
    rows = [
        {
            "sheet": "业务表",
            "row": 2,
            "values": {"编码": "P1", "名称": "产品", "数量": 3},
        }
    ]

    before = deepcopy(value)
    scoped = publication_scope(value)
    report = validate_ontology(value)
    nodes, _ = compile_graph(value, rows)
    payload = json.loads(nodes[0]["payload"])

    assert report["canPublish"] and report["counts"]["properties"] == 2
    assert "quantity" not in {p["id"] for p in scoped["classes"][0]["properties"]}
    assert "quantity" not in scoped["mappings"][0]["bindings"]
    assert "quantity" not in payload["properties"]
    assert value == before


@pytest.mark.parametrize("scope", ["ontology", "data"])
def test_deferring_every_property_returns_a_structural_error(scope):
    from mate_tech_ont.modeling.core import Draft, validate_draft

    value = draft()
    for prop in value["classes"][0]["properties"]:
        prop["included"] = False
    assert Draft.model_validate(value)

    report = validate_ontology(value) if scope == "ontology" else validate_draft(value, [])

    assert not report["canPublish"]
    assert report["errors"] and report["issues"]


def test_selected_dependencies_and_empty_scope_are_blocked():
    value = draft()
    value["classes"][0]["included"] = False
    assert not validate_ontology(value)["canPublish"]
    other = deepcopy(value["classes"][0])
    other.update(id="child", included=True, parentClassId="product", inheritanceReason="是一种产品")
    value["classes"].append(other)
    assert any("父类" in i["message"] for i in validate_ontology(value)["issues"])
    other.pop("parentClassId")
    value["relationships"] = [
        {
            "id": "r",
            "name": "关联",
            "source": "child",
            "target": "product",
            "joins": [{"sourceProperty": "code", "targetProperty": "code"}],
            "accepted": True,
        }
    ]
    assert any("关系引用" in i["message"] for i in validate_ontology(value)["issues"])


@pytest.mark.asyncio
async def test_deferred_types_do_not_create_native_conflicts(monkeypatch):
    from types import SimpleNamespace

    from mate_tech_ont.modeling import publication

    value = draft()
    other = deepcopy(value["classes"][0])
    other.update(id="later", included=False)
    value["classes"].append(other)
    monkeypatch.setattr(
        publication.native, "_ctx", lambda request: SimpleNamespace(tenant_id="test")
    )

    async def existing(request, rid):
        return {"rid": rid}

    monkeypatch.setattr(publication, "current_type", existing)
    issues = await publication.new_type_conflicts(None, {"draft": value, "resolutions": {}})
    assert [issue["item"] for issue in issues] == ["product"]
