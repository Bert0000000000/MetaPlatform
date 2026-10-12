from copy import deepcopy

import pytest

from mate_tech_ont.modeling.core import Draft, compile_graph, validate_draft

from .test_modeling_core import ROWS, draft


def quality_draft():
    value = draft()
    value["semantics"] = {
        "context": "识别产品与来源，未确认的业务规则不能推断。",
        "questions": [{"id": "q1", "question": "产品有哪些？", "expected": "能定位产品及来源"}],
        "definitions": [
            {
                "target": "class:product",
                "definition": "可识别的产品实体",
                "aliases": ["单机"],
                "grain": "每个产品编码一条",
                "scope": "产品表",
                "unit": "",
                "constraints": "编码不得为空",
                "basis": "产品表编码样本",
                "confirmed": False,
            }
        ],
    }
    return value


def context(value=None):
    from mate_tech_ont.modeling.quality import review_context

    value = value or quality_draft()
    return review_context(
        {"id": "source", "revision": 3, "draft": value, "rows": ROWS, "profile": {"sheets": []}}
    )


def result():
    return {
        "summary": "模型表达产品，但业务口径需要确认。",
        "issues": [
            {
                "id": "i1",
                "severity": "warning",
                "target": "class:product",
                "category": "粒度",
                "message": "确认是否按产品编码识别",
                "suggestion": "核对业务唯一键",
                "evidenceIds": ["sample:0"],
                "needsConfirmation": True,
            }
        ],
        "coverage": [
            {
                "questionId": "q1",
                "status": "covered",
                "targets": ["class:product"],
                "reason": "存在类和来源映射",
                "evidenceIds": ["sample:0"],
            }
        ],
    }


def test_optional_semantics_are_round_tripped_without_changing_instances():
    old = draft()
    value = quality_draft()
    parsed = Draft.model_validate(value).model_dump()
    assert parsed["semantics"]["definitions"][0]["aliases"] == ["单机"]
    assert compile_graph(old, ROWS) == compile_graph(value, ROWS)


def test_semantic_target_must_exist_and_question_ids_are_unique():
    value = quality_draft()
    value["semantics"]["definitions"][0]["target"] = "class:missing"
    value["semantics"]["questions"].append(deepcopy(value["semantics"]["questions"][0]))
    checked = validate_draft(value, ROWS)
    assert checked["errors"] >= 2
    assert not checked["canPublish"]


def test_context_uses_real_bounded_observations_and_never_returns_all_rows():
    from mate_tech_ont.modeling.quality import review_context

    source = {
        "id": "source",
        "revision": 3,
        "draft": quality_draft(),
        "rows": ROWS * 500,
        "profile": {"sheets": []},
    }
    data = review_context(source)
    assert "rows" not in data
    samples = [e for e in data["evidence"] if e["kind"] == "sample"]
    assert len(samples) <= 120
    assert samples[0]["values"] == ROWS[0]["values"]
    assert data["draft"]["classes"][0]["id"] == "product"
    assert "accepted" not in data["draft"]["classes"][0]


def test_review_rejects_invented_targets_evidence_and_missing_question_coverage():
    from mate_tech_ont.modeling.quality import validate_review

    data = context()
    for field, replacement in [("target", "class:invented"), ("evidenceIds", ["fake"])]:
        bad = result()
        bad["issues"][0][field] = replacement
        with pytest.raises(ValueError):
            validate_review(bad, data)
    bad = result()
    bad["coverage"] = []
    with pytest.raises(ValueError):
        validate_review(bad, data)


def test_covered_requires_both_model_targets_and_data_evidence():
    from mate_tech_ont.modeling.quality import validate_review

    for field in ("targets", "evidenceIds"):
        bad = result()
        bad["coverage"][0][field] = []
        with pytest.raises(ValueError):
            validate_review(bad, context())


def test_review_hash_changes_on_model_edits_but_not_approval_flags():
    from mate_tech_ont.modeling.quality import semantic_hash

    value = quality_draft()
    original = semantic_hash(value)
    value["classes"][0]["accepted"] = not value["classes"][0]["accepted"]
    assert semantic_hash(value) == original
    value["semantics"]["definitions"][0]["grain"] = "每批次一条"
    assert semantic_hash(value) != original


def test_chinese_semantic_search_is_bounded_and_includes_published_definitions():
    from mate_tech_ont.modeling.quality import browse_semantics, resolve_semantics

    value = quality_draft()
    data = browse_semantics(value, "这个单机有哪些产品", limit=6)
    assert any(item["target"] == "class:product" for item in data["items"])
    resolved = resolve_semantics(value, ["单机"])
    assert resolved["items"][0]["definition"]["grain"] == "每个产品编码一条"
    assert resolved["items"][0]["mappings"]
    assert browse_semantics(value, "", limit=100)["items"] == []


def test_review_success_is_explicit_and_does_not_mutate_the_draft():
    from mate_tech_ont.modeling.quality import validate_review

    value = quality_draft()
    original = deepcopy(value)
    checked = validate_review(result(), context(value))
    assert checked["summary"]
    assert checked["coverage"][0]["status"] == "covered"
    assert value == original


def test_unconfirmed_semantic_definitions_remain_explicit_publication_warnings():
    checked = validate_draft(quality_draft(), ROWS)
    assert any("语义口径尚未业务确认" in issue["message"] for issue in checked["issues"])
    assert checked["canPublish"]


def test_property_level_units_and_definitions_can_be_published_and_resolved():
    from mate_tech_ont.modeling.quality import resolve_semantics

    value = quality_draft()
    value["semantics"]["definitions"].append(
        {
            "target": "property:stock:qty",
            "definition": "库存数量，不是可用数量",
            "aliases": ["账面库存"],
            "unit": "件",
            "grain": "来源库存记录",
            "confirmed": False,
        }
    )
    parsed = Draft.model_validate(value).model_dump()
    assert validate_draft(parsed, ROWS)["canPublish"]
    resolved = resolve_semantics(parsed, ["账面库存"])["items"][0]
    assert resolved["target"] == "property:stock:qty"
    assert resolved["definition"]["unit"] == "件"
    assert resolved["mappings"][0]["classId"] == "stock"
