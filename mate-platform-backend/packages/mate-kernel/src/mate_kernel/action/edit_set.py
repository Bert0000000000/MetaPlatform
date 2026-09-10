"""ACT-05：声明式 edit-set —— Action 的结构化编辑集（D3/D7 拍板）。

Palantir 语义：Action = 参数 + 声明式 edits（对对象/属性/链接的一组修改，
**单事务**原子提交；单次上限 10,000 对象）。Mate v1 上限 1000 条编辑。

与 legacy function_result 回写并存：ActionType 声明 declarative_edits 时走
本模块（模板解析 → EditSet → repo.apply_edit_set 单事务），否则走 legacy。

编辑算子（op）：
- set_property  (target, property_rid, value)
- create_object (class_rid, primary_key, props)
- delete_object (target)
- add_link      (link_type_rid, src, dst)
- remove_link   (link_instance_rid)

可逆性（ACT-07 revert 的基础）：
- set_property ↔ set_property(旧值)
- create_object ↔ delete_object
- add_link ↔ remove_link
- delete_object 的逆需要实例快照 → v1 标记 non-invertible（revert 拒绝）
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

__all__ = [
    "EDIT_BATCH_LIMIT",
    "OP_ADD_LINK",
    "OP_CREATE_OBJECT",
    "OP_DELETE_OBJECT",
    "OP_REMOVE_LINK",
    "OP_SET_PROPERTY",
    "EditOp",
    "EditSetError",
    "EditSetResult",
    "invert_edits",
    "resolve_edit_template",
]

EDIT_BATCH_LIMIT = 1000

OP_SET_PROPERTY = "set_property"
OP_CREATE_OBJECT = "create_object"
OP_DELETE_OBJECT = "delete_object"
OP_ADD_LINK = "add_link"
OP_REMOVE_LINK = "remove_link"

_VALID_OPS = {OP_SET_PROPERTY, OP_CREATE_OBJECT, OP_DELETE_OBJECT,
              OP_ADD_LINK, OP_REMOVE_LINK}


class EditSetError(ValueError):
    """edit-set 校验/执行失败（含模板解析失败）。"""


@dataclass(frozen=True, slots=True)
class EditOp:
    op: str
    target: str = ""              # set_property/delete_object: Individual rid
    property_rid: str = ""        # set_property
    value: Any = None             # set_property / create_object 单值（props 用 props）
    class_rid: str = ""           # create_object
    primary_key: str = ""         # create_object
    props: dict[str, Any] = field(default_factory=dict)  # create_object: prop_rid → value
    link_type_rid: str = ""       # add_link
    src: str = ""                 # add_link
    dst: str = ""                 # add_link
    link_instance_rid: str = ""   # remove_link

    def __post_init__(self) -> None:
        if self.op not in _VALID_OPS:
            raise EditSetError(f"unknown edit op {self.op!r}")
        if self.op == OP_SET_PROPERTY:
            if not self.target or not self.property_rid:
                raise EditSetError("set_property requires target + property_rid")
        elif self.op == OP_CREATE_OBJECT:
            if not self.class_rid or not self.primary_key:
                raise EditSetError("create_object requires class_rid + primary_key")
        elif self.op == OP_DELETE_OBJECT:
            if not self.target:
                raise EditSetError("delete_object requires target")
        elif self.op == OP_ADD_LINK:
            if not (self.link_type_rid and self.src and self.dst):
                raise EditSetError("add_link requires link_type_rid + src + dst")
        elif self.op == OP_REMOVE_LINK:
            if not self.link_instance_rid:
                raise EditSetError("remove_link requires link_instance_rid")


@dataclass(frozen=True, slots=True)
class EditSetResult:
    action_rid: str
    applied: tuple[EditOp, ...]
    inverse: tuple[EditOp, ...]           # 逆编辑（delete_object 逆为占位 → 不进 revert）
    non_invertible: tuple[str, ...]       # 不可逆编辑的说明（revert 拒绝依据）
    created_rids: tuple[str, ...]         # create_object 实际生成的 rid
    dry_run: bool = False


# ─────────────────── 模板解析（ActionType.declarative_edits）───────────────────


def resolve_edit_template(
    template: dict[str, Any],
    *,
    target_iid: str | None,
    parameters: dict[str, Any],
    now_iso: str = "",
) -> EditOp:
    """声明式模板 → EditOp（占位符替换）。

    占位符：
    - ``$target`` → target_iid
    - ``$param.<name>`` → parameters[name]
    - ``$now`` → now_iso（调用方生成，避免执行两次时间漂移）
    未知占位符 / 缺参数 → EditSetError（fail-fast，不留半解析状态）。
    """
    def _sub(v: Any) -> Any:
        if not isinstance(v, str):
            return v
        if v == "$target":
            if not target_iid:
                raise EditSetError("$target used but target_iid is empty")
            return target_iid
        if v == "$now":
            return now_iso
        if v.startswith("$param."):
            name = v[len("$param."):]
            if name not in parameters:
                raise EditSetError(f"parameter {name!r} not provided")
            return parameters[name]
        return v

    resolved = {k: _sub(v) for k, v in template.items()}
    # props 嵌套占位符
    if isinstance(resolved.get("props"), dict):
        resolved["props"] = {k: _sub(v) for k, v in resolved["props"].items()}
    try:
        return EditOp(**resolved)
    except TypeError as e:
        raise EditSetError(f"bad edit template fields: {e}") from e


def resolve_edit_templates(
    templates: tuple[dict[str, Any], ...] | list[dict[str, Any]],
    *,
    target_iid: str | None,
    parameters: dict[str, Any],
    now_iso: str = "",
) -> list[EditOp]:
    if len(templates) > EDIT_BATCH_LIMIT:
        raise EditSetError(
            f"edit-set exceeds batch limit {EDIT_BATCH_LIMIT}: {len(templates)}"
        )
    return [
        resolve_edit_template(t, target_iid=target_iid, parameters=parameters,
                              now_iso=now_iso)
        for t in templates
    ]


# ─────────────────── 逆编辑（revert 基础）───────────────────


def invert_edits(
    applied: tuple[EditOp, ...] | list[EditOp],
    *,
    old_values: dict[str, Any],               # f"{target}#{property_rid}" → 旧值
    created_rids: tuple[str, ...] | list[str],
    removed_links: list[dict[str, Any]],      # remove_link 前的快照（含 props）
) -> tuple[tuple[EditOp, ...], tuple[str, ...]]:
    """编辑序列 → （逆序列, 不可逆说明）。逆序列按原序的**逆序**（逆操作回滚）。

    - set_property → set_property(旧值)（缺旧值快照 → 不可逆）
    - create_object → delete_object(created rid)
    - add_link → remove_link（需要 link_instance_rid：由执行器在 applied 后回填 target）
    - remove_link → add_link（从 removed_links 快照恢复）
    - delete_object → 不可逆（v1）
    """
    inverse: list[EditOp] = []
    non_invertible: list[str] = []
    created = list(created_rids)
    removed_by_rid = {r["rid"]: r for r in removed_links}
    for e in reversed(list(applied)):
        if e.op == OP_SET_PROPERTY:
            key = f"{e.target}#{e.property_rid}"
            old = old_values.get(key, _MISSING)
            if old is _MISSING:
                non_invertible.append(f"set_property {key}: old value snapshot missing")
                continue
            inverse.append(replace(e, value=old))
        elif e.op == OP_CREATE_OBJECT:
            if not created:
                non_invertible.append("create_object: created rid not recorded")
                continue
            inverse.append(EditOp(op=OP_DELETE_OBJECT, target=created.pop(0)))
        elif e.op == OP_ADD_LINK:
            # 执行器把生成的 link_instance_rid 写进 e.link_instance_rid
            if not e.link_instance_rid:
                non_invertible.append("add_link: link_instance_rid not backfilled")
                continue
            inverse.append(EditOp(op=OP_REMOVE_LINK,
                                  link_instance_rid=e.link_instance_rid))
        elif e.op == OP_REMOVE_LINK:
            snap = removed_by_rid.get(e.link_instance_rid)
            if snap is None:
                non_invertible.append(f"remove_link {e.link_instance_rid}: snapshot missing")
                continue
            inverse.append(EditOp(op=OP_ADD_LINK, link_type_rid=snap["link_type_rid"],
                                  src=snap["src"], dst=snap["dst"]))
        elif e.op == OP_DELETE_OBJECT:
            non_invertible.append(
                f"delete_object {e.target}: inverse requires instance snapshot (v1 unsupported)"
            )
    return tuple(inverse), tuple(non_invertible)


class _Missing:
    pass


_MISSING = _Missing()
