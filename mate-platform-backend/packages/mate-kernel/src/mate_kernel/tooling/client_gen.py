"""SEC-13：OSDK-lite —— 从本体定义生成 Python 类型化客户端（"改定义即改 API"）。

Palantir OSDK 语义（调研材料 06 §1）：从 Ontology 定义生成类型化客户端，
本地再生成随定义变更；token scoped + 叠加用户权限（该部分由网关层承担，
本生成器只管类型面）。

生成物（单文件，无第三方依赖）：
- 每 ObjectType 一个 ``@dataclass``（slug 短名属性）+ 类型 docstring
  （description / marking / status 元数据进注释 —— AI 可导航性）；
- ``OntologyClient``：list_objects / query_objects（ObjectSetQuery 薄封装）/
  get_object / search_objects / propose_action（edit-set 提案）/ confirm /
  execute / search_around —— 全部走 HTTP（base_url + token）。

用法::

    from mate_kernel.tooling.client_gen import generate_client_source
    src = generate_client_source(object_types, action_types, tenant="t1")
    # 写入 mate-clients/sdk/ontology_client/<tenant>_client.py
"""

from __future__ import annotations

from typing import Any

from .schema_gen import slug_of_property_rid, slug_of_rid

__all__ = ["generate_client_source"]

_HEADER = '''"""Auto-generated Ontology typed client（SEC-13 / OSDK-lite）.

由 mate_kernel.tooling.client_gen 生成 —— **勿手改**；本体定义变更后重新生成
（"改定义即改 API"）。运行时依赖：requests（或任何 httpx 兼容注入）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class OntologyClient:
    """类型化本体客户端（v2 kernel HTTP 面）。"""

    base_url: str  # 如 http://gateway:8100/api/v1/ont/v2
    token: str = ""
    markings: tuple[str, ...] = ()  # SEC-12 viewer markings
    _session: Any = None  # 可注入 requests.Session / httpx.Client

    def _http(self):
        if self._session is not None:
            return self._session
        import requests

        self._session = requests.Session()
        return self._session

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _get(self, path: str, params: dict | None = None) -> Any:
        r = self._http().get(
            f"{self.base_url}{path}", params=params or {},
            headers=self._headers(), timeout=30)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: dict | None = None) -> Any:
        r = self._http().post(
            f"{self.base_url}{path}", json=body or {},
            headers=self._headers(), timeout=60)
        r.raise_for_status()
        return r.json()

    # ───── 读 ─────

    def list_object_types(self) -> list[dict[str, Any]]:
        return self._get("/object-types")

    def type_hierarchy(self) -> list[dict[str, Any]]:
        return self._get("/object-types/hierarchy")

    def list_objects(self, class_rid: str, limit: int = 100,
                     offset: int = 0) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if class_rid:
            params["class_rid"] = class_rid
        if self.markings:
            params["markings"] = ",".join(self.markings)
        return self._get("/individuals", params)

    def get_object(self, rid: str) -> dict[str, Any]:
        from urllib.parse import quote

        return self._get(f"/individuals/{quote(rid, safe='')}")

    def query_objects(self, source: str, filters: list[dict] | None = None,
                      aggregation: dict | None = None,
                      traversal: list[dict] | None = None,
                      sort: list[dict] | None = None,
                      limit: int = 100, offset: int = 0) -> dict[str, Any]:
        body: dict[str, Any] = {
            "source": source, "paging_offset": offset, "paging_limit": limit,
        }
        if filters:
            body["filters"] = filters
        if aggregation:
            body["aggregation"] = aggregation
        if traversal:
            body["traversal"] = traversal
        if sort:
            body["sort"] = sort
        params = {}
        if self.markings:
            params["markings"] = ",".join(self.markings)
        import requests

        r = self._http().post(f"{self.base_url}/object-query", json=body,
                              params=params, headers=self._headers(), timeout=30)
        r.raise_for_status()
        return r.json()

    def search_objects(self, text: str, class_rid: str | None = None,
                       top_k: int = 5) -> list[dict[str, Any]]:
        return self._post("/object-search", {
            "text": text, "class_rid": class_rid, "top_k": top_k,
        }).get("cards", [])

    def search_hybrid(self, text: str, class_rid: str | None = None,
                      top_k: int = 5) -> list[dict[str, Any]]:
        return self._post("/object-search/hybrid", {
            "text": text, "class_rid": class_rid, "top_k": top_k,
        }).get("cards", [])

    def search_around(self, rid: str, limit: int = 100) -> list[dict[str, Any]]:
        from urllib.parse import quote

        return self._get(f"/individuals/{quote(rid, safe='')}/around",
                         {"limit": limit})

    # ───── 写（HITL 管道）─────

    def propose_edit_set(self, action_rid: str, target_iid: str | None,
                         parameters: dict[str, Any],
                         edits: list[dict] | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"parameters": parameters,
                                "target_iid": target_iid or ""}
        if edits:
            body["edits"] = edits
        return self._post(
            f"/action-types/{action_rid}/propose-edit-set", body)

    def apply_edit_set(self, action_rid: str, target_iid: str | None,
                       parameters: dict[str, Any],
                       edits: list[dict] | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"parameters": parameters,
                                "target_iid": target_iid or ""}
        if edits:
            body["edits"] = edits
        from urllib.parse import quote

        return self._post(
            f"/action-types/{quote(action_rid, safe='')}/apply-edit-set", body)

    def confirm_proposal(self, proposal_id: str) -> dict[str, Any]:
        import uuid

        from urllib.parse import quote

        return self._post(
            f"/proposals/{quote(proposal_id, safe='')}/confirm", {},
            headers={**self._headers(),
                     "Idempotency-Key": str(uuid.uuid4())})

    def execute_proposal(self, proposal_id: str) -> dict[str, Any]:
        import uuid

        from urllib.parse import quote

        return self._post(
            f"/proposals/{quote(proposal_id, safe='')}/execute", {},
            headers={**self._headers(),
                     "Idempotency-Key": str(uuid.uuid4())})

    def revert_proposal(self, proposal_id: str) -> dict[str, Any]:
        import uuid

        from urllib.parse import quote

        return self._post(
            f"/proposals/{quote(proposal_id, safe='')}/revert", {},
            headers={**self._headers(),
                     "Idempotency-Key": str(uuid.uuid4())})
'''

_TYPE_TMPL = '''

@dataclass
class {cls_name}:
    """{display}（{rid}）

{desc_lines}    """
    rid: str
    primary_key: str{field_lines}
'''

_FIELD_TMPL = '''
    {slug}: {py_type} = None'''


def _py_type(fmt: str) -> str:
    return {
        "string": "str", "integer": "int", "double": "float",
        "boolean": "bool", "date": "str", "timestamp": "str",
    }.get(fmt, "Any")


def generate_client_source(
    object_types: list[Any] | tuple[Any, ...],
    action_types: list[Any] | tuple[Any, ...] = (),
    *,
    tenant: str = "",
) -> str:
    """本体定义 → Python 客户端源码（单文件）。

    每 ObjectType 生成 dataclass（字段 = slug 短名 + Python 类型注释）；
    ActionType 生成注释清单（propose_edit_set 的 action_rid 常量表）。
    """
    parts: list[str] = [_HEADER]
    seen_cls: set[str] = set()
    for ot in object_types:
        cls_name = "".join(
            w.capitalize() for w in slug_of_rid(ot.rid.rid).replace("-", "_").split("_")
        ) or "ObjectType"
        if cls_name in seen_cls:
            continue
        seen_cls.add(cls_name)
        desc_lines = ""
        if getattr(ot, "description", ""):
            desc_lines = f"    {ot.description}\n\n"
        meta_bits = []
        if getattr(ot, "status", "active") != "active":
            meta_bits.append(f"status={ot.status}")
        if getattr(ot, "marking", ()):
            meta_bits.append(f"marking={','.join(ot.marking)}")
        if getattr(ot, "parent_class", None) is not None:
            meta_bits.append(f"parent={ot.parent_class.rid}")
        if getattr(ot, "interfaces", ()):
            meta_bits.append(f"interfaces={len(ot.interfaces)}")
        if meta_bits:
            desc_lines += "    " + " · ".join(meta_bits) + "\n"
        field_lines = "".join(
            _FIELD_TMPL.format(
                slug=slug_of_property_rid(p.rid.rid).replace("-", "_"),
                py_type=_py_type(getattr(p.format, "value", str(p.format))),
            )
            for p in ot.properties
            if not p.primary_key
        )
        parts.append(_TYPE_TMPL.format(
            cls_name=cls_name, display=ot.display_name or cls_name,
            rid=ot.rid.rid, desc_lines=desc_lines, field_lines=field_lines,
        ))
    # ActionType 常量表
    if action_types:
        lines = ["", "", "# ── ActionType rid 常量（propose/apply 用）──"]
        for at in action_types:
            slug = slug_of_rid(at.rid.rid).replace("-", "_").upper()
            title = getattr(at, "title", "") or slug
            lines.append(f"{slug}_RID = {at.rid.rid!r}  # {title}")
        parts.append("\n".join(lines))
    return "".join(parts)
