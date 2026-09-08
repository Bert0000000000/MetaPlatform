"""writeback —— Scenario 写回业务一致性校验（SAL §5 风险消化）。

场景执行器在把 AI 推导/用户确认的结果写回本体前调用
``validate_write_back``：类可解析、PK 必填、目标不重复、租户前缀一致。
返回结构化问题列表；空列表 = 可安全写回。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class WriteBackIssue:
    index: int
    code: str
    message: str


def _pk_slugs(pk_rids: tuple[str, ...]) -> tuple[str, ...]:
    """从 PK 属性 rid 提取 slug 键（props 键允许用 slug）。"""
    out = []
    for r in pk_rids:
        seg = str(r).split(".")
        out.append(seg[-2] if len(seg) >= 2 else str(r))
    return tuple(out)


def validate_write_back(
    entries: list[dict[str, Any]],
    *,
    known_classes: dict[str, tuple[str, ...]],
    tenant_id: str,
) -> list[WriteBackIssue]:
    """校验写回批次。

    entries: [{"individual_rid": "ont.<tenant>.ind.<slug>.<pk>",
               "class_rid": "ont.<tenant>.obj.<domain>.<slug>.<ver>",
               "props": {slug_or_rid: value}}]
    known_classes: class_rid → PK 属性 rid 元组（执行器从 repo 元数据装配）。
    """
    issues: list[WriteBackIssue] = []
    seen_targets: dict[str, int] = {}
    prefix = f"ont.{tenant_id}."
    for i, e in enumerate(entries):
        cls = str(e.get("class_rid") or "")
        ind = str(e.get("individual_rid") or "")
        props = e.get("props") or {}
        if cls not in known_classes:
            issues.append(WriteBackIssue(
                i, "unknown_class", f"class_rid {cls!r} not registered"))
            continue
        if not ind.startswith(prefix):
            issues.append(WriteBackIssue(
                i, "tenant_mismatch",
                f"individual_rid {ind!r} not in tenant {tenant_id!r}"))
        if ind in seen_targets:
            issues.append(WriteBackIssue(
                i, "duplicate_target",
                f"individual_rid {ind!r} duplicates entry {seen_targets[ind]}"))
        else:
            seen_targets[ind] = i
        pk_keys = _pk_slugs(known_classes[cls])
        pk_rids = known_classes[cls]
        if pk_keys and not (any(k in props for k in pk_keys)
                            or any(r in props for r in pk_rids)):
            issues.append(WriteBackIssue(
                i, "missing_pk",
                f"primary key {sorted(pk_keys)} required"))
    return issues
