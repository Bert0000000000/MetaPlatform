"""Verify only dedicated synthetic Excel records through the deployed HTTP API."""

from __future__ import annotations

import io
from urllib.parse import urlencode
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

PREFIX = "/api/v1/ont/v2"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def workbook():
    """Small OpenXML workbook; the server's existing Excel parser consumes it."""
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    rows = [["Code", "Name"], ["A", "First"], ["B", "Second"]]
    sheet = "".join(
        f'<row r="{number}">'
        + "".join(
            f'<c r="{column}{number}" t="inlineStr"><is><t>{value}</t></is></c>'
            for column, value in zip(("A", "B"), values, strict=True)
        )
        + "</row>"
        for number, values in enumerate(rows, 1)
    )
    files = {
        "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>",
        "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'<Relationship Id="rId1" Type="{rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets>'
        '<sheet name="Items" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'<Relationship Id="rId1" Type="{rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": f'<worksheet xmlns="{ns}"><sheetData>{sheet}</sheetData></worksheet>',
    }
    output = io.BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return output.getvalue()


def readback(call, receipt):
    source = call("GET", PREFIX + "/modeling/sources/" + receipt["source_id"])
    require(
        source.get("sync", {}).get("status") == "succeeded",
        "Excel sync terminal state not persisted",
    )
    identities, endpoints = [], {}
    for item in receipt["types"]:
        rows = call("GET", PREFIX + "/individuals?" + urlencode({"class_rid": item["rid"]}))
        require(len(rows) == len(item["values"]), "Excel individual count mismatch")
        for expected in item["values"]:
            matches = [
                row
                for row in rows
                if all(
                    row.get("props", {}).get(item["propertyMap"][key]) == value
                    for key, value in expected.items()
                )
            ]
            require(len(matches) == 1, "Excel individual field readback mismatch")
            identities.append(matches[0]["rid"])
            endpoints[(item["role"], expected["name"])] = matches[0]["rid"]
    links = call(
        "GET", PREFIX + "/link-instances?" + urlencode({"link_type_rid": receipt["link_type"]})
    )
    require(len(links) == 2, "Excel relationship count mismatch")
    expected_pairs = {
        (endpoints[("item", name)], endpoints[("label", name)]) for name in ("First", "Second")
    }
    require(
        {(link["src"], link["dst"]) for link in links} == expected_pairs,
        "Excel relationship endpoint readback mismatch",
    )
    return {"individuals": sorted(identities), "links": sorted(link["rid"] for link in links)}


def verify(call, receipt):
    """Create and retry a synthetic batch, or read its prior receipt without writes."""
    if receipt is not None:
        require(
            readback(call, receipt) == receipt["identities"], "Excel persisted identities changed"
        )
        return receipt
    stamp = "excel_probe_" + uuid4().hex[:12]
    item_id, label_id = stamp + "_item", stamp + "_label"
    boundary = "----" + stamp
    upload = (
        (
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{stamp}.xlsx"\r\n'
            "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n"
        ).encode()
        + workbook()
        + f"\r\n--{boundary}--\r\n".encode()
    )
    source = call(
        "POST",
        PREFIX + "/modeling/sources",
        upload,
        headers={"Content-Type": "multipart/form-data; boundary=" + boundary},
    )
    path = PREFIX + "/modeling/sources/" + source["id"]
    draft = {
        "schemaVersion": 2,
        "name": stamp,
        "classes": [
            {
                "id": item_id,
                "name": "Excel item " + stamp,
                "properties": [
                    {"id": "code", "name": "Item code " + stamp, "dataType": "text"},
                    {"id": "name", "name": "Item name " + stamp, "dataType": "text"},
                ],
                "identity": ["code"],
                "labelProperty": "name",
                "accepted": True,
            },
            {
                "id": label_id,
                "name": "Excel label " + stamp,
                "properties": [{"id": "name", "name": "Label name " + stamp, "dataType": "text"}],
                "identity": ["name"],
                "labelProperty": "name",
                "accepted": True,
            },
        ],
        "mappings": [
            {
                "id": "items",
                "classId": item_id,
                "sheet": "Items",
                "bindings": {"code": "Code", "name": "Name"},
                "accepted": True,
            },
            {
                "id": "labels",
                "classId": label_id,
                "sheet": "Items",
                "bindings": {"name": "Name"},
                "accepted": True,
            },
        ],
        "relationships": [
            {
                "id": stamp + "_links",
                "name": "Excel labels " + stamp,
                "source": item_id,
                "target": label_id,
                "joins": [{"sourceProperty": "name", "targetProperty": "name"}],
                "cardinality": "1:1",
                "accepted": True,
            }
        ],
    }
    source = call(
        "PUT",
        path,
        {
            "revision": source["revision"],
            "draft": draft,
            "resolutions": {cid: {"mode": "new", "propertyMap": {}} for cid in (item_id, label_id)},
        },
    )
    source = call(
        "POST", path + "/validate", {"revision": source["revision"], "preparePublication": True}
    )
    require(
        source.get("validation", {}).get("canPublish"), "Synthetic Excel model validation failed"
    )
    source = call(
        "POST",
        path + "/publish",
        {
            "revision": source["revision"],
            "configHash": source["plan"]["configHash"],
            "acknowledgeWarnings": True,
        },
    )
    require(
        source.get("publication", {}).get("status") == "succeeded",
        "Synthetic Excel publication failed",
    )
    checked = call("POST", path + "/sync-check", {"revision": source["revision"]})
    check = checked.get("syncCheck", {})
    require(
        check.get("canSync"),
        "Excel sync-check blocked: " + str(check.get("baselineError") or "data validation"),
    )
    plan = source["plan"]
    values = {
        item_id: [{"code": "A", "name": "First"}, {"code": "B", "name": "Second"}],
        label_id: [{"name": "First"}, {"name": "Second"}],
    }
    receipt = {
        "source_id": source["id"],
        "link_type": plan["relationships"][0]["rid"],
        "types": [
            {
                "rid": item["rid"],
                "propertyMap": item["propertyMap"],
                "role": "item" if item["classId"] == item_id else "label",
                "values": values[item["classId"]],
            }
            for item in plan["types"]
        ],
    }
    for attempt in range(2):
        result = call("POST", path + "/sync", {"revision": source["revision"], "background": False})
        require(result.get("sync", {}).get("status") == "succeeded", "Synthetic Excel sync failed")
        actual = readback(call, receipt)
        if attempt == 0:
            receipt["identities"] = actual
        else:
            require(
                actual == receipt["identities"], "Repeat Excel sync changed persisted identities"
            )
    return receipt
