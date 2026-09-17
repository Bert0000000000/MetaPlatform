"""证据映射：工具结果 → 结构化证据条目（1.6 任务 1）。

**形状复刻 copilot 的 ``_evidence_items``**（``mate-app-copilot`` 的
``agent_loop.py``）：同一平台里"证据"只该有一种样子，前端才不必按服务各认一套
字段。条目字段是这五个的一个子集——

======================  ==================================================
``type``                ``ONTOLOGY_OBJECT`` / ``ONTOLOGY_METRIC``
``ref``                 可寻址引用（实例 rid / 类型 rid / 指标名）
``objectId``            **仅实例证据**有；类型/指标证据不设
``concept``             人读的类型名（可缺）
``fragment``            结果片段的 JSON 串（可缺）
======================  ==================================================

外流前再补两个字段：``evidenceId``（运行内唯一）与 ``capturedAt``（UTC 时刻）——
copilot 也是在 emit 侧补的，这里同样不把它们算进"形状"本身。

**忠实映射，不许编造**：只对结果里**真实存在**的字段取证，取不到就不产出条目。
比 copilot 更严的一处：查询回来的行**没有实例身份时直接丢弃**，不做
``f"{tool}[{index}]"`` 那种位置占位。理由是本批的判据就写着"取不到字段时不产出
条目"——一条 `ref` 指不到任何对象的证据，点进去只会 404，那属于"看着有证据、
实际查不到"，正是 1.6 要治的病。

**边界**：只覆盖本体只读工具（与 copilot 对位）。写路径（``ont_propose_*``）出的是
提案不是证据，由既有的 proposal 通道负责，不在这里映射。
"""

from __future__ import annotations

import json
import time
from typing import Any

#: 单次工具调用最多产出多少条证据：类型清单可能有几十个，全量渲染会把回答挤到
#: 屏幕外。**超出部分不丢**——模型仍拿得到完整 tool_result，这里只是不外流。
EVIDENCE_ROW_LIMIT = 10
EVIDENCE_ITEM_LIMIT = 8

#: ``fragment`` 的长度上限：证据是给人看的摘要，不是数据搬运。
EVIDENCE_FRAGMENT_LIMIT = 500

#: 实例身份的候选键，按可信度排序。``__rid__`` 是 ont v2 object-query 的规范身份列。
_IDENTITY_KEYS: tuple[str, ...] = ("__rid__", "rid", "individual_rid")

#: 类型 rid 的候选键。``rid`` 是本体 ``ClassInspectDTO`` 的原生字段；
#: ``class_rid`` 是 copilot 适配层与 MCP 卡片用的名字。两个都认。
_TYPE_RID_KEYS: tuple[str, ...] = ("rid", "class_rid")

#: 类型名的候选键。MCP 的裁剪清单回 ``name``，本体与 copilot 回 ``display_name``。
_TYPE_NAME_KEYS: tuple[str, ...] = ("display_name", "name", "slug")


def as_mapping(value: Any) -> dict[str, Any]:
    """把工具返回值归一成 dict；归不出来就是空 dict（→ 不产证据）。

    生产上工具经 ``langchain-mcp-adapters`` 派发，返回的可能不是 dict
    （文本、或 content blocks 列表）。归 **不** 出来时返回空 dict——**不抛错**：
    取不到证据是常态，不该把一次查询变成一次运行失败。
    """
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return _json_object(value)
    if isinstance(value, (list, tuple)):
        for block in value:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                parsed = _json_object(block["text"])
                if parsed:
                    return parsed
    return {}


def _json_object(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def utc_now() -> str:
    """抓取时刻（UTC，秒级）。与 copilot 同一格式。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _fragment_of(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)[:EVIDENCE_FRAGMENT_LIMIT]


def _first_str(row: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = row.get(key)
        if value:
            return str(value)
    return ""


def _object_item(row: dict[str, Any]) -> dict[str, Any] | None:
    """一行查询结果 → 实例证据；没有身份就不产条目。"""
    identity = _first_str(row, _IDENTITY_KEYS)
    if not identity:
        return None
    return {
        "type": "ONTOLOGY_OBJECT",
        "ref": identity,
        "objectId": identity,
        "fragment": _fragment_of(row),
    }


def _metric_item(tool: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    """聚合结果 → 指标证据（没有单条实例可指，ref 就是工具名）。"""
    return {
        "type": "ONTOLOGY_METRIC",
        "ref": tool,
        "concept": tool,
        "fragment": _fragment_of(rows[:EVIDENCE_ROW_LIMIT]),
    }


def evidence_items(name: str, result: dict[str, Any]) -> list[dict[str, Any]]:
    """本体工具结果 → 结构化证据条目。

    ``name`` 是本服务经 MCP 中心拿到的**真实工具名**（``ont_*``），不是 copilot
    的内部名——两个服务的工具面不同，映射入口也跟着不同，但**产出的条目形状
    完全一致**。
    """
    items: list[dict[str, Any]] = []

    if name == "ont_object_query":
        rows = [r for r in (result.get("rows") or []) if isinstance(r, dict)]
        if result.get("kind") == "aggregates":
            if rows:
                items.append(_metric_item(name, rows))
        else:
            for row in rows[:EVIDENCE_ROW_LIMIT]:
                item = _object_item(row)
                if item is not None:
                    items.append(item)
    elif name == "ont_search_objects":
        for card in result.get("cards") or []:
            if not isinstance(card, dict):
                continue
            item = _object_item(card)
            if item is None:
                continue
            concept = _first_str(card, ("class_rid",))
            item["concept"] = concept or None
            item["fragment"] = str(card.get("card_text") or "") or None
            items.append(item)
    elif name == "ont_list_classes":
        for cls in result.get("classes") or []:
            if not isinstance(cls, dict):
                continue
            rid = _first_str(cls, _TYPE_RID_KEYS)
            if not rid:
                continue
            items.append(
                {
                    "type": "ONTOLOGY_OBJECT",
                    "ref": rid,
                    "concept": _first_str(cls, _TYPE_NAME_KEYS) or None,
                }
            )
    elif name == "ont_inspect_class":
        rid = _first_str(result, _TYPE_RID_KEYS)
        if rid:
            # 类型级证据：ref 指向 ObjectType，**刻意不设 objectId** —— 那是实例
            # 标识，前端据此调 getIndividual / searchAround 会 404。
            items.append(
                {
                    "type": "ONTOLOGY_OBJECT",
                    "ref": rid,
                    "concept": _first_str(result, _TYPE_NAME_KEYS) or None,
                }
            )

    return items[:EVIDENCE_ITEM_LIMIT]


__all__ = [
    "EVIDENCE_FRAGMENT_LIMIT",
    "EVIDENCE_ITEM_LIMIT",
    "EVIDENCE_ROW_LIMIT",
    "as_mapping",
    "evidence_items",
    "utc_now",
]
