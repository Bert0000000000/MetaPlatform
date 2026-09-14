"""探针：确认部署态 ont 服务（PG 后端）的 v2 API 能力边界。

回答三个问题：
  1. ObjectType / Individual CRUD 的请求体形状与响应；
  2. ActionType.apply 能否真正执行 Function（源码只在进程内 resolver，未随 API 传输）；
  3. ObjectSet 查询能否按属性过滤。

用法：
    mate-platform-backend/.venv/Scripts/python.exe scripts/ont-bench/probe_platform_api.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8100"
TENANT = "tenant-default"
T = "ont-probe"


def login() -> str:
    req = urllib.request.Request(
        f"{BASE}/api/v1/iam/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["accessToken"]


TOKEN = ""


def call(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}",
            "X-Tenant-Id": TENANT,
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


def prop(slug: str, type_id: str = "string", pk: bool = False, array: bool = False) -> dict:
    return {
        "rid": f"ont.{TENANT}.prop.{T}.{slug}.v1",
        "type_id": type_id,
        "nullable": not pk,
        "primary_key": pk,
        "title": slug,
        "format": type_id,
        "array": array,
    }


def main() -> int:
    global TOKEN
    TOKEN = login()
    print(f"login OK (token {len(TOKEN)} chars)\n")

    rid_obj = f"ont.{TENANT}.obj.{T}.thing.v1"
    rid_fn = f"ont.{TENANT}.fn.{T}.compute.v1"
    rid_act = f"ont.{TENANT}.act.{T}.compute.v1"
    p_id = prop("thing-id", pk=True)
    p_score = prop("raw-score", "integer")
    p_out = prop("outcome", "string")

    print("① POST /object-types")
    st, body = call(
        "POST",
        "/api/v1/ont/v2/object-types",
        {
            "rid": rid_obj,
            "primary_key": [p_id["rid"]],
            "properties": [p_id, p_score, p_out],
            "display_name": "Probe Thing",
            "description": "platform capability probe",
            "type_group": "probe",
        },
    )
    print(f"   status={st} -> {str(body)[:200]}\n")

    print("② POST /individuals")
    st, body = call(
        "POST",
        "/api/v1/ont/v2/individuals",
        {
            "rid": f"ont.{TENANT}.ind.{T}.thing.t1",
            "class_rid": rid_obj,
            "props": {
                p_id["rid"]: {"value": "t1", "type": "string"},
                p_score["rid"]: {"value": 7, "type": "integer"},
            },
            "primary_key": "t1",
        },
    )
    print(f"   status={st} -> {str(body)[:250]}\n")

    print("③ POST /functions")
    st, body = call(
        "POST",
        "/api/v1/ont/v2/functions",
        {
            "rid": rid_fn,
            "language": "python",
            "version": 1,
            "source_ref": f"inline://{rid_fn}",
            "signatures": [["thing-id", "string"], ["outcome", "string"]],
        },
    )
    print(f"   status={st} -> {str(body)[:200]}\n")

    print("④ POST /action-types")
    st, body = call(
        "POST",
        "/api/v1/ont/v2/action-types",
        {
            "rid": rid_act,
            "parameters": [p_id, p_score, p_out],
            "submission_criteria": [],
            "side_effects": ["audit_log"],
            "function_ref": rid_fn,
            "on": [rid_obj],
            "title": "probe compute",
        },
    )
    print(f"   status={st} -> {str(body)[:200]}\n")

    print("⑤ POST /action-types/{rid}/apply  (关键：Function 能否执行)")
    st, body = call(
        "POST",
        f"/api/v1/ont/v2/action-types/{rid_act}/apply",
        {
            "parameters": {"thing-id": "t1", "raw-score": 7},
            "target_iid": f"ont.{TENANT}.ind.{T}.thing.t1",
            "provenance": {"actor": "probe", "tenant_id": TENANT},
        },
    )
    print(f"   status={st} -> {str(body)[:400]}\n")

    print("⑥ POST /object-sets/query  (按属性过滤)")
    st, body = call(
        "POST",
        "/api/v1/ont/v2/object-sets/query",
        {
            "source": rid_obj,
            "filters": [{"field": "thing-id", "op": "eq", "value": "t1"}],
            "paging_limit": 10,
        },
    )
    print(f"   status={st} -> {str(body)[:300]}\n")

    print("⑦ GET /individuals/{rid}")
    st, body = call("GET", f"/api/v1/ont/v2/individuals/ont.{TENANT}.ind.{T}.thing.t1")
    print(f"   status={st} -> {str(body)[:400]}\n")

    print("⑧ 租户隔离：换 tenant header 读同一实例")
    req = urllib.request.Request(
        f"{BASE}/api/v1/ont/v2/object-types?limit=3",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "X-Tenant-Id": "tenant-other",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"   status={r.status} -> {r.read().decode()[:200]}")
    except urllib.error.HTTPError as e:
        print(f"   status={e.code} -> {e.read().decode()[:250]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
