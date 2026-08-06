"""Version —— 12 基元之 2。

不可变版本快照，所有 schema 变更都生成新 Version，旧版可回放。
parent_rid 可空（首版）；change_set 描述差异。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .class_ref import ClassRef

_RID_RE = __import__("re").compile(
    r"^ont\.[a-z0-9_-]{1,64}\.ver\.[A-Za-z0-9_:-]{1,200}\.v\d+$"
)


@dataclass(frozen=True, slots=True)
class Version:
    rid: str
    class_ref: ClassRef
    parent_rid: str | None
    created_at: datetime
    author: str
    change_set: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not _RID_RE.match(self.rid):
            raise ValueError(
                f"Version.rid must match {_RID_RE.pattern}, got {self.rid!r}"
            )
        if self.parent_rid is not None and not _RID_RE.match(self.parent_rid):
            raise ValueError(
                f"Version.parent_rid must match pattern or be None, got {self.parent_rid!r}"
            )
