"""Business rules scoped to reverse modeling; never change native kernel semantics."""

import json
from collections import Counter, defaultdict


def declared_keys(cls):
    return ([set(cls.identity)] if cls.identity else []) + [
        set(key.properties) for key in cls.uniqueKeys if key.confirmed and key.reason
    ]


def relationship_field_problem(rel, classes):
    source, target = classes.get(rel.source), classes.get(rel.target)
    if not source or not target:
        return "来源或目标对象不存在，请核对关系端点"
    source_props = {p.id for p in source.properties}
    target_props = {p.id for p in target.properties}
    valid = [
        j
        for j in rel.joins
        if j.sourceProperty in source_props and j.targetProperty in target_props
    ]
    if len(valid) != len(rel.joins) or not valid:
        return "缺少有效关联字段映射；引用来源列仅为证据，请补充实际关联条件或暂不发布此关系"
    if rel.targetSelection == "entity":
        keys = declared_keys(target)
        joined = {j.targetProperty for j in valid}
        if not any(key <= joined for key in keys):
            missing = [p.name for p in target.properties if p.id in set(target.identity) - joined]
            return "实体关联未覆盖目标的完整身份或经确认的替代唯一键" + (
                "；缺少目标字段：" + "、".join(missing) if missing else "；请先定义可定位的目标身份"
            )
    return ""


def check_definitions(model, report, require_review):
    severity = "error" if require_review else "warning"
    classes = {c.id: c for c in model.classes}
    for cls in model.classes:
        props = {p.id for p in cls.properties}
        if not set(cls.identityCandidate) <= props:
            report.issue("error", cls.id, "候选身份引用不存在的属性")
        if cls.identityStatus == "confirmed" and (not cls.identity or not cls.identityReason):
            report.issue("error", cls.id, "已确认业务身份需要非空身份属性和业务依据")
        if cls.identityStatus in {"source-record", "unresolved"} and cls.identity:
            report.issue(
                "error", cls.id, "来源记录或未确定身份不能同时启用业务身份，请保留为候选身份"
            )
        if cls.identityStatus == "proposed":
            report.issue(severity, cls.id, "业务身份仍为候选，请确认规则或明确标记为未确定")
        for key in cls.uniqueKeys:
            if len(set(key.properties)) != len(key.properties) or not set(key.properties) <= props:
                report.issue("error", cls.id, "替代唯一键存在重复或无效属性")
            if key.confirmed and not key.reason:
                report.issue("error", cls.id, "已确认替代唯一键缺少业务依据")
    for rel in model.relationships:
        if rel.cardinalityStatus in {"unresolved", "proposed"}:
            report.issue(severity, rel.id, "关系基数尚未确认，请审核规则或暂不发布此关系")
        if rel.cardinalityStatus == "confirmed" and not rel.cardinalityReason:
            report.issue("error", rel.id, "已确认关系基数缺少业务依据")
        if rel.targetSelection == "group" and rel.cardinality in {"N:1", "1:1"}:
            report.issue(
                "error", rel.id, "集合关联不能声明每个来源至多一个目标，请改用实体关联与唯一键"
            )
        problem = relationship_field_problem(rel, classes)
        if problem:
            report.issue("error", rel.id, problem)


def check_unique_values(model, entities, report):
    invalid = set()
    by_class = defaultdict(list)
    for entity in entities.values():
        by_class[entity["classId"]].append(entity)
    for cls in model.classes:
        for key in cls.uniqueKeys:
            if not key.confirmed:
                continue
            seen = {}
            for entity in by_class[cls.id]:
                values = [entity["properties"].get(p) for p in key.properties]
                if any(v is None or v == "" for v in values):
                    invalid.add(entity["key"])
                    report.issue("error", cls.id, "已确认替代唯一键存在空值，不能用于实体关联")
                    continue
                token = json.dumps(values, sort_keys=True, ensure_ascii=False)
                if token in seen:
                    invalid.update([seen[token], entity["key"]])
                    report.issue("error", cls.id, "已确认替代唯一键存在重复值，不能唯一定位对象")
                seen[token] = entity["key"]
    return invalid


def check_edge_cardinality(model, edges, report):
    by_relation = defaultdict(list)
    for edge in edges:
        by_relation[edge["relationId"]].append(edge)
    for rel in model.relationships:
        if rel.cardinalityStatus != "confirmed":
            continue
        outgoing = Counter(e["source"] for e in by_relation[rel.id])
        incoming = Counter(e["target"] for e in by_relation[rel.id])
        if (rel.cardinality in {"N:1", "1:1"} and any(n > 1 for n in outgoing.values())) or (
            rel.cardinality in {"1:N", "1:1"} and any(n > 1 for n in incoming.values())
        ):
            report.issue(
                "error",
                rel.id,
                f"实际连线违反已确认关系基数 {rel.cardinality}，请核对粒度、唯一键及人工连线",
            )


def validate_evidence(draft, profile):
    from .scope import publication_scope

    draft = publication_scope(draft)
    sheets = {s["name"]: {c["name"] for c in s["columns"]} for s in profile["sheets"]}
    issues = []
    for item in draft.get("classes", []) + draft.get("relationships", []):
        for evidence in item.get("evidence", []):
            if evidence["kind"] == "source" and (
                evidence.get("sheet") not in sheets
                or not evidence.get("columns")
                or not set(evidence["columns"]) <= sheets.get(evidence.get("sheet"), set())
            ):
                issues.append(
                    {
                        "severity": "error",
                        "item": item["id"],
                        "message": "来源证据引用无效，请选择实际工作表和字段；推断请明确标为推断",
                    }
                )
    return issues
