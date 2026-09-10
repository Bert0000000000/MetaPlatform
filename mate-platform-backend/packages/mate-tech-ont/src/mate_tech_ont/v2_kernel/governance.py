"""GOV-16~19：治理四件套 —— 使用量 / 生命周期 / 反模式 lint / 时序存储。

Palantir 对位（调研材料 05 / 02）：
- GOV-16 使用量（Reads/Writes per type）→ 变更影响评估与退役决策数据驱动；
- GOV-17 Cleanup 三级处置（Snooze/Deprecate/Delete）+ 基于使用的删除保护；
- GOV-18 反模式 lint（8 大反模式可自动化的子集）；
- GOV-19 时间序列属性背后的 series store（Time Machine 反模式的正解）。
"""

from __future__ import annotations

import re
from typing import Any

__all__ = [
    "LIFECYCLE_ACTIONS",
    "lint_anti_patterns",
]

# GOV-17：合法生命周期动作
LIFECYCLE_ACTIONS = ("snooze", "deprecate", "delete")

# GOV-18：Kitchen Sink 技术列模式（Pipeline 元数据不入属性 —— 调研材料 02）
_TECH_COLUMN_RE = re.compile(r"^(dt|etl|ingest|load|batch|pipeline)[_-]?", re.IGNORECASE)
# Misnomer：歧义词必须限定（monetaryValue 非 value）
_VAGUE_NAMES = {"value", "data", "info", "amount", "name_id", "type", "status2"}


def lint_anti_patterns(
    object_types: list[Any],
    action_types: list[Any] = (),
    *,
    god_object_props: int = 30,
    action_sprawl: int = 10,
) -> list[dict[str, Any]]:
    """GOV-18：反模式检查（可自动化子集，症状指标对齐调研材料 02 §三）。

    检查项：
    - God Object：单类型属性数 > god_object_props（症状：大量常 null 属性的代理指标）
    - Kitchen Sink：属性 slug 命中技术列模式（dt_/etl_/ingest_…）
    - The Misnomer：属性/类型用歧义词（value/data/info/amount…）
    - Action Sprawl：单类型 CRUD 化 Action 数 > action_sprawl
    返回 [{pattern, subject, detail, hint}]。
    """
    findings: list[dict[str, Any]] = []
    actions_by_type: dict[str, int] = {}
    for at in action_types:
        for on in getattr(at, "on", ()) or ():
            key = on.rid if hasattr(on, "rid") else str(on)
            actions_by_type[key] = actions_by_type.get(key, 0) + 1

    for ot in object_types:
        rid = ot.rid.rid
        # God Object
        if len(ot.properties) > god_object_props:
            findings.append(
                {
                    "pattern": "god_object",
                    "subject": rid,
                    "detail": f"{len(ot.properties)} properties (> {god_object_props})",
                    "hint": "拆分类型；共享特征用 Interface（调研材料 02 §反模式）",
                }
            )
        for p in ot.properties:
            slug = (
                p.rid.rid.split(".")[3]
                if len(p.rid.rid.split(".")) >= 5
                else p.rid.rid.split(".")[-1]
            )
            # Kitchen Sink
            if _TECH_COLUMN_RE.match(slug):
                findings.append(
                    {
                        "pattern": "kitchen_sink",
                        "subject": f"{rid}#{slug}",
                        "detail": f"technical column {slug!r} looks like pipeline metadata",
                        "hint": "ETL 元数据不入属性（刻意策展）",
                    }
                )
            # Misnomer
            if slug.lower() in _VAGUE_NAMES:
                findings.append(
                    {
                        "pattern": "misnomer",
                        "subject": f"{rid}#{slug}",
                        "detail": f"vague property name {slug!r}",
                        "hint": "歧义词必须限定（value → monetaryValue）",
                    }
                )
        # Action Sprawl
        if actions_by_type.get(rid, 0) > action_sprawl:
            findings.append(
                {
                    "pattern": "action_sprawl",
                    "subject": rid,
                    "detail": f"{actions_by_type[rid]} actions (> {action_sprawl})",
                    "hint": "打包为业务级 Action（Transfer Employee 而非逐字段 Update）",
                }
            )
    return findings
