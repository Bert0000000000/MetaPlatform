"""Migration —— 模型发布的存量实例适配计划（ADR-0082）。

**纯函数层**：old/new ObjectType + options → 声明式计划（JSON-able dict）。
不碰 SQL —— 评估计数与执行在 repo 层（`pg_repo.assess_migration` / `run_migration`）。

计划步骤（执行序）：
1. ``reattach``   —— 家族内旧版本 rid 上的实例重挂到当前 live rid（repo 按数据态填）；
2. ``renames``    —— prop rid 变更（同 slug 后继自动配对，显式 mapping 覆盖）；
3. ``coercions``  —— 保留属性的 format 变化，仅**无损白名单**转换；
4. ``pk_rederive``—— 主键变更：从新 pk 属性值重派生实例 rid（fail-closed / skip）；
5. ``drops``      —— 无后继旧属性：默认 preserve（不丢数据），显式 drop 才删。
"""

from __future__ import annotations

import re
from typing import Any

from .types.object_type import ObjectType

__all__ = [
    "LOSSLESS_FORMAT_PAIRS",
    "build_migration_plan",
    "coerce_value",
    "prop_slug",
]

# 无损 format 转换白名单（ADR-0082 §2.3）：其余 format 对一律保留原值 + 报警，不猜。
LOSSLESS_FORMAT_PAIRS: frozenset[tuple[str, str]] = frozenset(
    {
        ("string", "integer"),
        ("string", "double"),
        ("integer", "string"),
        ("double", "string"),
        ("integer", "double"),
    }
)

_INT_RE = re.compile(r"^-?\d+$")
_NUM_RE = re.compile(r"^-?\d+(\.\d+)?([eE][-+]?\d+)?$")


def prop_slug(prop_rid: str) -> str:
    """prop rid → slug（`ont.<t>.prop.<slug>.vN` 第 4 段；退化取末段）。"""
    parts = prop_rid.split(".")
    return parts[3] if len(parts) >= 5 else parts[-1]


def coerce_value(from_fmt: str, to_fmt: str, value: Any) -> Any:
    """单值无损转换；**不可无损 → 原值返回**（调用方按 kept 计数，不猜）。

    只处理 JSON 层面的标量（string / int / float）；白名单外的 format 对一律原值。
    """
    pair = (from_fmt, to_fmt)
    if pair not in LOSSLESS_FORMAT_PAIRS:
        return value
    if pair == ("string", "integer"):
        if isinstance(value, str) and _INT_RE.fullmatch(value):
            return int(value)
        return value
    if pair == ("string", "double"):
        # 正则排除 nan/inf（float() 会接受它们，但它们不是合法业务数值）
        if isinstance(value, str) and _NUM_RE.fullmatch(value):
            return float(value)
        return value
    if pair in (("integer", "string"), ("double", "string")):
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
        return value
    if pair == ("integer", "double"):
        # |v| < 2^53 内 int→float 精确；超出保留原值（如实，不冒精度险）
        if isinstance(value, int) and not isinstance(value, bool) and abs(value) < 2**53:
            return float(value)
        return value
    return value


def build_migration_plan(
    old: ObjectType,
    new: ObjectType,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """old → new 定义的声明式迁移计划（纯函数；计数由 repo 的 assess 补齐）。

    options::

        {
          "rename": {old_prop_rid: new_prop_rid, ...},  # 覆盖 slug 猜测
          "drops": "preserve" | "drop",                  # 默认 preserve
          "pk_missing": "abort" | "skip",                # 默认 abort
        }
    """
    if options is not None and not isinstance(options, dict):
        raise ValueError("migration options must be an object")
    opts = options if options is not None else {}
    if set(opts) - {"rename", "drops", "pk_missing"}:
        raise ValueError("unknown migration option")
    if opts.get("drops", "preserve") not in ("preserve", "drop"):
        raise ValueError("drops must be preserve|drop")
    if opts.get("pk_missing", "abort") not in ("abort", "skip"):
        raise ValueError("pk_missing must be abort|skip")
    explicit = opts.get("rename", {})
    if not isinstance(explicit, dict) or any(
        not isinstance(k, str) or not isinstance(v, str) for k, v in explicit.items()
    ):
        raise ValueError("rename must map property strings to property strings")
    old_props = {p.rid.rid: p for p in old.properties}
    new_props = {p.rid.rid: p for p in new.properties}

    removed = sorted(set(old_props) - set(new_props))
    added = sorted(set(new_props) - set(old_props))

    # rename：被移除的旧 rid 若存在**同 slug**的新增后继 → 配对；显式 mapping 优先。
    new_by_slug: dict[str, str] = {}
    for rid in added:
        new_by_slug[prop_slug(rid)] = rid
    if any(src not in removed or dst not in added for src, dst in explicit.items()):
        raise ValueError("rename must map removed properties to added properties")
    renames: dict[str, str] = {}
    drops_props: list[str] = []
    for rid in removed:
        if rid in explicit:
            renames[rid] = explicit[rid]
            continue
        successor = new_by_slug.get(prop_slug(rid))
        if successor is not None:
            renames[rid] = successor
        else:
            drops_props.append(rid)
    if len(set(renames.values())) != len(renames):
        raise ValueError("rename destinations must be unique")
    # 显式 mapping 里被指向的目标必须存在于新定义（防拼写错误悄悄变 no-op）
    for src, dst in explicit.items():
        if src in renames and dst not in new_props:
            raise ValueError(f"rename target not in new definition: {dst}")

    warnings: list[str] = []
    # coercions：保留属性中 format 变化；白名单外整组保留（kept）
    coercions: list[dict[str, str]] = []
    for rid in sorted(set(old_props) & set(new_props)):
        f_old = old_props[rid].format.value
        f_new = new_props[rid].format.value
        if f_old == f_new:
            continue
        if (f_old, f_new) in LOSSLESS_FORMAT_PAIRS:
            coercions.append({"prop_rid": rid, "from_format": f_old, "to_format": f_new})
        else:
            warnings.append(f"format {f_old} -> {f_new} 不在无损白名单：{rid} 的存量值将保留原样")

    old_pk = [pk.rid for pk in old.primary_key]
    new_pk = [pk.rid for pk in new.primary_key]
    pk_rederive: dict[str, Any] | None = None
    if set(old_pk) != set(new_pk):
        if len(new_pk) != 1:
            # 复合主键 v1 不支持（ADR-0082 §3）：如实报告，不静默
            warnings.append(f"复合主键重派生不支持（new_pk={new_pk}）：主键相关实例将不迁移")
        else:
            on_missing = str(opts.get("pk_missing") or "abort")
            if on_missing not in ("abort", "skip"):
                raise ValueError(f"pk_missing must be abort|skip, got {on_missing!r}")
            pk_rederive = {
                "old_pk": old_pk,
                "new_pk": new_pk,
                "on_missing": on_missing,
            }

    drops_policy = str(opts.get("drops") or "preserve")
    if drops_policy not in ("preserve", "drop"):
        raise ValueError(f"drops policy must be preserve|drop, got {drops_policy!r}")

    return {
        "class_rid": new.rid.rid,
        "from_checksum": "",  # repo 按基线定义补
        "renames": renames,
        "coercions": coercions,
        "pk_rederive": pk_rederive,
        "drops": {"policy": drops_policy, "props": drops_props},
        "reattach": None,  # repo 按数据态补（家族内旧 rid 残留实例）
        "warnings": warnings,
    }


def plan_inverse_loss(plan: dict[str, Any]) -> list[str]:
    """计划的信息损失清单（评估展示用）：drop=drop 与 format 收窄不可逆。"""
    losses: list[str] = []
    if plan.get("drops", {}).get("policy") == "drop" and plan["drops"].get("props"):
        losses.append("drop 将删除属性键且不可恢复: " + ", ".join(plan["drops"]["props"]))
    for c in plan.get("coercions") or []:
        if (c["to_format"], c["from_format"]) not in LOSSLESS_FORMAT_PAIRS:
            losses.append(
                f"format {c['from_format']} -> {c['to_format']} 后无法还原 {c['prop_rid']}"
            )
    return losses
