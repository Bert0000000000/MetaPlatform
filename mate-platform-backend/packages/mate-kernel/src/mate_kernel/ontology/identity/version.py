"""Version —— 12 基元之 2。

不可变版本快照，所有 schema 变更都生成新 Version，旧版可回放。
parent_rid 可空（首版）；change_set 描述差异。

ONT-VERSION-MECHANISM（2026-09-23）：版本必须携带**不可变定义快照**
（`definition` + `checksum`）—— 否则"历史"只是同族 RID 列表，无法回读旧定义。
`version_no` 是该类内的单调序号；`definition` 是序列化后的完整模型定义。
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .class_ref import ClassRef

_RID_RE = __import__("re").compile(r"^ont\.[a-z0-9_-]{1,64}\.ver\.[A-Za-z0-9_:-]{1,200}\.v\d+$")


def definition_checksum(definition: dict[str, Any]) -> str:
    """模型定义的内容指纹（排序键 + 紧凑 JSON → sha256 前 16 位）。

    **唯一的指纹算法**：版本快照（写）与"当前生效定义"（读）必须用同一个函数，
    否则乐观并发比对与"当前生效版本"判定都会失真。
    """
    blob = json.dumps(definition, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


class VersionConflict(RuntimeError):
    """乐观并发冲突 —— 声明的 `expected_checksum` 与当前生效定义不一致。

    定义在**基元层**（而非某个 repo 实现）：PG 与 in-memory 两个仓库共用同一冲突
    类型，API 层才能一致地把它翻译成 409（见 ADR-0080 §2.5）。
    """


@dataclass(frozen=True, slots=True)
class Version:
    rid: str
    class_ref: ClassRef
    parent_rid: str | None
    created_at: datetime
    author: str
    change_set: tuple[str, ...] = field(default_factory=tuple)
    # ── ONT-VERSION-MECHANISM：不可变定义快照 ──
    definition: dict[str, Any] | None = None
    checksum: str = ""
    version_no: int = 0
    # 必要依赖（property / interface / parent class rid，排序去重）—— 影响分析用
    dependencies: tuple[str, ...] = ()
    status: str = "published"  # 已发布快照（草稿留在 ont_schema_wip，不占版本）

    def __post_init__(self) -> None:
        if not _RID_RE.match(self.rid):
            raise ValueError(f"Version.rid must match {_RID_RE.pattern}, got {self.rid!r}")
        if self.parent_rid is not None and not _RID_RE.match(self.parent_rid):
            raise ValueError(
                f"Version.parent_rid must match pattern or be None, got {self.parent_rid!r}"
            )
