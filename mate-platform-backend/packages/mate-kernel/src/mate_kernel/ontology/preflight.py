"""preflight — proposal 三闸门联动校验（ONT-GATE-01，2026-09-14）。

AI/用户 proposal 落库前的强制门禁，三层串联：

  ① schema   —— 参数/属性对类型声明（ObjectType properties / ActionType
                parameters）的结构校验（validate_instance /
                validate_model / 轻量参数检查）
  ② SHACL    —— 约束合规（shape_from_object_type 合成 NodeShape +
                validate_shacl，W3C Violation 语义）
  ③ Axiom    —— dry-run 冲突推演（reasoning 引擎：子类环 / disjoint /
                domain-range / equivalence，见 reasoning/conflicts.py）

任何 violation 级发现 → ``blocked=True`` → execute 拒绝（409）。

设计约束：
- 全部纯函数、无 IO —— 数据（类型/公理/实例）由调用方（v2 api 经
  tenant-scoped repo）取好传入；同一输入永远同一结论，可直接回归测试。
- 报告是无状态快照：propose 时算一份给 UI 展示，execute 时**重算**一份
  作为权威判定（本体在窗口期可能已变化，快照不作准）。
- 闸门不替代 HITL（B3 决策：每次 ≥1 人确认）——它是 HITL 之前的机器
  预检 + HITL 之后的强制底线。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .types.action_type import ActionType
from .types.object_type import ObjectType
from .validation_ops import validate_instance, validate_model

# ── 报告结构 ────────────────────────────────────────────────────────────────

# 报告状态词汇：把「阻断」细分为可判定的五种结果。调用方（execute 闸）必须按
# status 决策，**不得只读 blocked 就把异常当放行**。
STATUS_PASSED = "passed"  # 所有适用闸门都跑过且通过
STATUS_VIOLATION = "violation"  # 至少一项 violation 级发现
STATUS_NOT_APPLICABLE = "not_applicable"  # 该 kind 不设闸（报告返回 None 表示）
STATUS_PARTIAL = "partial"  # 部分闸门完成、部分不可用（适用闸门未跑全）
STATUS_UNAVAILABLE = "unavailable"  # 适用闸门全部不可用（无法判定）

_BLOCKING_STATUSES = frozenset({STATUS_VIOLATION, STATUS_PARTIAL, STATUS_UNAVAILABLE})


@dataclass(frozen=True, slots=True)
class PreflightReport:
    """三闸门联合报告（可 JSON 序列化，随 proposal 响应下发）。"""

    blocked: bool
    schema: dict[str, Any] = field(default_factory=dict)
    shacl: dict[str, Any] = field(default_factory=dict)
    axioms: list[dict[str, Any]] = field(default_factory=list)
    summary: str = ""
    status: str = STATUS_PASSED
    unavailable: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "blocked": self.blocked,
            "status": self.status,
            "unavailable": list(self.unavailable),
            "schema": self.schema,
            "shacl": self.shacl,
            "axioms": list(self.axioms),
            "summary": self.summary,
        }


def _finish(
    schema: dict[str, Any],
    shacl: dict[str, Any],
    axioms: list[dict[str, Any]],
    *,
    status: str | None = None,
    unavailable: tuple[str, ...] = (),
) -> PreflightReport:
    """汇总三闸门为一份报告。

    ``status`` 仅用于显式声明 **不可用 / 部分完成**（调用方在抓异常后传入）；
    violation 由本函数从闸门数据判定，且**优先于**不可用（有断言胜过无断言）。
    """
    schema_bad = bool(schema.get("errors"))
    shacl_bad = not bool(shacl.get("conforms", True)) if shacl.get("checked") else False
    axiom_bad = any(a.get("severity") == "violation" for a in axioms)
    violation = schema_bad or shacl_bad or axiom_bad
    warns = len(schema.get("warnings") or []) + sum(
        1 for a in axioms if a.get("severity") == "warning"
    )
    parts: list[str] = []
    if schema_bad:
        parts.append(f"schema {len(schema.get('errors') or [])} 项错误")
    if shacl_bad:
        parts.append(f"SHACL {len(shacl.get('violations') or [])} 项 Violation")
    if axiom_bad:
        parts.append(f"Axiom {sum(1 for a in axioms if a.get('severity') == 'violation')} 项冲突")
    if warns:
        parts.append(f"{warns} 项提示")

    if violation:
        final = STATUS_VIOLATION
        summary = "预检阻断：" + "；".join(parts)
    elif status in (STATUS_UNAVAILABLE, STATUS_PARTIAL):
        final = status
        gates = "、".join(unavailable) or "部分闸门"
        label = "不可用" if final == STATUS_UNAVAILABLE else "部分完成"
        summary = f"预检{label}：{gates} 校验未执行（禁止执行）"
    else:
        final = STATUS_PASSED
        if parts:
            summary = "预检通过（" + "；".join(parts) + "，未达阻断级）"
        else:
            summary = "预检通过"
    return PreflightReport(
        blocked=final in _BLOCKING_STATUSES,
        schema=schema,
        shacl=shacl,
        axioms=axioms,
        summary=summary,
        status=final,
        unavailable=unavailable,
    )


def build_gate_report(
    *,
    schema: dict[str, Any],
    shacl: dict[str, Any],
    axioms: list[dict[str, Any]],
    applicable: tuple[str, ...],
    unavailable: tuple[str, ...] = (),
) -> PreflightReport:
    """由调用方（API 层）按**逐闸门可用性**组装报告。

    适用闸门全部不可用 → ``unavailable``；部分不可用 → ``partial``；两者都 ``blocked``。
    ``unavailable`` 中的闸门应由调用方传入「未执行」占位（``checked=False``），
    不得以空数据冒充「通过」。
    """
    missing = tuple(g for g in applicable if g in set(unavailable))
    if missing and len(missing) == len(applicable):
        status = STATUS_UNAVAILABLE
    elif missing:
        status = STATUS_PARTIAL
    else:
        status = STATUS_PASSED
    return _finish(schema, shacl, axioms, status=status, unavailable=missing)


# ── ① schema 闸 ────────────────────────────────────────────────────────────

_FORMAT_CHECKS: dict[str, tuple[type, ...]] = {
    "string": (str,),
    "integer": (int,),  # bool 是 int 子类，显式排除
    "double": (int, float),
    "boolean": (bool,),
}


def check_action_parameters(action_type: ActionType, parameters: dict[str, Any]) -> dict[str, Any]:
    """ActionType.parameters（Property 元组）对传入 parameters 的结构校验。

    - 必填（``nullable=False``）缺参 → error
    - 未声明的多余参数 → warning（宽容：编辑模板可用动态占位）
    - 粗类型检查（format ∈ string/integer/double/boolean）；富格式
      （geojson/latlon/timeseries/struct/vector…）结构校验留给 apply 路径
    """
    errors: list[str] = []
    warnings: list[str] = []
    by_key: dict[str, Any] = {}
    required: list[tuple[tuple[str, ...], Any]] = []  # (别名元组, Property)
    for p in action_type.parameters:
        # 别名索引：rid 全名 / slug（尾段去版本）/ title —— AI 抽取三者皆可能
        rid_str = p.rid.rid
        slug = rid_str.split(".")[-2] if rid_str.count(".") >= 2 else rid_str
        aliases = tuple(dict.fromkeys(a for a in (rid_str, slug, p.title) if a))
        for a in aliases:
            by_key.setdefault(a, p)
        if not p.nullable:
            required.append((aliases, p))

    for key, value in (parameters or {}).items():
        if str(key) == "provenance":
            continue  # ONT-PROV-01 保留键（平台元数据，非业务参数）
        p = by_key.get(str(key))
        if p is None:
            warnings.append(f"未声明参数: {key}")
            continue
        expected = _FORMAT_CHECKS.get(str(p.format))
        if expected and value is not None:
            if isinstance(value, bool) and bool not in expected:
                errors.append(f"参数 {key} 期望 {p.format}，收到 bool")
            elif not isinstance(value, expected):
                errors.append(f"参数 {key} 期望 {p.format}，收到 {type(value).__name__}")

    for aliases, p in required:
        if not any(a in (parameters or {}) for a in aliases):
            errors.append(f"缺少必填参数: {p.title or p.rid.rid}")

    return {"checked": True, "errors": errors, "warnings": warnings}


# ── ③ Axiom 闸（dry-run 冲突推演） ─────────────────────────────────────────


def _split_axiom_records(records: list[dict[str, Any]]) -> dict[str, list[tuple[str, str]]]:
    """ont_axiom 记录（{rid,kind,operands,enabled}）按 kind 拆成二元组。

    仅取二元 operands；kind 命名兼容 builtin（subclass/same_as/disjoint/
    equivalent）与 reasoning 引擎扩展。未知 kind 忽略（公理注册面可扩展，
    闸门只消费它认识的）。
    """
    out: dict[str, list[tuple[str, str]]] = {
        "subclass": [],
        "equivalent": [],
        "disjoint": [],
    }
    for r in records or []:
        if not r.get("enabled", True):
            continue
        kind = str(r.get("kind") or "")
        ops = [str(o) for o in (r.get("operands") or [])]
        if len(ops) != 2:
            continue
        if kind == "subclass":
            out["subclass"].append((ops[0], ops[1]))
        elif kind in ("equivalent", "same_as"):
            # same_as 实例级等价在 reasoning 中单列；闸门按类型等价消费
            out["equivalent"].append((ops[0], ops[1]))
        elif kind == "disjoint":
            out["disjoint"].append((ops[0], ops[1]))
    return out


def _detect_axiom_conflicts(
    *,
    subclass_axioms: list[tuple[str, str]],
    equivalent_axioms: list[tuple[str, str]],
    disjoint_axioms: list[tuple[str, str]],
    type_assertions: list[tuple[str, str]],
    property_assertions: list[dict[str, Any]] | None = None,
    domain_range: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """统一冲突检测入口（转发 reasoning.conflicts.detect_axiom_conflicts）。

    reasoning 引擎（ONT-G16 扩展）是唯一实现源；此处只做协议适配
    （dataclass → dict），保证 preflight 与引擎解耦。
    """
    from .reasoning.conflicts import detect_axiom_conflicts

    conflicts = detect_axiom_conflicts(
        subclass_axioms=subclass_axioms,
        equivalent_axioms=equivalent_axioms,
        disjoint_axioms=disjoint_axioms,
        type_assertions=type_assertions,
        property_assertions=property_assertions or [],
        domain_range=domain_range or [],
    )
    return [
        {
            "rule": c.rule,
            "severity": c.severity,
            "message": c.message,
            "subjects": list(c.subjects),
        }
        for c in conflicts
    ]


def _hierarchy_edges(types: list[ObjectType]) -> list[tuple[str, str]]:
    """ObjectType.parent_class（EXP-01 浅层级）→ subclass 边。"""
    edges: list[tuple[str, str]] = []
    for t in types or []:
        if t.parent_class is not None:
            edges.append((t.rid.rid, t.parent_class.rid))
    return edges


# ── 三个 proposal kind 的门禁 ───────────────────────────────────────────────


def _normalize_props(ot: ObjectType, props: dict[str, Any]) -> dict[str, Any]:
    """props 键别名归一（rid / slug / title → rid）。

    validate_instance 只认 slug/rid，SHACL shape path 是 rid；AI 抽取可能
    给 title —— 统一归一后两闸共用同一份数据。
    """
    by_alias: dict[str, str] = {}
    for p in ot.properties:
        prid = p.rid.rid
        slug = prid.split(".")[-2] if prid.count(".") >= 2 else prid
        by_alias[prid] = prid
        by_alias.setdefault(slug, prid)
        if p.title:
            by_alias.setdefault(p.title, prid)
    return {by_alias.get(str(k), str(k)): v for k, v in (props or {}).items()}


# ── 逐闸门原语（供 API 层按闸门分别捕获异常 → 区分 partial / unavailable）────


def gate_schema_instance(ot: ObjectType, props: dict[str, Any]) -> dict[str, Any]:
    """① schema 闸（create_instance）：属性对类型声明的结构校验。"""
    return {
        "checked": True,
        **validate_instance(ot, _normalize_props(ot, dict(props or {}))),
    }


def gate_shacl_instance(ot: ObjectType, props: dict[str, Any]) -> dict[str, Any]:
    """② SHACL 闸（create_instance）：合成候选个体过 NodeShape。"""
    from .shacl import shape_from_object_type, validate_shacl

    rid_props = _normalize_props(ot, dict(props or {}))
    shacl = validate_shacl(
        [{"rid": "preflight:candidate", "class_rid": ot.rid.rid, "props": rid_props}],
        [shape_from_object_type(ot)],
        subclass_axioms=None,
    )
    return {"checked": True, **{k: v for k, v in shacl.items() if k != "stats"}}


def gate_schema_model(ot: ObjectType) -> dict[str, Any]:
    """① schema 闸（model_type）：静态模型验证。"""
    return {"checked": True, **validate_model(ot)}


def gate_schema_action(action_type: ActionType, parameters: dict[str, Any]) -> dict[str, Any]:
    """① schema 闸（action）：ActionType 参数结构校验。"""
    return check_action_parameters(action_type, dict(parameters or {}))


def gate_axioms_instance(
    ot: ObjectType,
    *,
    axiom_records: list[dict[str, Any]] | None = None,
    all_types: list[ObjectType] | None = None,
) -> list[dict[str, Any]]:
    """③ Axiom 闸（create_instance）：候选个体类型断言 dry-run。"""
    pairs = _split_axiom_records(axiom_records or [])
    subclass = list(pairs["subclass"]) + _hierarchy_edges(all_types or [])
    return _detect_axiom_conflicts(
        subclass_axioms=subclass,
        equivalent_axioms=pairs["equivalent"],
        disjoint_axioms=pairs["disjoint"],
        type_assertions=[("preflight:candidate", ot.rid.rid)],
    )


def gate_axioms_model(
    ot: ObjectType,
    *,
    axiom_records: list[dict[str, Any]] | None = None,
    existing_types: list[ObjectType] | None = None,
) -> list[dict[str, Any]]:
    """③ Axiom 闸（model_type）：提议层级并入公理集做环/互斥推演。"""
    pairs = _split_axiom_records(axiom_records or [])
    subclass = list(pairs["subclass"]) + _hierarchy_edges(existing_types or [])
    if ot.parent_class is not None:
        # dry-run：把提议层级并入公理集，环/互斥由推演器判定
        subclass.append((ot.rid.rid, ot.parent_class.rid))
    return _detect_axiom_conflicts(
        subclass_axioms=subclass,
        equivalent_axioms=pairs["equivalent"],
        disjoint_axioms=pairs["disjoint"],
        type_assertions=[(ot.rid.rid, ot.rid.rid)],  # 自身类型断言（参与闭包）
    )


# ── 三个 proposal kind 的门禁（三闸门齐备时一步封装）────────────────────────


def preflight_create_instance(
    ot: ObjectType,
    props: dict[str, Any],
    *,
    axiom_records: list[dict[str, Any]] | None = None,
    all_types: list[ObjectType] | None = None,
) -> PreflightReport:
    """kind=create_instance：schema + SHACL（合成候选个体）+ Axiom dry-run。"""
    return _finish(
        gate_schema_instance(ot, props),
        gate_shacl_instance(ot, props),
        gate_axioms_instance(ot, axiom_records=axiom_records, all_types=all_types),
    )


def preflight_model_type(
    ot: ObjectType,
    *,
    existing_types: list[ObjectType] | None = None,
    axiom_records: list[dict[str, Any]] | None = None,
) -> PreflightReport:
    """kind=model_type：schema（静态模型验证）+ Axiom（提议层级环/互斥推演）。

    无实例数据 → SHACL 闸跳过（checked=False，属**不适用**而非不可用）。
    """
    return _finish(
        gate_schema_model(ot),
        {"checked": False, "conforms": True, "violations": [], "reason": "无实例数据，跳过"},
        gate_axioms_model(ot, axiom_records=axiom_records, existing_types=existing_types),
    )


def preflight_action(
    action_type: ActionType,
    parameters: dict[str, Any],
) -> PreflightReport:
    """kind=action：ActionType 参数 schema 闸（①层）。

    ②/③层不适用（action 不产生类型层级断言；目标实例的后置状态由
    apply 事务内校验兜底）。
    """
    return _finish(
        gate_schema_action(action_type, parameters),
        {"checked": False, "conforms": True, "violations": []},
        [],
    )
