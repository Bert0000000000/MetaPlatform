"""Read-only native comparisons and acceptance evidence for the reverse workspace."""

from .store import now


def compare_type(cls, target, resolution):
    mapped = resolution.get("propertyMap", {})
    native_props = {p["rid"]: p for p in target["properties"]}
    properties = []
    for prop in cls["properties"]:
        selected = native_props.get(mapped.get(prop["id"]))
        expected = {"text": "string", "number": "double", "date": "date"}[prop["dataType"]]
        properties.append({
            "id": prop["id"], "name": prop["name"], "candidateType": expected,
            "targetRid": (selected or {}).get("rid", ""),
            "targetType": (selected or {}).get("type_id", ""),
            "status": "unmapped" if not selected else "compatible" if selected["type_id"] == expected else "incompatible",
        })
    desired_key = [mapped.get(p, "") for p in cls["identity"]]
    return {
        "classId": cls["id"], "targetRid": target["rid"], "requiresDecision": True,
        "candidateDefinition": cls.get("description", ""), "targetDefinition": target.get("description", ""),
        "candidateGrain": cls.get("grain", ""), "candidateIdentity": cls["identity"],
        "targetIdentity": target["primary_key"], "identityMatches": bool(desired_key) and desired_key == target["primary_key"],
        "candidateParent": cls.get("parentClassId"), "targetParent": target.get("parent_class", ""),
        "properties": properties,
        "unmappedNativeProperties": [p for p in native_props if p not in mapped.values()],
        "note": "名称或字段相似不证明概念相同；请核对粒度、编号作用域和继承。此比较不会合并或修改类型。",
    }


async def verify_plan(request, source):
    from .publication import current_link, current_type

    plan = source.get("plan") or {}
    published = (source.get("publication") or {}).get("status") in {"succeeded", "completed"}
    types, relationships = [], []
    for item in plan.get("types", []):
        live = await current_type(request, item["rid"])
        status = "missing" if not live else "matched" if live.get("checksum") == item["expectedChecksum"] else "changed"
        types.append({"classId": item["classId"], "name": item["name"], "rid": item["rid"], "status": status,
                      "expectedChecksum": item["expectedChecksum"], "actualChecksum": (live or {}).get("checksum", "")})
    for item in plan.get("relationships", []):
        live = await current_link(request, item["rid"])
        relationships.append({"relationId": item["relationId"], "rid": item["rid"],
                              "status": "missing" if not live else "matched" if live == item["payload"] else "changed",
                              "expectedCardinality": item["payload"]["cardinality"],
                              "actualCardinality": (live or {}).get("cardinality", "")})
    drifted = sum(item["status"] != "matched" for item in types + relationships)
    return {"status": "not_published" if not published else "drifted" if drifted else "passed",
            "sourceRevision": source["revision"], "checkedAt": now(), "types": types, "relationships": relationships,
            "counts": {"types": len(types), "relationships": len(relationships), "drifted": drifted},
            "limitations": ["核验原生定义与审核方案一致性，不证明业务语义已经正确。",
                            "替代唯一键和来源关联规则由逆向接入校验执行，不增加平台全局约束能力。"]}
