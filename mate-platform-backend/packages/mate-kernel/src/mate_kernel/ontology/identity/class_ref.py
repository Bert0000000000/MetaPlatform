r"""ClassRef —— 12 基元之 1。

任何 ObjectType / LinkType / ActionType / Interface / Property / Function / Individual 等
的稳定句柄。

`rid` 形如 `ont.<tenant>.<kind>.<rest>`，其中：
- tenant: 1-64 字符 `[a-z0-9_-]`
- kind ∈ {cls, ver, prop, obj, link, act, if, ind, lnk, ax, fn, oset}
- rest: 1-200 字符 `[a-z0-9_:\-]`，可包含 `.` 分段（如 `ont.acme.ind.order.10086`）

完整形如：
  - 类型句柄：ont.<tenant>.cls|prop|obj|link|act|if.<slug>
  - 版本快照：ont.<tenant>.ver.<class_ref>.<version_tag>
  - 实例：ont.<tenant>.ind.<type>.<pk>
  - 关系实例：ont.<tenant>.lnk.<link_type>.<sid>.<did>
  - 函数：ont.<tenant>.fn.<slug>.v<n>

与 messaging/schemas.py:17-74 风格一致。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_VALID_KINDS = (
    "cls", "ver", "prop", "obj", "link", "act", "if",
    "ind", "lnk", "ax", "fn", "oset",
)
_RID_RE = re.compile(
    rf"^ont\.[a-z0-9_-]{{1,64}}\.(?:{'|'.join(_VALID_KINDS)})\.[a-z0-9_:\-.]{{1,200}}$"
)


@dataclass(frozen=True, slots=True)
class ClassRef:
    rid: str

    def __post_init__(self) -> None:
        if not _RID_RE.match(self.rid):
            raise ValueError(
                f"ClassRef.rid must match {_RID_RE.pattern}, got {self.rid!r}"
            )

    def __str__(self) -> str:
        return self.rid
