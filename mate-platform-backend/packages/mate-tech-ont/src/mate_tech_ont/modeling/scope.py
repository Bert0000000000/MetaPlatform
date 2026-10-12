"""A non-mutating publication scope shared by validation, planning and sync."""

from copy import deepcopy


def publication_scope(draft):
    result = deepcopy(draft)
    result["classes"] = [c for c in result["classes"] if c.get("included", True)]
    result["relationships"] = [r for r in result["relationships"] if r.get("included", True)]
    classes = {c["id"] for c in result["classes"]}
    relations = {r["id"] for r in result["relationships"]}
    deferred_classes = {c["id"] for c in draft["classes"]} - classes
    deferred_relations = {r["id"] for r in draft["relationships"]} - relations
    deferred_properties = {
        (cls["id"], prop["id"])
        for cls in result["classes"]
        for prop in cls["properties"]
        if not prop.get("included", True)
    }
    for cls in result["classes"]:
        cls["properties"] = [p for p in cls["properties"] if p.get("included", True)]
    # Keep selected dangling references so validation rejects incomplete dependencies.
    for key in ("mappings", "instances"):
        result[key] = [m for m in result.get(key, []) if m["classId"] not in deferred_classes]
    for mapping in result.get("mappings", []):
        mapping["bindings"] = {
            prop: column
            for prop, column in mapping["bindings"].items()
            if (mapping["classId"], prop) not in deferred_properties
        }
    for instance in result.get("instances", []):
        instance["values"] = {
            prop: value
            for prop, value in instance["values"].items()
            if (instance["classId"], prop) not in deferred_properties
        }
    result["links"] = [
        r for r in result.get("links", []) if r["relationId"] not in deferred_relations
    ]
    result["instanceEdits"] = [
        e
        for e in result.get("instanceEdits", [])
        if not any(e["key"].startswith(f"entity:{cid}:") for cid in deferred_classes)
    ]
    for edit in result["instanceEdits"]:
        class_id = next((cid for cid in classes if edit["key"].startswith(f"entity:{cid}:")), None)
        if class_id:
            edit["values"] = {
                prop: value
                for prop, value in edit["values"].items()
                if (class_id, prop) not in deferred_properties
            }
    mappings = {m["id"] for m in result["mappings"]}
    deferred_targets = {
        f"{kind}:{item['id']}"
        for kind, key in (
            ("class", "classes"),
            ("relationship", "relationships"),
            ("mapping", "mappings"),
        )
        for item in draft.get(key, [])
        if item["id"]
        not in {"class": classes, "relationship": relations, "mapping": mappings}[kind]
    }
    if "semantics" in result:
        result["semantics"]["definitions"] = [
            d
            for d in result["semantics"].get("definitions", [])
            if d["target"] not in deferred_targets
            and not any(d["target"].startswith(f"property:{cid}:") for cid in deferred_classes)
            and not any(d["target"] == f"property:{cid}:{pid}" for cid, pid in deferred_properties)
        ]
    return result
