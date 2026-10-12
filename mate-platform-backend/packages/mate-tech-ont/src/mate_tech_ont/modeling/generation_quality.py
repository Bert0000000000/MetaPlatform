"""Deterministic full-data evidence and constrained, unapproved AI repairs."""

import re
from collections import defaultdict
from copy import deepcopy
from itertools import combinations
from typing import Literal

from pydantic import Field

from .core import (
    MAX_NODES,
    Draft,
    Join,
    Slug,
    Strict,
    convert,
    digest,
    validate_draft,
    validate_ontology,
)
from .rules import relationship_field_problem

POLICY_VERSION = "excel-native-v1"
CAPABILITIES = {
    "propertyTypes": ["text", "number", "date"],
    "identityFields": 4,
    "joinConditions": 4,
    "inheritance": "single; same nonempty identity and inherited properties",
    "publication": "native ObjectType, Property, LinkType, subclass axiom and version gates",
    "manualCapabilities": [
        "interfaces",
        "actions",
        "functions",
        "complex properties",
        "timeseries",
        "global constraints",
    ],
}


class Repair(Strict):
    kind: Literal["identity", "joins"]
    id: Slug
    identity: list[Slug] = Field(default_factory=list, max_length=4)
    joins: list[Join] = Field(default_factory=list, max_length=4)
    reason: str = Field(min_length=1, max_length=1000)


class Repairs(Strict):
    repairs: list[Repair] = Field(max_length=30)


def input_fingerprint(rows, context, questions, native_types, native_links=()):
    return digest(
        {
            "policy": POLICY_VERSION,
            "schema": Draft.model_json_schema(),
            "rows": rows,
            "context": context.strip(),
            "questions": questions,
            "nativeTypes": sorted(native_types, key=lambda t: t["rid"]),
            "nativeLinks": sorted(native_links, key=lambda t: t["rid"]),
        }
    )


def _records(model, rows):
    source_rows = rows[0] if isinstance(rows, tuple) else rows
    sheets = defaultdict(list)
    for row in source_rows:
        sheets[row["sheet"]].append(row)
    classes = {c.id: c for c in model.classes}
    records = defaultdict(list)
    count = 0
    for mapping in model.mappings:
        cls = classes.get(mapping.classId)
        if not cls:
            continue
        for row in sheets[mapping.sheet]:
            count += 1
            if count > MAX_NODES:
                raise ValueError("生成预检映射记录超过容量限制，请缩小建模范围")
            values = {}
            for prop in cls.properties:
                try:
                    values[prop.id] = convert(
                        row["values"].get(mapping.bindings.get(prop.id, "")), prop.dataType
                    )
                except (ValueError, TypeError, OverflowError):
                    values[prop.id] = None
            records[cls.id].append({"values": values, "row": f"{row['sheet']}:{row['row']}"})
    return records


def _metrics(records, key):
    grouped = defaultdict(list)
    empty = 0
    for row in records:
        if not key or any(row["values"].get(p) in (None, "") for p in key):
            empty += 1
        else:
            grouped[tuple(row["values"][p] for p in key)].append(row)
    conflicts = []
    for identity, group in grouped.items():
        props = set().union(*(r["values"].keys() for r in group))
        conflicting = sorted(
            p
            for p in props
            if len({r["values"][p] for r in group if r["values"].get(p) not in (None, "")}) > 1
        )
        if conflicting:
            conflicts.append(
                {
                    "identity": [str(v)[:240] for v in identity],
                    "properties": conflicting,
                    "rows": [r["row"] for r in group[:3]],
                    "values": [
                        {p: str(r["values"].get(p))[:240] for p in conflicting[:4]}
                        for r in group[:3]
                    ],
                }
            )
    return {
        "rows": len(records),
        "emptyIdentityRows": empty,
        "distinctIdentities": len(grouped),
        "conflictingIdentities": len(conflicts),
        "examples": conflicts[:3],
    }


def _family(classes, root):
    members = {root}
    for _ in classes:
        members.update(c.id for c in classes.values() if c.parentClassId in members)
    return members


def _suggest_joins(model, rel):
    classes = {c.id: c for c in model.classes}
    src, dst = classes.get(rel.source), classes.get(rel.target)
    if not src or not dst or rel.accepted or rel.targetSelection != "entity" or not dst.identity:
        return []
    sm = [m for m in model.mappings if m.classId == src.id]
    tm = [m for m in model.mappings if m.classId == dst.id]
    sp, tp = {p.id: p for p in src.properties}, {p.id: p for p in dst.properties}
    joins = [j.model_dump() for j in rel.joins if j.sourceProperty in sp and j.targetProperty in tp]
    for ident in dst.identity:
        if any(j["targetProperty"] == ident for j in joins):
            continue
        prop = tp.get(ident)
        if not prop:
            return []
        target_columns = {m.bindings[ident] for m in tm if ident in m.bindings}
        matches = [
            p
            for p in src.properties
            if p.dataType == prop.dataType
            and any(p.id in m.bindings for m in sm)
            and target_columns
            and (
                p.id == ident
                or p.name == prop.name
                or {m.bindings[p.id] for m in sm if p.id in m.bindings} & target_columns
            )
        ]
        if len(matches) != 1 or any(j["sourceProperty"] == matches[0].id for j in joins):
            return []
        joins.append({"sourceProperty": matches[0].id, "targetProperty": ident})
    return joins if len(joins) <= 4 and joins != [j.model_dump() for j in rel.joins] else []


def analyze(value, rows):
    model = Draft.model_validate(value)
    classes = {c.id: c for c in model.classes}
    records = _records(model, rows)
    findings = []
    identities = []
    relation_candidates = []
    for cls in model.classes:
        stats = _metrics(records[cls.id], cls.identity)
        entry = {
            "classId": cls.id,
            "name": cls.name,
            "identity": cls.identity,
            **stats,
            "candidates": [],
        }
        family = _family(classes, cls.id)
        basis_records = records[cls.id] or [
            r for c in sorted(family - {cls.id}) for r in records[c]
        ]
        basis = _metrics(basis_records, cls.identity)
        if (
            basis["conflictingIdentities"]
            and cls.identity
            and not cls.parentClassId
            and not cls.accepted
        ):
            entry["candidateBasis"] = basis
            family = _family(classes, cls.id)
            props = [
                p.id
                for p in cls.properties
                if p.dataType == "text"
                and p.id not in cls.identity
                and re.search(
                    r"(^|[_\s])(id|code|key|no|number)($|[_\s])|标识|编号|编码|单号|行号",
                    p.id + " " + p.name,
                    re.I,
                )
                and all(
                    any(cp.id == p.id and cp.dataType == p.dataType for cp in classes[c].properties)
                    for c in family
                )
            ]
            # A bounded search considers at most 12 identifier fields; no measure/date keys.
            props = sorted(props)[:12]
            for count in range(1, min(2, 4 - len(cls.identity)) + 1):
                for extra in combinations(props, count):
                    key = [*cls.identity, *extra]
                    checked = _metrics(basis_records, key)
                    if (
                        not checked["emptyIdentityRows"]
                        and checked["conflictingIdentities"] < basis["conflictingIdentities"]
                    ):
                        entry["candidates"].append({"identity": key, **checked})
                if len(entry["candidates"]) >= 3:
                    break
            entry["candidates"] = sorted(
                entry["candidates"],
                key=lambda c: (c["conflictingIdentities"], len(c["identity"]), c["identity"]),
            )[:3]
        identities.append(entry)
        if stats["emptyIdentityRows"] or stats["conflictingIdentities"] or not cls.identity:
            message = (
                f"{cls.name}：{stats['emptyIdentityRows']} 行身份缺失，{stats['conflictingIdentities']} 组同身份属性冲突。"
                if cls.identity
                else f"{cls.name}：尚未定义业务身份，使用来源记录无法跨文件对齐。"
            )
            findings.append(
                {"kind": "identity", "item": cls.id, "name": cls.name, "message": message}
            )
    for rel in model.relationships:
        problem = relationship_field_problem(rel, classes)
        if problem:
            findings.append(
                {"kind": "relationship", "item": rel.id, "name": rel.name, "message": problem}
            )
            joins = _suggest_joins(model, rel)
            if joins:
                relation_candidates.append({"relationId": rel.id, "joins": joins})
    structure = validate_ontology(model.model_dump(), require_review=False)
    data = validate_draft(model.model_dump(), rows, require_review=False)
    for issue in [*structure["issues"], *data["issues"]]:
        if issue["severity"] != "error" or any(
            f["item"] == issue["item"] and f["message"] == issue["message"] for f in findings
        ):
            continue
        item = issue["item"]
        name = classes[item].name if item in classes else item
        findings.append(
            {"kind": "validation", "item": item, "name": name, "message": issue["message"]}
        )
    return {
        "structureErrors": structure["errors"],
        "dataErrors": data["errors"],
        "findings": findings[:60],
        "identities": identities,
        "relationshipCandidates": relation_candidates,
    }


def apply_repairs(value, rows, raw):
    """Only locally evidenced, improving changes; never permit conceptual drift."""
    patches = Repairs.model_validate(raw)
    next_draft = deepcopy(value)
    changes = []
    handled = set()
    before = analyze(value, rows)
    for patch in patches.repairs:
        if (patch.kind, patch.id) in handled:
            continue
        trial = deepcopy(next_draft)
        classes = {c["id"]: c for c in trial["classes"]}
        if patch.kind == "identity":
            cls = classes.get(patch.id)
            entry = next((e for e in before["identities"] if e["classId"] == patch.id), None)
            if (
                patch.joins
                or not cls
                or cls["accepted"]
                or not entry
                or not any(c["identity"] == patch.identity for c in entry["candidates"])
            ):
                continue
            family = _family({c.id: c for c in Draft.model_validate(trial).classes}, patch.id)
            if any(
                classes[c]["accepted"] or classes[c]["identity"] != cls["identity"] for c in family
            ):
                continue
            if any(
                r["accepted"] and (r["source"] in family or r["target"] in family)
                for r in trial["relationships"]
            ):
                continue
            original = list(cls["identity"])
            old_records = _records(Draft.model_validate(trial), rows)
            if any(
                _metrics(old_records[c], patch.identity)["emptyIdentityRows"]
                > _metrics(old_records[c], original)["emptyIdentityRows"]
                or _metrics(old_records[c], patch.identity)["conflictingIdentities"]
                > _metrics(old_records[c], original)["conflictingIdentities"]
                for c in family
            ):
                continue
            for ident in family:
                classes[ident].update(
                    identity=patch.identity,
                    identityCandidate=patch.identity,
                    identityStatus="proposed",
                    identityReason=patch.reason,
                    accepted=False,
                )
            # Every dependent relationship must be rechecked against the new identity.
            for rel in trial["relationships"]:
                if rel["source"] in family or rel["target"] in family:
                    rel.update(accepted=False, cardinalityStatus="proposed")
        else:
            rel = next((r for r in trial["relationships"] if r["id"] == patch.id), None)
            if (
                patch.identity
                or not rel
                or rel["accepted"]
                or not patch.joins
                or rel.get("targetSelection") != "entity"
            ):
                continue
            src, dst = classes.get(rel["source"]), classes.get(rel["target"])
            if not src or not dst:
                continue
            sp, tp = (
                {p["id"]: p for p in src["properties"]},
                {p["id"]: p for p in dst["properties"]},
            )
            joins = [j.model_dump() for j in patch.joins]
            original = deepcopy(rel["joins"])
            if any(
                j["sourceProperty"] not in sp
                or j["targetProperty"] not in tp
                or sp[j["sourceProperty"]]["dataType"] != tp[j["targetProperty"]]["dataType"]
                for j in joins
            ):
                continue
            if any(
                j not in rel["joins"]
                and (
                    j["targetProperty"] not in dst["identity"]
                    or not (
                        j["sourceProperty"] == j["targetProperty"]
                        or sp[j["sourceProperty"]]["name"].strip()
                        == tp[j["targetProperty"]]["name"].strip()
                        or {
                            m["bindings"][j["sourceProperty"]]
                            for m in trial["mappings"]
                            if m["classId"] == rel["source"]
                            and j["sourceProperty"] in m["bindings"]
                        }
                        & {
                            m["bindings"][j["targetProperty"]]
                            for m in trial["mappings"]
                            if m["classId"] == rel["target"]
                            and j["targetProperty"] in m["bindings"]
                        }
                    )
                )
                for j in joins
            ):
                continue
            if any(
                not any(
                    m["classId"] == rel["source"] and j["sourceProperty"] in m["bindings"]
                    for m in trial["mappings"]
                )
                or not any(
                    m["classId"] == rel["target"] and j["targetProperty"] in m["bindings"]
                    for m in trial["mappings"]
                )
                for j in joins
            ):
                continue
            # Preserve prior valid conditions instead of replacing a business rule.
            old_valid = [
                j for j in rel["joins"] if j["sourceProperty"] in sp and j["targetProperty"] in tp
            ]
            if any(j not in joins for j in old_valid) or joins == rel["joins"]:
                continue
            rel.update(joins=joins, accepted=False, cardinalityStatus="proposed")
            model = Draft.model_validate(trial)
            fixed = next(r for r in model.relationships if r.id == patch.id)
            if relationship_field_problem(fixed, {c.id: c for c in model.classes}):
                continue
            records = _records(model, rows)
            if records[rel["source"]] and records[rel["target"]]:
                targets = {
                    tuple(r["values"][j.targetProperty] for j in fixed.joins)
                    for r in records[rel["target"]]
                    if all(r["values"].get(j.targetProperty) is not None for j in fixed.joins)
                }
                matched = sum(
                    tuple(r["values"].get(j.sourceProperty) for j in fixed.joins) in targets
                    for r in records[rel["source"]]
                )
                if not matched:
                    continue
        # Completing a composite identity may expose dependent relation gaps; keep
        # it only when no new unrelated structural errors appear and identity improves.
        if patch.kind == "identity":
            previous_structure = validate_ontology(next_draft, require_review=False)
            new_structure = validate_ontology(trial, require_review=False)
            allowed_relations = {
                r["id"]
                for r in trial["relationships"]
                if r["source"] in family or r["target"] in family
            }
            old_errors = {
                (i["item"], i["message"])
                for i in previous_structure["issues"]
                if i["severity"] == "error"
            }
            if any(
                i["severity"] == "error"
                and (i["item"], i["message"]) not in old_errors
                and i["item"] not in allowed_relations
                for i in new_structure["issues"]
            ):
                continue
        elif (
            validate_ontology(trial, require_review=False)["errors"]
            > validate_ontology(next_draft, require_review=False)["errors"]
        ):
            continue
        next_draft = Draft.model_validate(trial).model_dump()
        handled.add((patch.kind, patch.id))
        changes.append(
            {
                "kind": patch.kind,
                "item": patch.id,
                "reason": patch.reason,
                "before": original,
                "after": patch.identity if patch.kind == "identity" else joins,
            }
        )
    return next_draft, changes
