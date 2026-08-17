"""MP-SAL 接线：copilot 运行时本体 repo —— tech-ont v2 的 HTTP 适配。

把 SAL-01/02/04b 的本体能力带进 SuperAI 聊天运行时（OntologyToolRepo 协议）：
- 工具面（list/inspect/query_<slug>/search/propose×3）经 build_ontology_tools 使用
- 执行经 execute_ontology_tool 使用
- OAG 卡片：search_objects(用户消息) → system prompt 注入

跨进程标准部署用 env ONT_HTTP_BASE（默认 http://localhost:8007，同 MCP 代理
工具约定）；鉴权：构造时传入请求头（Bearer + X-Tenant-Id），逐请求透传。
"""

from __future__ import annotations

import os
from types import SimpleNamespace
from typing import Any

import httpx

from mate_kernel.objectset.ir import ObjectSetQuery, QueryResult
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat

_BASE = "/api/v1/ont/v2"


def _to_prop(p: dict[str, Any]) -> Property:
    return Property(
        rid=ClassRef(p["rid"]), type_id=p.get("type_id", "string"),
        nullable=p.get("nullable", True), primary_key=p.get("primary_key", False),
        title=p.get("title", ""), format=PropertyFormat(p.get("format", "string")),
    )


def _to_ot(d: dict[str, Any]) -> ObjectType:
    return ObjectType(
        rid=ClassRef(d["rid"]),
        primary_key=tuple(ClassRef(pk) for pk in d.get("primary_key", ())),
        properties=tuple(_to_prop(p) for p in d.get("properties", ())),
        interfaces=tuple(ClassRef(i) for i in d.get("interfaces", ())),
        display_name=d.get("display_name", ""),
        marking=tuple(d.get("marking", ())),
    )


class OntologyHttpRepo:
    """OntologyToolRepo 协议的 tech-ont v2 HTTP 实现（sync；调用方包 to_thread）。"""

    def __init__(self, headers: dict[str, str] | None = None, base_url: str | None = None,
                 timeout: float = 20.0) -> None:
        self._base = (base_url or os.getenv("ONT_HTTP_BASE", "http://localhost:8007")).rstrip("/")
        self._headers = headers or {}
        self._client = httpx.Client(base_url=self._base, timeout=timeout, headers=self._headers)

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        resp = self._client.get(f"{_BASE}{path}", params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, payload: dict[str, Any] | None = None) -> Any:
        resp = self._client.post(f"{_BASE}{path}", json=payload or {})
        resp.raise_for_status()
        return resp.json()

    # ───── OntologyToolRepo 协议 ─────

    def list_object_types(self, limit: int = 10000, offset: int = 0) -> list[ObjectType]:
        items = self._get("/object-types", params={"limit": limit, "offset": offset})
        return [_to_ot(d) for d in items]

    def get_object_type(self, rid: Any) -> ObjectType:
        rid_str = rid if isinstance(rid, str) else rid.rid
        d = self._get(f"/object-types/{rid_str}")
        return _to_ot(d)

    def list_link_instances(self) -> list[Any]:
        items = self._get("/link-instances")
        return [
            SimpleNamespace(
                rid=li.get("rid", ""), link_type_rid=SimpleNamespace(rid=li.get("link_type_rid", "")),
                src=li.get("src", ""), dst=li.get("dst", ""),
            )
            for li in items
        ]

    def execute_object_query(self, q: ObjectSetQuery) -> QueryResult:
        payload: dict[str, Any] = {
            "source": q.source,
            "paging_offset": q.paging_offset,
            "paging_limit": q.paging_limit,
        }
        if q.filters:
            payload["filters"] = [
                {"field": c.field, "op": c.op.value, "value": c.value} for c in q.filters
            ]
        if q.sort:
            payload["sort"] = [{"field": s.field, "desc": s.desc} for s in q.sort]
        if q.aggregation is not None:
            payload["aggregation"] = {
                "group_by": list(q.aggregation.group_by),
                "metrics": [
                    {"fn": m.fn, **({"field": m.field} if m.field else {}),
                     **({"alias": m.alias} if m.alias else {})}
                    for m in q.aggregation.metrics
                ],
            }
        if q.traversal:
            payload["traversal"] = [
                {"link_type": t.link_type, "direction": t.direction} for t in q.traversal
            ]
        d = self._post("/object-query", payload)
        return QueryResult(
            kind=d.get("kind", "objects"),
            rows=tuple(d.get("rows") or ()),
            result_schema=d.get("result_schema"),
        )

    def search_objects(
        self, text: str, class_rid: str | None = None, top_k: int = 5,
    ) -> list[dict[str, Any]]:
        d = self._post("/object-search", {
            "text": text, **({"class_rid": class_rid} if class_rid else {}), "top_k": top_k,
        })
        return list(d.get("cards") or ())

    def propose_action(
        self, action_rid: Any, parameters: dict[str, Any],
        target_iid: str | None, impact_summary: str,
        expected_diff: dict[str, Any] | None = None,
    ) -> Any:
        rid = action_rid if isinstance(action_rid, str) else action_rid.rid
        d = self._post(
            f"/action-types/{rid}/propose",
            {"parameters": parameters, "target_iid": target_iid or "",
             "impact_summary": impact_summary, "expected_diff": expected_diff or {}},
        )
        return _proposal_ns(d)

    def propose_create_instance(
        self, class_rid: str, props: dict[str, Any],
        impact_summary: str, expected_diff: dict[str, Any] | None = None,
    ) -> Any:
        d = self._post(
            f"/classes/{class_rid}/propose-instance",
            {"props": props, "impact_summary": impact_summary,
             "expected_diff": expected_diff or {}},
        )
        return _proposal_ns(d)

    def propose_model_type(self, type_def: dict[str, Any], impact_summary: str) -> Any:
        d = self._post(
            "/object-types/propose",
            {"type_def": type_def, "impact_summary": impact_summary},
        )
        return _proposal_ns(d)


def _proposal_ns(d: dict[str, Any]) -> Any:
    return SimpleNamespace(
        proposal_id=d.get("proposal_id", ""),
        action_rid=d.get("action_rid", ""),
        status=SimpleNamespace(value=d.get("status", "pending")),
        kind=d.get("kind", "action"),
        impact_summary=d.get("impact_summary", ""),
        expected_diff=d.get("expected_diff", {}),
        confirmed_by=d.get("confirmed_by"),
    )
