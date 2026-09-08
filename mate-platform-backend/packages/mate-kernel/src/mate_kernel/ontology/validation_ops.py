"""validation_ops — 本体验证（ONT-G17，2026-09-08）。

model validation：类型定义静态检查（PK 完整性 / rid 形制 / slug 重复 / 属性引用）。
data validation：实例 props 对类型 schema 的符合性（必填 / 未知属性 / PK 缺失）。
"""
from __future__ import annotations

import re
from typing import Any

from .identity.class_ref import ClassRef
from .types.object_type import ObjectType

_RID_RE = re.compile(
    r"^ont\.[a-z0-9_-]{1,64}\.(?:cls|ver|prop|obj|link|act|if|ind|lnk|ax|fn|oset)"
    r"\.[a-z0-9:\-.]{1,200}$"
)


def validate_model(ot: ObjectType) -> dict[str, Any]:
    """类型定义静态验证。返回 {valid, errors[], warnings[]}。"""
    errors: list[str] = []
    warnings: list[str] = []
    rid = ot.rid.rid

    if not _RID_RE.match(rid):
        errors.append(f"rid 形制非法: {rid}")
    if not ot.primary_key:
        errors.append("primary_key 为空")
    if not ot.display_name:
        warnings.append("display_name 缺失")

    slugs: dict[str, int] = {}
    pk_set = {p.rid.rid if hasattr(p.rid, "rid") else str(p.rid)
              for p in ot.primary_key}
    for p in ot.properties:
        prid = p.rid.rid if hasattr(p.rid, "rid") else str(p.rid)
        if not _RID_RE.match(prid):
            errors.append(f"属性 rid 形制非法: {prid}")
        slug = prid.split(".")[3] if len(prid.split(".")) >= 5 else prid
        slugs[slug] = slugs.get(slug, 0) + 1
        if prid not in pk_set and p.primary_key:
            errors.append(f"属性标记 primary_key 但不在类型 PK 列表: {prid}")
    for slug, n in slugs.items():
        if n > 1:
            errors.append(f"slug 重复({n} 次): {slug}")
    for pk in pk_set:
        if pk not in {p.rid.rid if hasattr(p.rid, 'rid') else str(p.rid)
                      for p in ot.properties}:
            errors.append(f"PK 引用不存在于 properties: {pk}")

    return {"valid": not errors, "errors": errors, "warnings": warnings,
            "rid": rid}


def validate_instance(
    ot: ObjectType, props: dict[str, Any],
) -> dict[str, Any]:
    """实例数据验证：props（slug 或 rid 键）对类型 schema。"""
    errors: list[str] = []
    warnings: list[str] = []

    slug_index: dict[str, dict[str, Any]] = {}
    rid_index: dict[str, dict[str, Any]] = {}
    for p in ot.properties:
        prid = p.rid.rid if hasattr(p.rid, "rid") else str(p.rid)
        slug = prid.split(".")[3] if len(prid.split(".")) >= 5 else prid
        info = {"rid": prid, "type_id": p.type_id,
                "nullable": p.nullable, "primary_key": p.primary_key}
        slug_index[slug] = info
        rid_index[prid] = info

    resolved: dict[str, tuple[dict[str, Any], Any]] = {}
    for key, value in props.items():
        info = slug_index.get(key) or rid_index.get(key)
        if info is None:
            errors.append(f"未知属性: {key}")
            continue
        resolved[key] = (info, value)

    for slug, info in slug_index.items():
        found = any(info is r for r, _ in resolved.values())
        if not info["nullable"] and not found:
            errors.append(f"必填属性缺失: {slug}")

    for key, (info, value) in resolved.items():
        if value is None and not info["nullable"]:
            errors.append(f"非空属性传 None: {key}")
        t = info["type_id"]
        if t == "integer" and value is not None and not isinstance(value, int):
            errors.append(f"类型不符(期望 integer): {key}={value!r}")
        elif t == "boolean" and value is not None and not isinstance(value, bool):
            errors.append(f"类型不符(期望 boolean): {key}={value!r}")

    for pk in ot.primary_key:
        pk_rid = pk.rid if hasattr(pk, "rid") else str(pk)
        pk_slug = pk_rid.split(".")[3] if len(pk_rid.split(".")) >= 5 else pk_rid
        if not any(info["rid"] == pk_rid for info, _ in resolved.values()):
            errors.append(f"PK 属性缺值: {pk_slug}")

    return {"valid": not errors, "errors": errors, "warnings": warnings,
            "class_rid": ot.rid.rid}
