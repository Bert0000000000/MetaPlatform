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
    # Keep selected dangling references so validation rejects incomplete dependencies.
    for key in ("mappings", "instances"):
        result[key] = [m for m in result.get(key, []) if m["classId"] not in deferred_classes]
    result["links"] = [
        r for r in result.get("links", []) if r["relationId"] not in deferred_relations
    ]
    result["instanceEdits"] = [
        e
        for e in result.get("instanceEdits", [])
        if not any(e["key"].startswith(f"entity:{cid}:") for cid in deferred_classes)
    ]
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
        ]
    return result
