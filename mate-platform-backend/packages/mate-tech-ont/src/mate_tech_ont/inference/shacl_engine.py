"""SHACL 推理引擎 (v3.2 W2).

纯 Python 实现的轻量级 SHACL 校验器 —— 不依赖 ``pyshacl`` 库,
直接消费简化的 JSON-LD shapes 描述。

Shapes 格式示例::

    {
        "shape_id": "UserShape",
        "target_class": "User",
        "constraints": [
            {"path": "name", "min_count": 1, "datatype": "string"},
            {"path": "email", "pattern": ".*@.*"},
        ],
    }

每个 instance 是普通 dict,通过 ``type``(或 ``class`` / ``rdf:type``)
键声明所属类,其余键即属性。支持的 constraint 关键字:

- ``min_count``  — 属性值最少个数(缺省 0)
- ``max_count``  — 属性值最多个数
- ``datatype``   — 期望类型(string / integer / number / boolean)
- ``pattern``    — 对字符串值做正则全匹配
- ``min_length`` — 字符串最小长度
- ``max_length`` — 字符串最大长度
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class SHACLViolation:
    """单条 SHACL 校验违例."""

    shape_id: str
    focus_node: str
    path: str
    value: Any = None
    message: str = ""
    severity: str = "Violation"


@dataclass(frozen=True, slots=True)
class SHACLResult:
    """validate 的返回."""

    conforms: bool
    violations: tuple[SHACLViolation, ...] = field(default_factory=tuple)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


# instance 中标识类的键(按优先级)。
_TYPE_KEYS = ("type", "class", "rdf:type", "@type")

# instance 中标识自身 ID 的键(用于 focus_node)。
_ID_KEYS = ("id", "@id", "node_id")

# SHACL datatype 名 → Python 类型谓词。
_DATATYPE_CHECKS: dict[str, tuple[type, ...]] = {
    "string": (str,),
    "integer": (int,),
    "number": (int, float),
    "boolean": (bool,),
}


def _instance_type(inst: dict[str, Any]) -> str | None:
    for key in _TYPE_KEYS:
        if key in inst and inst[key] is not None:
            return str(inst[key])
    return None


def _instance_id(inst: dict[str, Any], index: int) -> str:
    for key in _ID_KEYS:
        if key in inst and inst[key] is not None:
            return str(inst[key])
    return f"_:b{index}"


def _values_of(inst: dict[str, Any], path: str) -> list[Any]:
    """取出某个属性的所有值(单值 → 1 元素列表)。"""
    if path not in inst:
        return []
    val = inst[path]
    if val is None:
        return []
    if isinstance(val, list):
        return [v for v in val if v is not None]
    return [val]


class SHACLEngine:
    """纯 Python SHACL 校验引擎."""

    def validate(
        self,
        instances: list[dict[str, Any]],
        shapes: list[dict[str, Any]],
    ) -> SHACLResult:
        """对 *instances* 应用 *shapes*,返回 SHACLResult。

        遍历每个 shape,选出 ``target_class`` 匹配的实例,
        逐条检查 constraints,汇总所有违例。
        """
        violations: list[SHACLViolation] = []

        for shape in shapes:
            shape_id = str(shape.get("shape_id", shape.get("id", "UnknownShape")))
            target_class = shape.get("target_class")
            constraints = shape.get("constraints") or []

            if not target_class:
                logger.warning("shacl.shape_missing_target_class", shape_id=shape_id)
                continue

            for idx, inst in enumerate(instances):
                if _instance_type(inst) != target_class:
                    continue
                focus = _instance_id(inst, idx)
                for c in constraints:
                    violations.extend(
                        self._check_constraint(shape_id, focus, inst, c)
                    )

        result = SHACLResult(
            conforms=not violations,
            violations=tuple(violations),
        )
        logger.info(
            "shacl.validate",
            shapes=len(shapes),
            instances=len(instances),
            conforms=result.conforms,
            violations=len(result.violations),
        )
        return result

    # -- internals --

    def _check_constraint(
        self,
        shape_id: str,
        focus: str,
        inst: dict[str, Any],
        c: dict[str, Any],
    ) -> list[SHACLViolation]:
        path = str(c.get("path", ""))
        if not path:
            return []

        values = _values_of(inst, path)
        out: list[SHACLViolation] = []

        # min_count
        if "min_count" in c:
            need = int(c["min_count"])
            if len(values) < need:
                out.append(
                    SHACLViolation(
                        shape_id=shape_id,
                        focus_node=focus,
                        path=path,
                        value=None,
                        message=(
                            f"Property '{path}' requires at least "
                            f"{need} value(s), found {len(values)}"
                        ),
                    )
                )

        # max_count
        if "max_count" in c:
            cap = int(c["max_count"])
            if len(values) > cap:
                out.append(
                    SHACLViolation(
                        shape_id=shape_id,
                        focus_node=focus,
                        path=path,
                        value=values,
                        message=(
                            f"Property '{path}' allows at most "
                            f"{cap} value(s), found {len(values)}"
                        ),
                    )
                )

        # 仅在有值时才检查 datatype / pattern / length
        for v in values:
            out.extend(self._check_value(shape_id, focus, path, c, v))
        return out

    def _check_value(
        self,
        shape_id: str,
        focus: str,
        path: str,
        c: dict[str, Any],
        value: Any,
    ) -> list[SHACLViolation]:
        out: list[SHACLViolation] = []

        # datatype
        if "datatype" in c:
            expected = str(c["datatype"])
            types = _DATATYPE_CHECKS.get(expected)
            if types is not None:
                # bool 是 int 的子类,需特殊处理以免 boolean/integer 串扰
                ok = isinstance(value, types)
                if expected == "integer" and isinstance(value, bool):
                    ok = False
                if expected == "number" and isinstance(value, bool):
                    ok = False
                if not ok:
                    out.append(
                        SHACLViolation(
                            shape_id=shape_id,
                            focus_node=focus,
                            path=path,
                            value=value,
                            message=(
                                f"Property '{path}' value must be "
                                f"{expected}, got {type(value).__name__}"
                            ),
                        )
                    )

        # pattern (仅对字符串)
        if "pattern" in c:
            pat = str(c["pattern"])
            if not isinstance(value, str) or re.fullmatch(pat, value) is None:
                out.append(
                    SHACLViolation(
                        shape_id=shape_id,
                        focus_node=focus,
                        path=path,
                        value=value,
                        message=(
                            f"Property '{path}' value does not match "
                            f"pattern '{pat}'"
                        ),
                    )
                )

        # min_length / max_length (字符串或可计算长度的对象)
        if "min_length" in c or "max_length" in c:
            try:
                length = len(value)  # type: ignore[arg-type]
            except TypeError:
                length = len(str(value))
            if "min_length" in c and length < int(c["min_length"]):
                out.append(
                    SHACLViolation(
                        shape_id=shape_id,
                        focus_node=focus,
                        path=path,
                        value=value,
                        message=(
                            f"Property '{path}' length {length} < "
                            f"min_length {c['min_length']}"
                        ),
                    )
                )
            if "max_length" in c and length > int(c["max_length"]):
                out.append(
                    SHACLViolation(
                        shape_id=shape_id,
                        focus_node=focus,
                        path=path,
                        value=value,
                        message=(
                            f"Property '{path}' length {length} > "
                            f"max_length {c['max_length']}"
                        ),
                    )
                )

        return out
