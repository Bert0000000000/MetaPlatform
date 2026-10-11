import json
from copy import deepcopy
from datetime import date, datetime
from io import BytesIO

import pytest
from openpyxl import Workbook

from mate_tech_ont.modeling.core import (
    Draft,
    cell,
    compile_graph,
    convert,
    digest,
    group_rows,
    profile_rows,
    read_workbook,
    validate_draft,
)


def workbook_bytes(sheets):
    book = Workbook()
    book.remove(book.active)
    for name, records in sheets.items():
        sheet = book.create_sheet(name)
        for record in records:
            sheet.append(record)
    stream = BytesIO()
    book.save(stream)
    book.close()
    return stream.getvalue()


def test_workbook_preserves_headers_of_up_to_40_empty_sheets():
    content = workbook_bytes({f"表{i}": [["编码", "空列"]] for i in range(40)})
    rows, headers = read_workbook(content)
    assert rows == []
    assert headers == {f"表{i}": ["编码", "空列"] for i in range(40)}
    with pytest.raises(ValueError, match="40"):
        read_workbook(workbook_bytes({f"表{i}": [] for i in range(41)}))


ROWS = [
    {"sheet": "业务表", "row": 2, "values": {"编码": "P1", "名称": "吉他", "数量": 3}},
    {"sheet": "业务表", "row": 3, "values": {"编码": "P2", "名称": "钢琴", "数量": 5}},
]


def draft():
    return {
        "schemaVersion": 2,
        "name": "工厂",
        "classes": [
            {
                "id": "product",
                "name": "产品",
                "identity": ["code"],
                "labelProperty": "name",
                "properties": [
                    {"id": "code", "name": "编码", "dataType": "text"},
                    {"id": "name", "name": "名称", "dataType": "text"},
                ],
                "accepted": True,
            },
            {
                "id": "stock",
                "name": "库存记录",
                "identity": [],
                "labelProperty": "product",
                "properties": [
                    {"id": "product", "name": "产品", "dataType": "text"},
                    {"id": "qty", "name": "数量", "dataType": "number"},
                ],
                "accepted": True,
            },
        ],
        "mappings": [
            {
                "id": "products",
                "classId": "product",
                "sheet": "业务表",
                "bindings": {"code": "编码", "name": "名称"},
                "accepted": True,
            },
            {
                "id": "stocks",
                "classId": "stock",
                "sheet": "业务表",
                "bindings": {"product": "编码", "qty": "数量"},
                "accepted": True,
            },
        ],
        "relationships": [
            {
                "id": "stock_product",
                "name": "属于产品",
                "source": "stock",
                "target": "product",
                "joins": [{"sourceProperty": "product", "targetProperty": "code"}],
                "accepted": True,
            },
        ],
    }


def payload(node):
    return json.loads(node["payload"])


def test_one_sheet_maps_two_semantic_classes_with_stable_property_ids():
    value, rows = draft(), deepcopy(ROWS)
    before = deepcopy((value, rows))
    report = validate_draft(value, rows)
    assert report["errors"] == 0 and report["canPublish"]
    assert report["counts"] == {"nodes": 4, "edges": 2, "classes": 2}
    assert report["classCounts"] == {"product": 2, "stock": 2}
    assert report["relationships"] == [
        {"id": "stock_product", "matched": 2, "total": 2, "edges": 2, "matchRate": 1.0}
    ]
    nodes, edges = compile_graph(value, rows)
    product = next(n for n in nodes if n["objectType"] == "product")
    assert product["key"] == "entity:product:" + digest(["P1"])[:24]
    assert product["kind"] == "产品" and product["label"] == "吉他"
    assert json.loads(product["identity"]) == ["P1"]
    assert payload(product) == {
        "sheet": "业务表",
        "row": 2,
        "sourceValues": ROWS[0]["values"],
        "values": {"编码": "P1", "名称": "吉他"},
        "properties": {"code": "P1", "name": "吉他"},
        "sources": [ROWS[0]],
        "manual": False,
        "edited": False,
    }
    assert {n["key"] for n in nodes if n["objectType"] == "stock"} == {
        "entity:stock:row:stocks:2",
        "entity:stock:row:stocks:3",
    }
    assert all(e["relationId"] == "stock_product" for e in edges)
    assert report["warnings"] > 0  # Row-based identities are explicitly unstable.
    value["classes"][0]["properties"][0]["name"] = "业务编码"
    renamed, _ = compile_graph(value, rows)
    assert renamed[0]["key"] == product["key"]
    assert payload(renamed[0])["values"]["业务编码"] == "P1"
    value["classes"][0]["properties"][0]["name"] = "编码"
    assert (value, rows) == before


@pytest.mark.parametrize("mode", ["merge", "conflict", "resolved", "resolved_empty"])
def test_identity_merge_retains_sources_and_requires_explicit_conflict_resolution(mode):
    value, rows = draft(), deepcopy(ROWS)
    value["mappings"].append({**deepcopy(value["mappings"][0]), "id": "more", "sheet": "补充表"})
    rows.append(
        {
            "sheet": "补充表",
            "row": 90,
            "values": {"编码": "P1", "名称": "吉他" if mode == "merge" else "另一个名称"},
        }
    )
    # A second mapping of the same source must not duplicate provenance.
    value["mappings"].append({**deepcopy(value["mappings"][0]), "id": "duplicate_source"})
    key = "entity:product:" + digest(["P1"])[:24]
    if mode.startswith("resolved"):
        value["instanceEdits"] = [
            {"key": key, "values": {"name": None if mode == "resolved_empty" else "人工名称"}}
        ]
    report = validate_draft(value, rows)
    if mode == "conflict":
        assert report["errors"] > 0
        assert any("冲突" in i["message"] for i in report["issues"])
        with pytest.raises(ValueError):
            compile_graph(value, rows)
        return
    assert report["canPublish"]
    nodes, _ = compile_graph(value, rows)
    product = next(n for n in nodes if n["key"] == key)
    assert payload(product)["sources"] == [ROWS[0], rows[-1]]
    assert payload(product)["sourceValues"] == ROWS[0]["values"]
    assert payload(product)["edited"] == mode.startswith("resolved")
    assert product["label"] == {"merge": "吉他", "resolved": "人工名称", "resolved_empty": ""}[mode]
    moved = deepcopy(rows)
    moved[0]["row"] = 700
    assert key in {n["key"] for n in compile_graph(value, moved)[0]}
    assert report["counts"]["nodes"] == 4


def test_manual_instances_edits_and_exclusion_preserve_evidence_and_recompute_joins():
    value = draft()
    manual_key = "entity:product:manual:added"
    value["instances"] = [
        {
            "id": "added",
            "classId": "product",
            "values": {"code": "P3", "name": "手工原名"},
            "accepted": True,
        }
    ]
    value["instanceEdits"] = [
        {"key": manual_key, "values": {"name": "手工新名"}},
        {"key": "entity:stock:row:stocks:2", "values": {"product": "P3", "qty": "12.5"}},
        {"key": "entity:product:" + digest(["P2"])[:24], "excluded": True},
    ]
    report = validate_draft(value, ROWS)
    assert report["canPublish"]
    nodes, edges = compile_graph(value, ROWS)
    manual = next(n for n in nodes if n["key"] == manual_key)
    assert manual["sheet"] == "手工维护" and manual["row"] == 0
    assert manual["label"] == "手工新名"
    assert payload(manual)["manual"] and payload(manual)["edited"]
    assert payload(manual)["sources"] == []
    assert payload(manual)["sourceValues"] == {"code": "P3", "name": "手工原名"}
    stock = next(n for n in nodes if n["key"] == "entity:stock:row:stocks:2")
    assert payload(stock)["properties"]["qty"] == 12.5
    assert payload(stock)["sourceValues"] == ROWS[0]["values"]
    assert len(nodes) == 4 and len(edges) == 1
    assert edges[0]["target"] == manual_key
    assert report["relationships"][0]["matchRate"] == 0.5
    assert any("排除" in i["message"] for i in report["issues"])


@pytest.mark.parametrize(
    "key,values",
    [
        ("entity:product:" + digest(["P1"])[:24], {"code": "P3"}),
        ("entity:product:manual:added", {"code": "P3"}),
        ("entity:stock:row:stocks:999", {}),
        ("entity:stock:row:stocks:2", {"unknown": "x"}),
    ],
)
def test_invalid_instance_edits_block_even_preview(key, values):
    value = draft()
    value["instances"] = [
        {
            "id": "added",
            "classId": "product",
            "values": {"code": "P4", "name": "手工"},
            "accepted": True,
        }
    ]
    value["instanceEdits"] = [{"key": key, "values": values}]
    report = validate_draft(value, ROWS, require_review=False)
    assert report["errors"] and not report["canPublish"]
    if "code" in values:
        assert any("identity" in i["message"] for i in report["issues"])
    with pytest.raises(ValueError):
        compile_graph(value, ROWS, require_review=False)


@pytest.mark.parametrize("exclude_endpoint", [False, True])
def test_composite_joins_same_named_relations_and_link_edits(exclude_endpoint):
    value = draft()
    value["classes"][0]["properties"].append({"id": "qty", "name": "数量", "dataType": "number"})
    value["mappings"][0]["bindings"]["qty"] = "数量"
    value["relationships"][0]["joins"].append({"sourceProperty": "qty", "targetProperty": "qty"})
    value["relationships"].append({**deepcopy(value["relationships"][0]), "id": "also_product"})
    stock1, stock2 = "entity:stock:row:stocks:2", "entity:stock:row:stocks:3"
    p1, p2 = ("entity:product:" + digest([p])[:24] for p in ("P1", "P2"))
    nodes, edges = compile_graph(value, ROWS)
    assert len(edges) == 4
    assert {e["relationId"] for e in edges} == {"stock_product", "also_product"}
    value["instanceEdits"] = [{"key": stock2, "values": {"qty": 99}}]
    assert len(compile_graph(value, ROWS)[1]) == 2  # Both join fields must match.
    value["links"] = [
        {
            "id": "remove",
            "relationId": "stock_product",
            "source": stock1,
            "target": p1,
            "excluded": True,
        },
        {"id": "add", "relationId": "stock_product", "source": stock2, "target": p2},
        {"id": "same", "relationId": "also_product", "source": stock1, "target": p1},
    ]
    if exclude_endpoint:
        value["instanceEdits"].append({"key": p1, "excluded": True})
    report = validate_draft(value, ROWS)
    assert report["canPublish"]  # A deliberately deleted endpoint is not a dangling reference.
    nodes, edges = compile_graph(value, ROWS)
    expected = [
        {"source": stock2, "target": p2, "label": "属于产品", "relationId": "stock_product"}
    ]
    if not exclude_endpoint:
        expected.append(
            {"source": stock1, "target": p1, "label": "属于产品", "relationId": "also_product"}
        )
    assert sorted(edges, key=lambda e: e["relationId"]) == sorted(
        expected, key=lambda e: e["relationId"]
    )
    assert sum(m["edges"] for m in report["relationships"]) == len(edges)
    assert report["counts"]["edges"] == len(edges)
    assert report["relationships"][0]["matched"] == 1


def test_empty_table_metadata_survives_read_profile_and_validation():
    rows, headers = read_workbook(workbook_bytes({"业务表": [["编码", "名称", "数量"]]}))
    profile = profile_rows(rows, headers)
    assert profile["rowCount"] == 0 and profile["joinCandidates"] == []
    assert len(profile["sheets"]) == 1
    assert [c["name"] for c in profile["sheets"][0]["columns"]] == headers["业务表"]
    assert all(not c["unique"] and c["uniqueCount"] == 0 for c in profile["sheets"][0]["columns"])
    # A tuple also carries headers after API persistence/deserialization strips list metadata.
    for records in (rows, (list(rows), headers)):
        report = validate_draft(draft(), records)
        assert report["canPublish"] and report["warnings"] > 0
        assert report["counts"] == {"nodes": 0, "edges": 0, "classes": 2}
        assert compile_graph(draft(), records) == ([], [])
    value = draft()
    value["mappings"][0]["bindings"]["name"] = "不存在"
    assert validate_draft(value, rows)["errors"]


def test_profile_counts_null_columns_and_bounds_cross_sheet_join_candidates():
    rows = [
        {
            "sheet": "甲",
            "row": i + 2,
            "values": {"任意字段": str(i), "空": None, "日期": "2026-09-17", "数": i},
        }
        for i in range(5)
    ] + [
        {"sheet": f"乙{j}", "row": i + 2, "values": {"另一字段": str(i), "常量": "x"}}
        for j in range(12)
        for i in range(4)
    ]
    rows[0]["values"]["长文本"] = "长" * 200
    result = profile_rows(rows, {"甲": ["任意字段", "空", "日期", "数", "长文本"], "空表": ["空"]})
    first = {c["name"]: c for c in result["sheets"][0]["columns"]}
    assert first["空"]["nonNull"] == 0 and not first["空"]["unique"]
    assert first["任意字段"]["unique"] and first["任意字段"]["uniqueCount"] == 5
    assert first["日期"]["dataType"] == "date" and first["数"]["dataType"] == "number"
    assert first["长文本"]["samples"] == ["长" * 160]
    candidates = result["joinCandidates"]
    assert 1 <= len(candidates) <= 40
    assert {
        "sourceSheet": "甲",
        "sourceColumn": "任意字段",
        "targetSheet": "乙0",
        "targetColumn": "另一字段",
        "matched": 4,
        "total": 5,
        "matchRate": 0.8,
    } in candidates
    assert all(
        c["sourceSheet"] != c["targetSheet"] and c["total"] >= 2 and c["matchRate"] >= 0.8
        for c in candidates
    )
    assert not any(
        c["sourceColumn"] in ("空", "日期", "常量") or c["targetColumn"] in ("空", "日期", "常量")
        for c in candidates
    )


@pytest.mark.parametrize(
    "value,kind,expected",
    [
        (None, "number", None),
        ("  ", "number", None),
        (0, "number", 0),
        ("12.5", "number", 12.5),
        ("9007199254740993", "number", 9007199254740993),
        (date(2026, 9, 17), "date", "2026-09-17"),
        (datetime(2026, 9, 17, 13, 45), "date", "2026-09-17"),
        ("2026-09-17T13:45:00+08:00", "date", "2026-09-17"),
        (" 001 ", "text", "001"),
    ],
)
def test_conversion_preserves_nulls_numbers_dates_and_identifier_text(value, kind, expected):
    assert convert(value, kind) == expected


@pytest.mark.parametrize(
    "value,kind",
    [
        (True, "number"),
        ("NaN", "number"),
        ("Infinity", "number"),
        (float("inf"), "text"),
        (float("nan"), "date"),
        ("2026-02-30", "date"),
        ("2026-09-17garbage", "date"),
        ({"x": 1}, "text"),
        ("x", "executable"),
    ],
)
def test_conversion_rejects_nonfinite_or_invalid_values(value, kind):
    with pytest.raises((ValueError, TypeError)):
        convert(value, kind)


def test_typed_identity_is_stable_across_numeric_formats_and_blank_optional_properties():
    value = draft()
    value["classes"][0]["properties"][0]["dataType"] = "number"
    value["classes"][0]["properties"].append(
        {"id": "unused", "name": "空属性", "dataType": "number"}
    )
    value["relationships"] = []
    rows = deepcopy(ROWS)
    rows[0]["values"].update({"编码": "-0", "名称": ""})
    rows[1]["values"].update({"编码": 0, "名称": "零"})
    nodes, _ = compile_graph(value, rows)
    products = [n for n in nodes if n["objectType"] == "product"]
    assert len(products) == 1 and products[0]["label"] == "零"
    assert payload(products[0])["properties"]["unused"] is None
    assert len(payload(products[0])["sources"]) == 2


@pytest.mark.parametrize("section", ["classes", "mappings", "relationships", "instances"])
def test_unreviewed_configuration_can_preview_but_never_publish(section):
    value = draft()
    value["instances"] = [
        {
            "id": "manual",
            "classId": "product",
            "values": {"code": "P3", "name": "新增"},
            "accepted": True,
        }
    ]
    value[section][0].pop("accepted")
    preview = validate_draft(value, ROWS, require_review=False)
    assert preview["errors"] == 0 and preview["warnings"] > 0 and not preview["canPublish"]
    nodes, edges = compile_graph(value, ROWS, require_review=False)
    assert preview["counts"] == {"nodes": len(nodes), "edges": len(edges), "classes": 2}
    assert validate_draft(value, ROWS)["errors"]
    with pytest.raises(ValueError):
        compile_graph(value, ROWS)


@pytest.mark.parametrize(
    "section",
    [
        "draft",
        "classes",
        "properties",
        "mappings",
        "relationships",
        "joins",
        "instances",
        "instanceEdits",
        "links",
    ],
)
def test_unknown_fields_are_rejected_without_disclosing_input(section):
    value = draft()
    value["instances"] = [
        {"id": "manual", "classId": "product", "values": {"code": "P3"}, "accepted": True}
    ]
    value["instanceEdits"] = [{"key": "entity:stock:row:stocks:2"}]
    value["links"] = [{"id": "l", "relationId": "stock_product", "source": "x", "target": "y"}]
    target = (
        value
        if section == "draft"
        else value["classes"][0]["properties"][0]
        if section == "properties"
        else value["relationships"][0]["joins"][0]
        if section == "joins"
        else value[section][0]
    )
    target["externalPassword"] = "PRIVATE-CONFIG-MARKER"
    with pytest.raises(ValueError):
        Draft.model_validate(value)
    report = validate_draft(value, ROWS, require_review=False)
    assert report["errors"] and not report["canPublish"]
    assert "PRIVATE-CONFIG-MARKER" not in json.dumps(report)
    assert "externalPassword" not in json.dumps(report)
    with pytest.raises(ValueError) as exc:
        compile_graph(value, ROWS, require_review=False)
    assert "PRIVATE-CONFIG-MARKER" not in str(exc.value)


@pytest.mark.parametrize(
    "case",
    [
        "class_id",
        "property_id",
        "property_name",
        "identity_duplicate",
        "identity_ref",
        "label_ref",
        "mapping_id",
        "mapping_class",
        "mapping_sheet",
        "mapping_column",
        "mapping_property",
        "mapping_identity",
        "mapping_label",
        "relation_id",
        "relation_class",
        "join_property",
        "join_duplicate",
        "manual_id",
        "manual_class",
        "manual_property",
        "manual_identity",
        "edit_duplicate",
        "edit_dangling",
        "link_id",
        "link_duplicate",
        "link_relation",
        "link_endpoint",
        "link_class",
        "empty_identity",
        "bad_type",
    ],
)
def test_semantic_validation_blocks_duplicate_and_dangling_references(case):
    value, rows = draft(), deepcopy(ROWS)
    value["instances"] = [
        {"id": "manual", "classId": "product", "values": {"code": "P3"}, "accepted": True}
    ]
    value["instanceEdits"] = [{"key": "entity:stock:row:stocks:2"}]
    value["links"] = [
        {
            "id": "link",
            "relationId": "stock_product",
            "source": "entity:stock:row:stocks:2",
            "target": "entity:product:" + digest(["P1"])[:24],
        }
    ]
    cls, mapping, relation = value["classes"][0], value["mappings"][0], value["relationships"][0]
    if case == "class_id":
        value["classes"].append(deepcopy(cls))
    elif case == "property_id":
        cls["properties"].append(deepcopy(cls["properties"][0]))
    elif case == "property_name":
        cls["properties"][1]["name"] = cls["properties"][0]["name"]
    elif case == "identity_duplicate":
        cls["identity"] *= 2
    elif case == "identity_ref":
        cls["identity"] = ["missing"]
    elif case == "label_ref":
        cls["labelProperty"] = "missing"
    elif case == "mapping_id":
        value["mappings"].append(deepcopy(mapping))
    elif case == "mapping_class":
        mapping["classId"] = "missing"
    elif case == "mapping_sheet":
        mapping["sheet"] = "missing"
    elif case == "mapping_column":
        mapping["bindings"]["code"] = "missing"
    elif case == "mapping_property":
        mapping["bindings"]["missing"] = "编码"
    elif case == "mapping_identity":
        mapping["bindings"].pop("code")
    elif case == "mapping_label":
        mapping["bindings"].pop("name")
    elif case == "relation_id":
        value["relationships"].append(deepcopy(relation))
    elif case == "relation_class":
        relation["source"] = "missing"
    elif case == "join_property":
        relation["joins"][0]["targetProperty"] = "missing"
    elif case == "join_duplicate":
        relation["joins"] *= 2
    elif case == "manual_id":
        value["instances"] *= 2
    elif case == "manual_class":
        value["instances"][0]["classId"] = "missing"
    elif case == "manual_property":
        value["instances"][0]["values"]["missing"] = "x"
    elif case == "manual_identity":
        value["instances"][0]["values"] = {}
    elif case == "edit_duplicate":
        value["instanceEdits"] *= 2
    elif case == "edit_dangling":
        value["instanceEdits"][0]["key"] = "missing"
    elif case == "link_id":
        value["links"] *= 2
    elif case == "link_duplicate":
        value["links"].append({**value["links"][0], "id": "other"})
    elif case == "link_relation":
        value["links"][0]["relationId"] = "missing"
    elif case == "link_endpoint":
        value["links"][0]["target"] = "missing"
    elif case == "link_class":
        value["links"][0]["target"] = "entity:stock:row:stocks:3"
    elif case == "empty_identity":
        rows[0]["values"]["编码"] = " "
    elif case == "bad_type":
        rows[0]["values"]["数量"] = "PRIVATE-CONFIG-MARKER"
    report = validate_draft(value, rows, require_review=False)
    assert report["errors"] and not report["canPublish"], case
    assert "PRIVATE-CONFIG-MARKER" not in json.dumps(report)
    with pytest.raises(ValueError):
        compile_graph(value, rows, require_review=False)


@pytest.mark.parametrize(
    "case",
    [
        "version",
        "unicode_slug",
        "long_slug",
        "leading_digit",
        "class_limit",
        "property_limit",
        "property_empty",
        "class_empty",
        "identity_limit",
        "mapping_limit",
        "relation_limit",
        "join_empty",
        "join_limit",
        "manual_limit",
        "edit_limit",
        "link_limit",
        "notes_limit",
        "primitive",
        "boolean_review",
        "nan",
    ],
)
def test_schema_cardinality_and_types(case):
    value = draft()
    if case == "version":
        value["schemaVersion"] = 1
    elif case == "unicode_slug":
        value["classes"][0]["id"] = "产品"
    elif case == "long_slug":
        value["classes"][0]["id"] = "x" * 41
    elif case == "leading_digit":
        value["classes"][0]["id"] = "1abc"
    elif case == "class_limit":
        value["classes"] = [value["classes"][0]] * 31
    elif case == "property_limit":
        value["classes"][0]["properties"] *= 21
    elif case == "property_empty":
        value["classes"][0]["properties"] = []
    elif case == "class_empty":
        value["classes"] = []
    elif case == "identity_limit":
        value["classes"][0]["identity"] *= 5
    elif case == "mapping_limit":
        value["mappings"] = [value["mappings"][0]] * 61
    elif case == "relation_limit":
        value["relationships"] *= 61
    elif case == "join_empty":
        value["relationships"][0]["joins"] = []
    elif case == "join_limit":
        value["relationships"][0]["joins"] *= 5
    elif case == "manual_limit":
        value["instances"] = [{"id": "m", "classId": "product", "values": {}}] * 501
    elif case == "edit_limit":
        value["instanceEdits"] = [{"key": "x"}] * 1001
    elif case == "link_limit":
        value["links"] = [{"id": "l", "relationId": "r", "source": "x", "target": "y"}] * 1001
    elif case == "notes_limit":
        value["notes"] = ["x"] * 31
    elif case == "primitive":
        value["instances"] = [{"id": "m", "classId": "product", "values": {"code": []}}]
    elif case == "boolean_review":
        value["classes"][0]["accepted"] = "true"
    elif case == "nan":
        value["instanceEdits"] = [{"key": "x", "values": {"qty": float("nan")}}]
    if case == "join_empty":
        assert Draft.model_validate(value).relationships[0].joins == []
    else:
        with pytest.raises(ValueError):
            Draft.model_validate(value)
    assert validate_draft(value, ROWS)["errors"]


@pytest.mark.parametrize(
    "rows",
    [
        None,
        {},
        [{"sheet": "x"}],
        [ROWS[0], ROWS[0]],
        [{"sheet": "x", "row": 2, "values": {"x": float("inf")}}],
        [{"sheet": "x", "row": 2, "values": {"x": {"secret": "PRIVATE"}}}],
    ],
)
def test_invalid_rows_return_safe_reports_instead_of_server_errors(rows):
    report = validate_draft(draft(), rows)
    assert report["errors"] and "PRIVATE" not in json.dumps(report)
    with pytest.raises(ValueError):
        compile_graph(draft(), rows)


@pytest.mark.parametrize(
    "records",
    [
        [["编码", " 编码 "]],
        [["编码", None], ["P1", 0]],
        [["编码"], ["=1+1"]],
        [["=1+1"], ["P1"]],
        [[str(i) for i in range(61)]],
    ],
)
def test_workbook_rejects_unsafe_headers_formulas_and_column_overflow(records):
    with pytest.raises(ValueError):
        read_workbook(workbook_bytes({"表": records}))


def test_workbook_rejects_invalid_archives_and_zip_expansion():
    from zipfile import ZIP_DEFLATED, ZipFile

    with pytest.raises(ValueError):
        read_workbook(b"not an xlsx")
    stream = BytesIO()
    with ZipFile(stream, "w", ZIP_DEFLATED) as archive:
        with archive.open("oversize", "w") as member:
            for _ in range(81):
                member.write(b"0" * (1024 * 1024))
    with pytest.raises(ValueError):
        read_workbook(stream.getvalue())


def test_workbook_effective_record_limit_and_date_evidence():
    data = [["编码", "日期", "空"]] + [[str(i), date(2026, 9, 17), None] for i in range(30000)]
    rows, headers = read_workbook(workbook_bytes({"表": data}))
    assert len(rows) == 30000 and rows[-1]["row"] == 30001
    assert rows[0]["values"]["日期"].startswith("2026-09-17")
    assert headers == {"表": ["编码", "日期", "空"]}
    with pytest.raises(ValueError):
        read_workbook(workbook_bytes({"表": data, "其他表": [["编码"], ["overflow"]]}))


def test_graph_edge_limit_is_checked_before_cartesian_materialization():
    value = draft()
    value["classes"][0]["identity"] = []
    rows = [
        {"sheet": "业务表", "row": i + 2, "values": {"编码": "same", "名称": "x", "数量": 1}}
        for i in range(12000)
    ]
    report = validate_draft(value, rows, require_review=False)
    assert report["errors"] and any("100000" in i["message"] for i in report["issues"])
    assert report["counts"]["edges"] == 0
    with pytest.raises(ValueError):
        compile_graph(value, rows, require_review=False)


def test_exact_edge_limit_allows_deletion_but_rejects_manual_overflow():
    value = draft()
    value["classes"][0]["identity"] = []
    value["mappings"][0]["sheet"] = "产品表"
    value["mappings"][1]["sheet"] = "库存表"
    rows = [
        {"sheet": "产品表", "row": i + 2, "values": {"编码": "same", "名称": "x"}}
        for i in range(1000)
    ]
    rows += [
        {"sheet": "库存表", "row": i + 2, "values": {"编码": "same", "数量": 1}} for i in range(100)
    ]
    report = validate_draft(value, rows)
    assert report["canPublish"] and report["counts"]["edges"] == 100000
    value["instances"] = [
        {"id": "m", "classId": "product", "values": {"code": "other"}, "accepted": True}
    ]
    value["links"] = [
        {
            "id": "extra",
            "relationId": "stock_product",
            "source": "entity:stock:row:stocks:2",
            "target": "entity:product:manual:m",
        }
    ]
    assert validate_draft(value, rows)["errors"]
    value["links"].append(
        {
            "id": "remove",
            "relationId": "stock_product",
            "source": "entity:stock:row:stocks:2",
            "target": "entity:product:row:products:2",
            "excluded": True,
        }
    )
    assert validate_draft(value, rows)["counts"]["edges"] == 100000


def test_node_limit_includes_mappings_and_manual_instances():
    value = draft()
    value["relationships"] = []
    rows = [
        {"sheet": "业务表", "row": i + 2, "values": {"编码": str(i), "名称": "x", "数量": 1}}
        for i in range(30000)
    ]
    report = validate_draft(value, rows)
    assert report["canPublish"] and report["counts"]["nodes"] == 60000
    value["instances"] = [
        {"id": "overflow", "classId": "product", "values": {"code": "new"}, "accepted": True}
    ]
    report = validate_draft(value, rows)
    assert report["errors"] and any("60000" in i["message"] for i in report["issues"])


def test_report_issue_list_is_bounded_and_hash_uses_normalized_configuration():
    value = draft()
    rows = [
        {
            "sheet": "业务表",
            "row": i + 2,
            "values": {"编码": str(i), "名称": "x", "数量": "invalid"},
        }
        for i in range(300)
    ]
    report = validate_draft(value, rows)
    assert report["errors"] == 300 and len(report["issues"]) == 200
    assert report["configHash"] == digest(Draft.model_validate(value).model_dump())
    assert validate_draft(Draft.model_validate(value), ROWS)["configHash"] == report["configHash"]
    assert group_rows(ROWS)["业务表"] == ROWS and cell(3.0) == "3"


def test_workbook_does_not_trust_underreported_dimensions_or_expose_parser_errors():
    from zipfile import ZipFile

    original = workbook_bytes({"表": [["编码", "名称"], ["P1", "吉他"]]})
    for malformed in (False, True):
        stream = BytesIO()
        with ZipFile(BytesIO(original)) as source, ZipFile(stream, "w") as target:
            for entry in source.infolist():
                content = source.read(entry.filename)
                if entry.filename == "xl/worksheets/sheet1.xml":
                    content = b"<" if malformed else content.replace(b"A1:B2", b"A1:A1")
                target.writestr(entry, content)
        if malformed:
            with pytest.raises(ValueError):
                read_workbook(stream.getvalue())
        else:
            rows, headers = read_workbook(stream.getvalue())
            assert rows == [{"sheet": "表", "row": 2, "values": {"编码": "P1", "名称": "吉他"}}]
            assert headers == {"表": ["编码", "名称"]}


def hierarchy_draft():
    return {
        "schemaVersion": 2,
        "name": "Equipment taxonomy",
        "classes": [
            {
                "id": "equipment",
                "name": "设备",
                "properties": [{"id": "code", "name": "设备编码", "dataType": "text"}],
                "identity": ["code"],
                "labelProperty": "code",
                "accepted": True,
            },
            {
                "id": "machine_tool",
                "name": "机床",
                "parentClassId": "equipment",
                "inheritanceReason": "业务分类目录规定机床是一种设备，继承设备身份",
                "properties": [{"id": "code", "name": "设备编码", "dataType": "text"}],
                "identity": ["code"],
                "labelProperty": "code",
                "accepted": True,
            },
            {
                "id": "cnc_machine_tool",
                "name": "数控机床",
                "parentClassId": "machine_tool",
                "inheritanceReason": "业务分类目录规定数控机床是一种机床，所有数控机床都是机床",
                "properties": [{"id": "code", "name": "设备编码", "dataType": "text"}],
                "identity": ["code"],
                "labelProperty": "code",
                "accepted": True,
            },
        ],
        "mappings": [],
        "relationships": [],
    }


def test_three_level_subclass_hierarchy_is_preserved_and_valid():
    value = hierarchy_draft()
    parsed = Draft.model_validate(value).model_dump()
    assert parsed["classes"][0]["parentClassId"] is None
    assert parsed["classes"][2]["parentClassId"] == "machine_tool"
    assert validate_draft(value, [])["errors"] == 0


@pytest.mark.parametrize(
    "parent,reason",
    [("missing", "is a missing type"), ("machine_tool", "is itself"), ("equipment", "")],
)
def test_invalid_or_unsupported_inheritance_is_blocked(parent, reason):
    value = hierarchy_draft()
    value["classes"][1].update(parentClassId=parent, inheritanceReason=reason)
    report = validate_draft(value, [], require_review=False)
    assert report["errors"] > 0
    assert any(
        "父类" in issue["message"] or "继承" in issue["message"] for issue in report["issues"]
    )


def test_subclass_cycle_is_rejected():
    value = hierarchy_draft()
    value["classes"][0].update(
        parentClassId="cnc_machine_tool", inheritanceReason="incorrect circular taxonomy"
    )
    report = validate_draft(value, [])
    assert report["errors"] > 0
    assert any("循环" in issue["message"] for issue in report["issues"])


@pytest.mark.parametrize("change", ["missing_property", "property_type", "identity"])
def test_subclass_must_explicitly_preserve_parent_properties_and_identity(change):
    value = hierarchy_draft()
    child = value["classes"][1]
    if change == "missing_property":
        child.update(
            properties=[{"id": "other", "name": "其他编码", "dataType": "text"}],
            identity=["other"],
            labelProperty="other",
        )
    elif change == "property_type":
        child["properties"][0]["dataType"] = "number"
    else:
        child["identity"] = []
    report = validate_draft(value, [], require_review=False)
    assert report["errors"] > 0
    assert any("父类" in issue["message"] for issue in report["issues"])


def test_same_business_entity_cannot_be_materialized_at_parent_and_child_levels():
    value = hierarchy_draft()
    value["mappings"] = [
        {
            "id": cid + "_mapping",
            "classId": cid,
            "sheet": "CNC",
            "bindings": {"code": "设备编码"},
            "accepted": True,
        }
        for cid in ("equipment", "cnc_machine_tool")
    ]
    rows = [{"sheet": "CNC", "row": 2, "values": {"设备编码": "CNC01"}}]
    report = validate_draft(value, rows)
    assert report["errors"] > 0
    assert any("最具体" in issue["message"] for issue in report["issues"])


def test_only_most_specific_class_creates_instance_in_hierarchy():
    value = hierarchy_draft()
    value["mappings"] = [
        {
            "id": "cnc_mapping",
            "classId": "cnc_machine_tool",
            "sheet": "CNC",
            "bindings": {"code": "设备编码"},
            "accepted": True,
        }
    ]
    rows = [{"sheet": "CNC", "row": 2, "values": {"设备编码": "CNC01"}}]
    nodes, edges = compile_graph(value, rows)
    assert len(nodes) == 1 and nodes[0]["objectType"] == "cnc_machine_tool"
