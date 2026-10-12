import pytest

from mate_tech_ont.modeling.core import validate_draft, validate_ontology


def candidate():
    def cls(cid, identity):
        return {
            "id": cid,
            "name": cid,
            "properties": [
                {"id": p, "name": p, "dataType": "text"} for p in ("order", "line", "code")
            ],
            "identity": identity,
            "labelProperty": "code",
            "accepted": True,
        }

    return {
        "name": "review",
        "classes": [cls("shipment", ["code"]), cls("purchase", ["order", "line"])],
        "mappings": [],
        "relationships": [
            {
                "id": "purchase_link",
                "name": "采购明细",
                "source": "shipment",
                "target": "purchase",
                "joins": [{"sourceProperty": "line", "targetProperty": "line"}],
                "reason": "发运行引用订单明细",
                "accepted": True,
                "cardinality": "N:1",
                "cardinalityStatus": "confirmed",
                "cardinalityReason": "每次发运明细属于一条采购明细",
                "targetSelection": "entity",
            }
        ],
    }


def messages(report):
    return " ".join(i["message"] for i in report["issues"])


def test_partial_composite_key_cannot_publish_an_entity_relationship():
    report = validate_ontology(candidate())
    assert not report["canPublish"]
    assert "完整" in messages(report) and "唯一键" in messages(report)


def test_missing_joins_are_actionable_even_if_marked_accepted():
    value = candidate()
    value["relationships"][0]["joins"] = []
    report = validate_ontology(value)
    assert not report["canPublish"]
    assert "引用来源列仅为证据" in messages(report)


def test_incomplete_relation_can_be_saved_and_deferred_without_blocking_other_types():
    from mate_tech_ont.modeling.core import Draft

    value = candidate()
    value["relationships"][0].update(joins=[{"sourceProperty": "", "targetProperty": ""}])
    assert Draft.model_validate(value).relationships[0].joins[0].targetProperty == ""
    assert not validate_ontology(value)["canPublish"]
    value["relationships"][0]["included"] = False
    assert validate_ontology(value)["canPublish"]


@pytest.mark.asyncio
async def test_generation_preflight_retains_incomplete_relation_without_approval(monkeypatch):
    from mate_tech_ont.modeling import assistant_client

    value = candidate()
    value["relationships"][0]["joins"] = []

    async def provider(*args, **kwargs):
        return {"draft": value}

    monkeypatch.setattr(assistant_client, "_post", provider)
    generated = await assistant_client.generate(
        {"sheets": []}, "", [], [], "Bearer test", "tenant-default"
    )
    relation = generated["relationships"][0]
    assert relation["included"] is True and relation["accepted"] is False
    assert relation["cardinalityStatus"] == "proposed"
    assert relation["joins"] == []
    assert any("待完善" in note and "关联字段映射" in note for note in generated["notes"])


def test_complete_key_or_confirmed_alternative_key_can_identify_target():
    value = candidate()
    value["relationships"][0]["joins"].append(
        {"sourceProperty": "order", "targetProperty": "order"}
    )
    assert validate_ontology(value)["canPublish"]
    value["relationships"][0]["joins"] = [{"sourceProperty": "code", "targetProperty": "code"}]
    value["classes"][1]["uniqueKeys"] = [
        {"properties": ["code"], "reason": "业务字典定义全局唯一编码", "confirmed": True}
    ]
    assert validate_ontology(value)["canPublish"]
    value["classes"][1]["uniqueKeys"][0]["confirmed"] = False
    assert not validate_ontology(value)["canPublish"]


def test_unknown_cardinality_is_editable_but_requires_a_decision_before_publication():
    value = candidate()
    value["relationships"][0].update(cardinalityStatus="unresolved", targetSelection="group")
    report = validate_ontology(value)
    assert not report["canPublish"] and "基数" in messages(report)


def test_confirmed_business_identity_survives_missing_source_values():
    value = candidate()
    value["relationships"] = []
    value["classes"][0].update(
        identityStatus="confirmed", identityReason="业务编号", grain="一条发运明细"
    )
    value["mappings"] = [
        {
            "id": "rows",
            "classId": "shipment",
            "sheet": "Rows",
            "bindings": {"code": "编号"},
            "accepted": True,
        }
    ]
    assert validate_ontology(value)["canPublish"]
    assert not validate_draft(value, [{"sheet": "Rows", "row": 2, "values": {"编号": None}}])[
        "canPublish"
    ]


def test_alternative_unique_key_is_checked_on_full_data_before_sync():
    value = candidate()
    value["relationships"] = []
    value["classes"] = value["classes"][:1]
    value["classes"][0]["uniqueKeys"] = [
        {"properties": ["line"], "reason": "唯一行编码", "confirmed": True}
    ]
    value["mappings"] = [
        {
            "id": "rows",
            "classId": "shipment",
            "sheet": "Rows",
            "bindings": {"code": "编号", "line": "行号"},
            "accepted": True,
        }
    ]
    rows = [
        {"sheet": "Rows", "row": i + 2, "values": {"编号": str(i), "行号": "same"}}
        for i in range(2)
    ]
    report = validate_draft(value, rows)
    assert not report["canPublish"] and "唯一键" in messages(report)


@pytest.mark.parametrize("cardinality", ["N:1", "1:1"])
def test_group_selection_cannot_claim_one_target(cardinality):
    value = candidate()
    value["relationships"][0].update(targetSelection="group", cardinality=cardinality)
    assert "集合" in messages(validate_ontology(value))


def test_legacy_candidates_remain_readable_without_claiming_business_approval():
    value = candidate()
    for key in ("cardinality", "cardinalityStatus", "cardinalityReason", "targetSelection"):
        value["relationships"][0].pop(key)
    assert validate_ontology(value)["canPublish"]


def test_confirmed_identity_cannot_be_empty_and_record_strategy_cannot_have_business_key():
    value = candidate()
    value["relationships"] = []
    value["classes"][0].update(identity=[], identityStatus="confirmed", identityReason="编号规则")
    assert not validate_ontology(value)["canPublish"]
    value["classes"][0].update(identity=["code"], identityStatus="source-record")
    assert not validate_ontology(value)["canPublish"]


def test_declared_cardinality_is_checked_against_compiled_edges():
    value = candidate()
    value["classes"][1]["identity"] = ["code"]
    value["relationships"][0].update(cardinality="1:N", targetSelection="group")
    value["mappings"] = [
        {
            "id": cid,
            "classId": cid,
            "sheet": sheet,
            "bindings": {"code": "Code", "line": "Line"},
            "accepted": True,
        }
        for cid, sheet in [("shipment", "Ship"), ("purchase", "Buy")]
    ]
    rows = [
        {"sheet": "Ship", "row": i + 2, "values": {"Code": f"S{i}", "Line": "L"}} for i in range(2)
    ]
    rows += [{"sheet": "Buy", "row": 2, "values": {"Code": "B", "Line": "L"}}]
    report = validate_draft(value, rows)
    assert not report["canPublish"] and "基数" in messages(report)


def test_source_evidence_must_reference_real_columns_but_inference_is_explicit():
    from mate_tech_ont.modeling.rules import validate_evidence

    value = candidate()
    profile = {"sheets": [{"name": "Rows", "columns": [{"name": "编号"}]}]}
    value["classes"][0]["evidence"] = [
        {"kind": "source", "detail": "来源字段", "sheet": "Rows", "columns": ["不存在"]}
    ]
    assert validate_evidence(value, profile)[0]["severity"] == "error"
    value["classes"][0]["evidence"][0]["columns"] = ["编号"]
    assert not validate_evidence(value, profile)
    value["classes"][0]["evidence"] = [{"kind": "inference", "detail": "待业务确认"}]
    assert not validate_evidence(value, profile)


def test_conflicting_rows_identify_source_locations_and_grain_without_guessing():
    value = candidate()
    value["relationships"] = []
    value["classes"][0]["grain"] = "一次发运明细"
    value["mappings"] = [
        {
            "id": "rows",
            "classId": "shipment",
            "sheet": "Rows",
            "bindings": {"code": "编号", "line": "数量"},
            "accepted": True,
        }
    ]
    rows = [
        {"sheet": "Rows", "row": i + 2, "values": {"编号": "S1", "数量": str(i)}} for i in range(2)
    ]
    report = validate_draft(value, rows)
    assert not report["canPublish"]
    assert all(text in messages(report) for text in ["Rows:2", "Rows:3", "一次发运明细", "粒度"])
