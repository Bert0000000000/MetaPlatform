"""rid 编解码：URL/路径安全 + 结构化解析。"""

from __future__ import annotations

import re
from dataclasses import dataclass

_VALID_KINDS = (
    "cls", "ver", "prop", "obj", "link", "act", "if",
    "ind", "lnk", "ax", "fn", "oset",
)
_SEGMENT_SAFE = re.compile(r"^[A-Za-z0-9_-]+$")
_SPLIT_RE = re.compile(r"^ont\.([a-z0-9_-]{1,64})\.([a-z]+)\.(.+)$")


@dataclass(frozen=True, slots=True)
class RidParts:
    tenant: str
    kind: str
    rest: str

    def __post_init__(self) -> None:
        if self.kind not in _VALID_KINDS:
            raise ValueError(f"unknown rid kind: {self.kind!r}")


def encode_rid(rid: str) -> str:
    """URL/路径安全编码：: . - _ → %3A %2E %2D %5F。"""
    return (
        rid.replace(":", "%3A")
        .replace(".", "%2E")
        .replace("-", "%2D")
        .replace("_", "%5F")
    )


def decode_rid(encoded: str) -> str:
    """反向解码。"""
    return (
        encoded.replace("%3A", ":")
        .replace("%2E", ".")
        .replace("%2D", "-")
        .replace("%5F", "_")
    )


def rid_split(rid: str) -> RidParts:
    """按 `ont.<tenant>.<kind>.<rest>` 解析。"""
    m = _SPLIT_RE.match(rid)
    if not m:
        raise ValueError(f"invalid rid: {rid!r}")
    return RidParts(tenant=m.group(1), kind=m.group(2), rest=m.group(3))


def rid_join(tenant: str, kind: str, rest: str) -> str:
    """反向拼接。"""
    if not _SEGMENT_SAFE.match(tenant):
        raise ValueError(f"invalid tenant: {tenant!r}")
    if kind not in _VALID_KINDS:
        raise ValueError(f"unknown kind: {kind!r}")
    return f"ont.{tenant}.{kind}.{rest}"
