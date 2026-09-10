"""EXP-02：值类型注册表（value-type registry）—— G14。

Palantir 的 value types 是类型化值定义（decimal/vector/geo…）的注册中心；
Property.type_id 引用它。本模块提供内核级注册表 + 校验：

- 内置类型集（string/integer/…/vector/struct）与 PropertyFormat 对齐；
- format 与 type_id 一致性校验（type_id 的声明 format 必须等于 Property.format）；
- 自定义值类型可注册（register_value_type），生产 profile 应经 ADR。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .property_ import Property, PropertyFormat


@dataclass(frozen=True, slots=True)
class ValueType:
    type_id: str
    format: PropertyFormat
    description: str = ""
    # 结构化附加参数（vector dims / decimal precision 等），元数据级
    params: dict[str, Any] = field(default_factory=dict)


_BUILTINS: tuple[ValueType, ...] = (
    ValueType("string", PropertyFormat.STRING, "UTF-8 字符串"),
    ValueType("integer", PropertyFormat.INTEGER, "64 位整数"),
    ValueType("double", PropertyFormat.DOUBLE, "IEEE754 双精度"),
    ValueType("boolean", PropertyFormat.BOOLEAN, "布尔"),
    ValueType("date", PropertyFormat.DATE, "ISO 日期（无时间）"),
    ValueType("timestamp", PropertyFormat.TIMESTAMP, "ISO 时间戳（TZ）"),
    ValueType("decimal", PropertyFormat.DOUBLE, "十进制金额（精度见 params）"),
    ValueType("marking", PropertyFormat.MARKING, "安全标记引用"),
    ValueType("geojson", PropertyFormat.GEOJSON, "GeoJSON geometry"),
    ValueType("latlon", PropertyFormat.LATLON, "(纬, 经) 二元组"),
    ValueType("timeseries", PropertyFormat.TIMESERIES, "时序引用（series rid）"),
    ValueType("image", PropertyFormat.IMAGE, "媒体：图片（Storage rid/URI）"),
    ValueType("audio", PropertyFormat.AUDIO, "媒体：音频"),
    ValueType("video", PropertyFormat.VIDEO, "媒体：视频"),
    ValueType("struct", PropertyFormat.STRUCT, "嵌套结构（struct_fields 定义）"),
    ValueType("vector", PropertyFormat.VECTOR, "embedding 向量（dims 见 params）",
              {"dims": 0}),  # 0 = 未约束
)

_REGISTRY: dict[str, ValueType] = {vt.type_id: vt for vt in _BUILTINS}


def register_value_type(vt: ValueType, *, replace: bool = False) -> None:
    if vt.type_id in _REGISTRY and not replace:
        raise ValueError(
            f"value type {vt.type_id!r} already registered; pass replace=True"
        )
    _REGISTRY[vt.type_id] = vt


def get_value_type(type_id: str) -> ValueType | None:
    return _REGISTRY.get(type_id)


def list_value_types() -> list[ValueType]:
    return sorted(_REGISTRY.values(), key=lambda vt: vt.type_id)


def validate_property(p: Property) -> list[str]:
    """值类型校验 —— 返回违规清单（空 = 通过）。

    规则：
    1. type_id 未注册 → 违规（Palantir：属性必须引用注册值类型）；
    2. 注册 format 与 Property.format 不一致 → 违规；
    3. STRUCT 无 struct_fields → 违规（dataclass 已挡，此处双保险）。
    """
    violations: list[str] = []
    vt = _REGISTRY.get(p.type_id)
    if vt is None:
        violations.append(
            f"property {p.rid.rid} references unregistered value type {p.type_id!r}"
        )
    elif vt.format is not p.format:
        violations.append(
            f"property {p.rid.rid} format {p.format.value!r} != "
            f"value type {p.type_id!r} declared format {vt.format.value!r}"
        )
    if p.format is PropertyFormat.STRUCT and not p.struct_fields:
        violations.append(f"struct property {p.rid.rid} requires struct_fields")
    return violations
