"""Bounded semantic review, evidence references, and read-only semantic discovery."""

import re
from copy import deepcopy
from typing import Literal

from pydantic import Field, StrictBool

from .core import Draft, Name, Slug, Strict, digest, validate_draft


class ReviewIssue(Strict):
    id: Slug
    severity: Literal["error", "warning", "info"]
    target: str = Field(min_length=1, max_length=100)
    category: Name
    message: str = Field(min_length=1, max_length=1200)
    suggestion: str = Field(default="", max_length=1200)
    evidenceIds: list[str] = Field(default_factory=list, max_length=12)
    needsConfirmation: StrictBool = False


class QuestionCoverage(Strict):
    questionId: Slug
    status: Literal["covered", "partial", "missing", "unknown"]
    targets: list[str] = Field(default_factory=list, max_length=20)
    reason: str = Field(min_length=1, max_length=1200)
    evidenceIds: list[str] = Field(default_factory=list, max_length=12)


class ReviewOutput(Strict):
    summary: str = Field(min_length=1, max_length=2000)
    issues: list[ReviewIssue] = Field(max_length=60)
    coverage: list[QuestionCoverage] = Field(max_length=20)


def semantic_config(value):
    config = Draft.model_validate(value).model_dump()
    for family in ("classes", "mappings", "relationships", "instances"):
        for item in config[family]:
            item.pop("accepted", None)
    return config


def semantic_hash(value):
    return digest(semantic_config(value))


def publication_checks(source, report, job=None):
    review = source.get("semanticReview")
    current = bool(review and review.get("configHash") == semantic_hash(source["draft"]))
    status = "completed" if current else "stale" if review else "not_run"
    attempt = None
    if (
        job
        and job.get("kind") == "review"
        and (
            job.get("configHash") == semantic_hash(source["draft"])
            or job.get("revision") == source.get("revision")
        )
        and job.get("status") == "failed"
    ):
        status = "failed"
        attempt = {
            "message": job.get("message", ""),
            "errorCode": job.get("errorCode", ""),
            "updatedAt": job.get("updatedAt", ""),
        }
    return {
        "validation": deepcopy(report),
        "reviewStatus": status,
        "semanticReview": deepcopy(review) if current else None,
        "reviewFailure": attempt,
    }


def target_catalog(value):
    targets = {
        f"{kind}:{item['id']}": item
        for kind, family in (
            ("class", "classes"),
            ("mapping", "mappings"),
            ("relationship", "relationships"),
        )
        for item in value.get(family, [])
    }
    targets.update(
        {
            f"property:{cls['id']}:{p['id']}": {
                **p,
                "classId": cls["id"],
                "name": f"{cls['name']} · {p['name']}",
            }
            for cls in value.get("classes", [])
            for p in cls["properties"]
        }
    )
    return targets


def review_context(source):
    config = semantic_config(source["draft"])
    report = validate_draft(
        source["draft"], (source["rows"], source.get("headers", {})), require_review=False
    )
    evidence = []
    per_sheet = {}
    # Samples support review, never stand in for a full-data correctness check.
    for row in source["rows"]:
        sheet = row["sheet"]
        if per_sheet.get(sheet, 0) >= 3 or len(evidence) >= 120:
            continue
        per_sheet[sheet] = per_sheet.get(sheet, 0) + 1
        values = {
            k: v[:500] if isinstance(v, str) else v for k, v in list(row["values"].items())[:40]
        }
        evidence.append(
            {
                "id": f"sample:{len(evidence)}",
                "kind": "sample",
                "sheet": sheet,
                "row": row["row"],
                "values": values,
                "bounded": True,
            }
        )
    row_counts = {}
    for row in source["rows"]:
        row_counts[row["sheet"]] = row_counts.get(row["sheet"], 0) + 1
    for mapping in config["mappings"]:
        evidence.append(
            {
                "id": f"mapping:{mapping['id']}",
                "kind": "mapping",
                "sheet": mapping["sheet"],
                "bindings": mapping["bindings"],
                "rows": row_counts.get(mapping["sheet"], 0),
                "classId": mapping["classId"],
            }
        )
    for metric in report["relationships"]:
        evidence.append({"id": f"join:{metric['id']}", "kind": "join", **metric})
    return {
        "sourceId": source["id"],
        "revision": source["revision"],
        "configHash": digest(config),
        "snapshotHash": source.get("contentHash", ""),
        "draft": config,
        "profile": source.get("profile", {}),
        "validation": report,
        "evidence": evidence,
        "allowedTargets": ["model", *target_catalog(config)],
        "outputSchema": ReviewOutput.model_json_schema(),
    }


def validate_review(value, context):
    result = ReviewOutput.model_validate(value).model_dump()
    targets = set(target_catalog(context["draft"])) | {"model"}
    evidence = {e["id"] for e in context["evidence"]}
    questions = {q["id"] for q in context["draft"]["semantics"]["questions"]}
    ids = [i["id"] for i in result["issues"]]
    if len(ids) != len(set(ids)):
        raise ValueError("审查问题标识重复")
    coverage_ids = [c["questionId"] for c in result["coverage"]]
    if set(coverage_ids) != questions or len(coverage_ids) != len(questions):
        raise ValueError("审查必须逐项评估全部业务问题")
    for item in [*result["issues"], *result["coverage"]]:
        refs = [item["target"]] if "target" in item else item["targets"]
        if not set(refs) <= targets or not set(item["evidenceIds"]) <= evidence:
            raise ValueError("审查引用了不存在的建模项或数据证据")
        if item.get("status") == "covered" and (not item["targets"] or not item["evidenceIds"]):
            raise ValueError("覆盖结论必须引用建模项和数据证据")
    return result


def semantic_items(value):
    config = Draft.model_validate(value).model_dump()
    definitions = {d["target"]: d for d in config["semantics"]["definitions"]}
    return [
        {
            "target": target,
            "kind": target.split(":")[0],
            "name": item.get("name") or item["id"],
            "definition": definitions.get(target, {}),
            "description": item.get("description") or item.get("reason", ""),
        }
        for target, item in target_catalog(config).items()
    ]


def _score(item, query):
    query = query.casefold().strip()
    terms = [item["name"], item["target"], *item["definition"].get("aliases", [])]
    text = " ".join(
        [*terms, item["description"], *[str(v) for v in item["definition"].values()]]
    ).casefold()
    exact = sum(8 for term in terms if term and term.casefold() in query)
    if query in text:
        exact += 6
    tokens = re.findall(r"[a-z0-9_]+|[\u4e00-\u9fff]{2,}", query)
    bigrams = {
        token[i : i + 2]
        for token in tokens
        if re.search(r"[\u4e00-\u9fff]", token)
        for i in range(len(token) - 1)
    }
    return (
        exact
        + sum(1 for token in tokens if token in text)
        + sum(1 for gram in bigrams if gram in text)
    )


def browse_semantics(value, query, kind="all", limit=6):
    if not query.strip():
        return {"items": [], "truncated": False}
    items = [
        (score, item)
        for item in semantic_items(value)
        if kind == "all" or kind == item["kind"]
        if (score := _score(item, query)) > 0
    ]
    items.sort(key=lambda pair: (-pair[0], pair[1]["target"]))
    limit = max(1, min(limit, 6))
    return {"items": [item for _, item in items[:limit]], "truncated": len(items) > limit}


def resolve_semantics(value, mentions):
    config = Draft.model_validate(value).model_dump()
    items, unresolved, seen = [], [], set()
    for mention in mentions[:5]:
        found = browse_semantics(config, mention, limit=2)["items"]
        if not found:
            unresolved.append(mention)
        for item in found:
            if item["target"] in seen:
                continue
            seen.add(item["target"])
            item = deepcopy(item)
            parts = item["target"].split(":")
            kind, ident = parts[:2]
            class_ids = {ident} if kind in ("class", "property") else set()
            if kind == "mapping":
                class_ids |= {m["classId"] for m in config["mappings"] if m["id"] == ident}
            if kind == "relationship":
                class_ids |= {
                    c
                    for r in config["relationships"]
                    if r["id"] == ident
                    for c in (r["source"], r["target"])
                }
            mappings = [m for m in config["mappings"] if m["classId"] in class_ids]
            item["mappings"] = [
                {
                    **m,
                    "bindings": dict(list(m["bindings"].items())[:10]),
                    "bindingsTruncated": len(m["bindings"]) > 10,
                }
                for m in mappings[:3]
            ]
            item["relationships"] = [
                r
                for r in config["relationships"]
                if r["source"] in class_ids or r["target"] in class_ids
            ][:5]
            item["mappingsTruncated"] = len(mappings) > 3
            item["relationshipsTruncated"] = (
                sum(
                    r["source"] in class_ids or r["target"] in class_ids
                    for r in config["relationships"]
                )
                > 5
            )
            items.append(item)
    return {
        "items": items,
        "unresolved": unresolved,
        "note": "语义定义与约束用于解释模型；业务结论须查询当前版本实例及来源证据。",
    }
