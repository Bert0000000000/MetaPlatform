from copy import deepcopy

import pytest

from mate_tech_ont.modeling.core import profile_rows, validate_ontology
from mate_tech_ont.modeling.data_treatment import prepare
from mate_tech_ont.modeling.review_completion import propose

from .test_modeling_generation_quality import related_fixture


def fixture():
    draft, rows = related_fixture()
    return {
        "id": "test-source",
        "revision": 1,
        "draft": draft,
        "profile": profile_rows(rows),
        "resolutions": {},
    }, rows


def test_one_inert_plan_closes_join_and_confirmation_dependencies():
    source, rows = fixture()
    original = deepcopy(source)
    plan = propose(source, rows)
    assert source == original
    assert plan["canApply"] and validate_ontology(plan["draft"])["canPublish"]
    assert plan["data"]["nodes"] == 3 and plan["data"]["edges"] == 1
    assert len(plan["draft"]["relationships"][0]["joins"]) == 2
    assert all(c["accepted"] for c in plan["draft"]["classes"])
    assert all(m["accepted"] for m in plan["draft"]["mappings"])
    assert propose(source, rows)["hash"] == plan["hash"]
    source["revision"] += 1
    assert propose(source, rows)["hash"] != plan["hash"]


def test_defer_class_excludes_descendants_mappings_manual_instances_and_links():
    source, rows = fixture()
    child = deepcopy(source["draft"]["classes"][0])
    child.update(
        id="child", name="费用子类", parentClassId="line", inheritanceReason="费用子类是一种费用"
    )
    source["draft"]["classes"].append(child)
    mapping = deepcopy(source["draft"]["mappings"][0])
    mapping.update(id="child-map", classId="child")
    source["draft"]["mappings"].append(mapping)
    source["draft"]["instances"] = [
        {
            "id": "manual",
            "classId": "child",
            "values": {"line_no": "99", "document_id": "X"},
            "accepted": True,
        }
    ]
    plan = propose(source, rows, ["line"])
    assert plan["canApply"] and plan["counts"] == {"classes": 1, "relationships": 0, "deferred": 3}
    assert not next(c for c in plan["draft"]["classes"] if c["id"] == "child")["included"]
    trial = {**source, "draft": plan["draft"]}
    report, nodes, edges, _ = prepare(trial, rows, True)
    assert report["canSync"] and len(nodes) == 1 and not edges
    assert {n["objectType"] for n in nodes} == {"payment"}
    assert source["draft"]["classes"][0]["included"]


def test_no_business_basis_is_not_invented_and_unrepairable_relation_is_deferred():
    source, rows = fixture()
    rel = source["draft"]["relationships"][0]
    rel["cardinalityReason"] = ""
    rel["cardinalityStatus"] = "unresolved"
    plan = propose(source, rows)
    assert plan["canApply"] and plan["counts"]["relationships"] == 0
    assert plan["draft"]["relationships"][0]["cardinalityStatus"] == "unresolved"
    assert any(c["id"] == "pays" and c["action"] == "暂缓" for c in plan["changes"])
    assert not any(c["id"] == "pays" and c["action"] == "确认" for c in plan["changes"])


def test_join_suggestion_without_any_matching_source_rows_is_not_adopted():
    source, rows = fixture()
    rows[-1]["values"]["单号"] = "absent"
    plan = propose(source, rows)
    assert plan["canApply"] and plan["counts"]["relationships"] == 0
    assert len(plan["draft"]["relationships"][0]["joins"]) == 1


def test_empty_scope_invalid_ids_and_published_candidates_cannot_apply():
    source, rows = fixture()
    assert not propose(source, rows, ["line", "payment"])["canApply"]
    with pytest.raises(ValueError, match="不存在"):
        propose(source, rows, ["missing"])
    source["publication"] = {"completed": ["native-type"]}
    with pytest.raises(ValueError, match="已有发布"):
        propose(source, rows)


def test_inheritance_completion_requires_existing_identity_bindings_and_preserves_source():
    source, rows = fixture()
    child = deepcopy(source["draft"]["classes"][0])
    child.update(
        id="child",
        name="费用子类",
        parentClassId="line",
        inheritanceReason="费用子类是一种费用",
        identity=["document_id"],
    )
    child["properties"] = [p for p in child["properties"] if p["id"] != "amount"]
    source["draft"]["classes"].append(child)
    mapping = deepcopy(source["draft"]["mappings"][0])
    mapping.update(id="child-map", classId="child")
    source["draft"]["mappings"].append(mapping)
    plan = propose(source, rows)
    fixed = next(c for c in plan["draft"]["classes"] if c["id"] == "child")
    assert (
        plan["canApply"] and fixed["included"] and fixed["identity"] == ["line_no", "document_id"]
    )
    assert any(p["id"] == "amount" for p in fixed["properties"])
    assert child["identity"] == ["document_id"] and all(
        p["id"] != "amount" for p in child["properties"]
    )


def test_missing_identity_mapping_defers_whole_class_instead_of_guessing_columns():
    source, rows = fixture()
    del source["draft"]["mappings"][0]["bindings"]["line_no"]
    plan = propose(source, rows)
    assert plan["canApply"] and plan["counts"]["classes"] == 1 and plan["data"]["nodes"] == 1
    assert any(c["id"] == "line" and c["action"] == "暂缓" for c in plan["changes"])
    assert "line_no" not in plan["draft"]["mappings"][0]["bindings"]


def test_deferred_classes_do_not_consume_completion_record_capacity(monkeypatch):
    from mate_tech_ont.modeling import generation_quality

    source, rows = fixture()
    monkeypatch.setattr(generation_quality, "MAX_NODES", 2)
    plan = propose(source, rows, ["line"])
    assert plan["canApply"] and plan["data"]["nodes"] == 1
