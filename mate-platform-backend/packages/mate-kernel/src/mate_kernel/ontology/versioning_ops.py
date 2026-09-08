"""versioning_ops — ObjectType diff（ONT-G8/G19，2026-09-08）。

纯函数：两个 ObjectType 的属性级 diff，供 REST 与 rollback 校验复用。
"""
from __future__ import annotations

from typing import Any

from .identity.class_ref import ClassRef
from .types.object_type import ObjectType


def _props_index(ot: ObjectType) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for p in ot.properties:
        slug = p.rid.rid.split(".")[3] if len(p.rid.rid.split(".")) >= 5 else p.rid.rid
        out[slug] = {
            "rid": p.rid.rid,
            "type_id": p.type_id,
            "nullable": p.nullable,
            "primary_key": p.primary_key,
        }
    return out


def diff_object_types(old: ObjectType, new: ObjectType) -> dict[str, Any]:
    """属性级 diff：added / removed / changed（type_id 或 nullable 变化）。"""
    a = _props_index(old)
    b = _props_index(new)
    added = sorted(set(b) - set(a))
    removed = sorted(set(a) - set(b))
    changed = [
        slug for slug in sorted(set(a) & set(b))
        if (a[slug]["type_id"], a[slug]["nullable"]) != (b[slug]["type_id"], b[slug]["nullable"])
    ]
    return {
        "old_rid": old.rid.rid,
        "new_rid": new.rid.rid,
        "added": added,
        "removed": removed,
        "changed": changed,
        "has_changes": bool(added or removed or changed),
    }
