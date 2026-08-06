"""Ontology 序列化与 rid 编解码。

为 12 基元提供：
- `to_dict / from_dict`：与 OpenAPI / Function Sandbox 入参 / Outbox 事件载荷对齐
- `encode_rid / decode_rid`：URL/路径安全的 rid codec（`:.-_` ↔ `%3A %2E %2D %5F`）
- `rid_split / rid_join`：按 rid 形如 `ont.<tenant>.<kind>.<rest>` 解析 / 拼接
"""

from .codec import encode_rid, decode_rid, rid_split, rid_join
from .serde import to_dict, from_dict

__all__ = [
    "encode_rid",
    "decode_rid",
    "rid_split",
    "rid_join",
    "to_dict",
    "from_dict",
]
