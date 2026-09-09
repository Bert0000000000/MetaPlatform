"""Property —— 12 基元之 3。

一个类型的字段定义（主键/标题/显示/格式化/required/derived 都挂在它身上）。
不可变。

EXP-02（2026-09-10，D4 拍板）扩展：
- struct 嵌套字段（struct_fields，format=STRUCT 时生效）；
- 数组/多值（array + reducer，v1 元数据级，reducer=first/latest）；
- 派生属性（derived: DerivedSpec —— 查询时计算，v1 声明式聚合三算子）；
- 共享属性标记（shared —— 跨类型复用同一 Property rid）；
- description（AI 可导航性元数据，G16）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from ..identity.class_ref import ClassRef


class PropertyFormat(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    DOUBLE = "double"
    BOOLEAN = "boolean"
    DATE = "date"
    TIMESTAMP = "timestamp"
    MARKING = "marking"  # 安全标记
    # SAL-07（2026-09-08）：富属性一等格式（时序/地理/媒体）
    GEOJSON = "geojson"          # 地理（GeoJSON geometry）
    LATLON = "latlon"            # 地理（纬,经 二元组）
    TIMESERIES = "timeseries"    # 时序引用（series rid）
    IMAGE = "image"              # 媒体：图片（Storage rid/URI）
    AUDIO = "audio"              # 媒体：音频
    VIDEO = "video"              # 媒体：视频
    # EXP-02（2026-09-10）：结构化嵌套 + 向量（AI-09 接 pgvector/算子）
    STRUCT = "struct"            # 嵌套 struct（struct_fields 定义形状）
    VECTOR = "vector"            # embedding 向量（dims 由 value-type 声明）


@dataclass(frozen=True, slots=True)
class DerivedSpec:
    """派生属性规格（D4：v1 声明式聚合，function_ref 进 v2）。

    fn ∈ {count, sum, avg}；over_link = LinkType rid；
    方向由 LinkType 端点决定（本类是 src 端 → 遍历到 dst 对端，反之亦然）；
    field = sum/avg 的对端属性 rid（count 无需）。
    安全语义：派生值继承计算涉及对象的权限（Palantir derived-properties 同语义）。
    """

    fn: str
    over_link: str
    field: str | None = None

    def __post_init__(self) -> None:
        if self.fn not in ("count", "sum", "avg"):
            raise ValueError(
                f"DerivedSpec.fn must be count/sum/avg (v1), got {self.fn!r}"
            )
        if self.fn in ("sum", "avg") and not self.field:
            raise ValueError(f"DerivedSpec.fn={self.fn!r} requires field")
        if not self.over_link:
            raise ValueError("DerivedSpec.over_link must be a LinkType rid")


@dataclass(frozen=True, slots=True)
class Property:
    rid: ClassRef
    type_id: str  # 值类型 rid，引用 value-type 注册表
    nullable: bool
    primary_key: bool
    title: str
    format: PropertyFormat
    # ── EXP-02 扩展（全部带默认值，向后兼容）──
    description: str = ""
    struct_fields: tuple["Property", ...] = ()  # format=STRUCT 时的嵌套定义
    array: bool = False
    reducer: str | None = None  # 多值归约：first / latest（v1 元数据级）
    derived: DerivedSpec | None = None
    shared: bool = False  # 共享属性（跨类型复用；同一 rid 多类型引用）

    def __post_init__(self) -> None:
        if self.reducer is not None and self.reducer not in ("first", "latest"):
            raise ValueError(
                f"Property.reducer must be first/latest/None, got {self.reducer!r}"
            )
        if self.derived is not None and self.primary_key:
            raise ValueError("derived property cannot be a primary key")
        if self.format is PropertyFormat.STRUCT and not self.struct_fields:
            raise ValueError(
                "STRUCT property requires struct_fields (non-empty)"
            )


def ai_metadata_struct(rid: ClassRef) -> "Property":
    """EXP-02 内置模板：AI 输出属性的标准元数据 struct。

    Palantir 调研材料 02 §Structs：LLM 输出是一等公民，值自带
    llmConfidence / llmReasoning / source 元数据。AI 写入路径（SAL-04b
    text-to-ontology ingest）落 struct 值时统一带这三个字段。
    """
    parts = rid.rid.rsplit(".", 1)
    stem = parts[0] if parts else rid.rid
    return Property(
        rid=rid,
        type_id="struct",
        nullable=True,
        primary_key=False,
        title="aiMetadata",
        format=PropertyFormat.STRUCT,
        description="AI 输出元数据（置信度/推理/来源）",
        struct_fields=(
            Property(
                rid=ClassRef(f"{stem}.confidence.v1"),
                type_id="double", nullable=True, primary_key=False,
                title="llmConfidence", format=PropertyFormat.DOUBLE,
            ),
            Property(
                rid=ClassRef(f"{stem}.reasoning.v1"),
                type_id="string", nullable=True, primary_key=False,
                title="llmReasoning", format=PropertyFormat.STRING,
            ),
            Property(
                rid=ClassRef(f"{stem}.source.v1"),
                type_id="string", nullable=True, primary_key=False,
                title="source", format=PropertyFormat.STRING,
            ),
        ),
    )
