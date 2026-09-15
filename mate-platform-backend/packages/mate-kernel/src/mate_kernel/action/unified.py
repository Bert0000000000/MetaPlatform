"""ADR-0064 S2 —— Action 统一执行器的 edit 组装（双 repo 共用语义）。

把一次 proposal 执行的编辑来源统一装配成一个 EditOp 序列：

1. **声明式模板** —— proposal 携带的 edits（kind=edit_set 的自定义编辑）或
   ActionType.declarative_edits（缺省回落）；
2. **function 产物** —— ActionType.function_ref 非空时调用 function，返回值按
   两规约解释（ADR-0064 §2）：
   - 规约① ``{"edits": [...]}`` 纯对象 → 直接作为编辑模板（**混入其他字段
     报错**：edits 是本体，不允许两种规约混用）；
   - 规约② 普通映射 → 按 ActionType.parameters 短名映射为 ``set_property``
     （语义等价于 legacy function_result 回写；标记 ``is_compat`` 观察采用率）；
   - 非映射（None/标量）→ 忽略（与 legacy 回写一致：只有 dict 才合并）。

全部编辑**合并后同一事务**应用（repo 层保证）；批量上限沿用
``EDIT_BATCH_LIMIT``（10000，对齐 Palantir）。

提交准则（submission_criteria）求值不在此模块 —— 由 repo 侧用
``ActionService.evaluator`` 求值（与 legacy apply 同一语义）。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from .edit_set import EditOp, EditSetError, resolve_edit_templates

__all__ = [
    "UnifiedEditAssembly",
    "assemble_unified_edits",
]

# 与 pg_repo._RESERVED_PARAM_KEYS 同集合（平台注入的元数据参数，非用户参数）
RESERVED_PARAM_KEYS = frozenset({"provenance"})


@dataclass(frozen=True, slots=True)
class UnifiedEditAssembly:
    ops: tuple[EditOp, ...]
    # 规约②（普通映射 → set_property）是否被使用 —— D-5 is_compat 观察标记
    is_compat: bool = False
    # function 返回值走了哪条规约：None（未调 function）/ "edits" / "mapping"
    fn_spec: str | None = None
    # 组装统计（审计/expected_diff 用）
    stats: dict[str, Any] = field(default_factory=dict)


def _slug_of_param_rid(rid: str) -> str:
    """参数完整 rid → 短名（与 legacy 回写同规则）。"""
    parts = rid.split(".")
    return parts[-2] if parts[-1].startswith("v") else parts[-1]


def _param_rid_map(action_type: Any) -> dict[str, str]:
    """ActionType.parameters：短名 → 完整 prop rid。"""
    out: dict[str, str] = {}
    for p in action_type.parameters:
        out[_slug_of_param_rid(p.rid.rid)] = p.rid.rid
    return out


def assemble_unified_edits(
    *,
    action_type: Any,  # ActionType | None（ad-hoc 编辑无 ActionType）
    proposal_kind: str,
    parameters_raw: dict[str, Any],
    target_iid: str | None,
    invoke_function: Callable[[str, str | None, dict[str, Any]], Any] | None = None,
    now_iso: str = "",
) -> UnifiedEditAssembly:
    """proposal 执行 → 统一 EditOp 序列（模板解析 + function 两规约解释）。

    - kind=edit_set：parameters_raw = {"edits": [...], "parameters": {...}}；
      自定义 edits 缺省回落 ActionType.declarative_edits。
    - kind=action：parameters_raw = 扁平参数 dict（S3 分派后进入统一执行器的
      声明式/混合式 ActionType）；模板取 ActionType.declarative_edits。
    - 两者都无编辑且 function 无产物 → EditSetError（空编辑集 fail-fast）。

    ``invoke_function``：``(function_ref_rid, target_iid, parameters) -> Any``；
    传 None 表示不调 function（纯声明式）。submission_criteria 失败等执行前
    校验由 repo 侧先行完成。
    """
    raw = dict(parameters_raw or {})
    is_action_kind = proposal_kind == "action"

    # 1) 参数归一
    if is_action_kind:
        params = {k: v for k, v in raw.items() if k not in RESERVED_PARAM_KEYS}
        templates: list[dict[str, Any]] = []
        body_edits = False
    else:
        inner = raw.get("parameters")
        params = dict(inner) if isinstance(inner, dict) else {}
        templates = [dict(t) for t in (raw.get("edits") or [])]
        # 显式 body edits = 调用方已给**全集**：既替换声明式模板，也跳过 function
        # （function 的职责就是产出 edits；调用方自带时无需再算）。kind=action 的
        # 扁平参数不含 edits，恒走 ActionType 声明路径（declarative + function）。
        body_edits = bool(templates)

    # 2) 声明式模板缺省回落（无显式 body edits 时）
    used_declarative_fallback = False
    if not templates and action_type is not None and getattr(action_type, "declarative_edits", ()):
        templates = [dict(t) for t in action_type.declarative_edits]
        used_declarative_fallback = True

    # 3) function 产物两规约解释（仅声明路径；显式 body edits 跳过）
    fn_edits: list[dict[str, Any]] = []
    is_compat = False
    fn_spec: str | None = None
    fn_ref = getattr(action_type, "function_ref", None) if action_type is not None else None
    if fn_ref is not None and invoke_function is not None and not body_edits:
        result = invoke_function(fn_ref.rid, target_iid, params)
        if isinstance(result, dict):
            if "edits" in result:
                if set(result.keys()) != {"edits"} or not isinstance(result["edits"], list):
                    # 规约①禁止混用：edits 必须是纯对象（ADR-0064 §7 Q2 拍板）
                    raise EditSetError(
                        "function returned 'edits' mixed with other fields "
                        '(spec ① requires a pure {"edits": [...]} object)'
                    )
                fn_edits = [dict(t) for t in result["edits"]]
                fn_spec = "edits"
            elif result:
                # 规约②：普通映射 → set_property（短名 → 完整 rid，未知短名跳过
                # —— 与 legacy 回写一致；已是完整 rid 的原样使用）
                rid_map = _param_rid_map(action_type)
                if target_iid is None:
                    raise EditSetError(
                        "spec ② mapping requires a target_iid to attach set_property edits"
                    )
                for slug, value in result.items():
                    resolved = rid_map.get(slug) or (slug if slug.startswith("ont.") else None)
                    if resolved is None:
                        continue
                    if slug in params:
                        # legacy：显式参数优先，同名映射跳过
                        continue
                    fn_edits.append(
                        {
                            "op": "set_property",
                            "target": target_iid,
                            "property_rid": resolved,
                            "value": value,
                        }
                    )
                if fn_edits:
                    is_compat = True
                    fn_spec = "mapping"
        # 非映射（None / 标量）→ 忽略（与 legacy 回写一致）

    # 4) 合并解析（声明式 + fn edits；上限对合并后总数）
    ops = resolve_edit_templates(
        [*templates, *fn_edits],
        target_iid=target_iid,
        parameters=params,
        now_iso=now_iso,
    )
    if not ops:
        raise EditSetError(
            "unified executor assembled an empty edit set "
            "(no declarative edits, no body edits, no function output)"
        )

    return UnifiedEditAssembly(
        ops=tuple(ops),
        is_compat=is_compat,
        fn_spec=fn_spec,
        stats={
            "ops": len(ops),
            "declarative_templates": len(templates),
            "declarative_fallback": used_declarative_fallback,
            "fn_edits": len(fn_edits),
        },
    )
