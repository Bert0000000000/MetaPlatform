from copy import deepcopy

import pytest

from mate_tech_ont.modeling.core import validate_draft, validate_ontology

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
    value["relationships"] = [{"id": "later_link", "name": "稍后关联", "source": "product", "target": "later", "joins": [{"sourceProperty": "code", "targetProperty": "code"}], "included": False}]
    before = deepcopy(value)
    report = validate_ontology(value)
    assert report["canPublish"], report
    assert report["counts"]["classes"] == 1
    nodes, edges = compile_graph(value, ROWS)
    assert len(nodes) == 1 and not edges
    assert value == before


def test_selected_dependencies_and_empty_scope_are_blocked():
    value = draft()
    value["classes"][0]["included"] = False
    assert not validate_ontology(value)["canPublish"]
    other = deepcopy(value["classes"][0])
    other.update(id="child", included=True, parentClassId="product", inheritanceReason="是一种产品")
    value["classes"].append(other)
    assert any("父类" in i["message"] for i in validate_ontology(value)["issues"])
    other.pop("parentClassId")
    value["relationships"] = [{"id": "r", "name": "关联", "source": "child", "target": "product", "joins": [{"sourceProperty": "code", "targetProperty": "code"}], "accepted": True}]
    assert any("关系引用" in i["message"] for i in validate_ontology(value)["issues"])


@pytest.mark.asyncio
async def test_deferred_types_do_not_create_native_conflicts(monkeypatch):
    from types import SimpleNamespace
    from mate_tech_ont.modeling import publication
    value = draft()
    other = deepcopy(value["classes"][0])
    other.update(id="later", included=False)
    value["classes"].append(other)
    monkeypatch.setattr(publication.native, "_ctx", lambda request: SimpleNamespace(tenant_id="test"))
    async def existing(request, rid):
        return {"rid": rid}
    monkeypatch.setattr(publication, "current_type", existing)
    issues = await publication.new_type_conflicts(None, {"draft": value, "resolutions": {}})
    assert [issue["item"] for issue in issues] == ["product"]
