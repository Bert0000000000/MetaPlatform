"""探针 2：proposal→confirm→execute（HITL 唯一写路径）+ object-sets 查询。

承接 probe_platform_api.py 已建的类型/实例。重点回答：
  - 部署态下 Function 能否真正执行（源码只在进程内 resolver 注册）；
  - object-sets/query 过滤语义；
  - execute 后实例属性是否回写。
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8100"
TENANT = "tenant-default"
T = "ont-probe"
TOKEN = ""


def call(method: str, path: str, body: dict | None = None, extra: dict | None = None):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}",
        "X-Tenant-Id": TENANT,
    }
    if extra:
        headers.update(extra)
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]


def main() -> int:
    global TOKEN
    with urllib.request.urlopen(
        urllib.request.Request(
            f"{BASE}/api/v1/iam/auth/login",
            data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        ),
        timeout=30,
    ) as r:
        TOKEN = json.load(r)["accessToken"]

    rid_act = f"ont.{TENANT}.act.{T}.compute.v1"
    rid_ind = f"ont.{TENANT}.ind.{T}.thing.t1"
    rid_obj = f"ont.{TENANT}.obj.{T}.thing.v1"

    print("① POST /action-types/{rid}/propose")
    st, body = call(
        "POST",
        f"/api/v1/ont/v2/action-types/{rid_act}/propose",
        {
            "parameters": {"thing-id": "t1", "raw-score": 7},
            "target_iid": rid_ind,
            "impact_summary": "probe compute t1",
        },
        extra={"Idempotency-Key": "probe-propose-1"},
    )
    print(f"   status={st} -> {str(body)[:300]}")
    pid = body.get("proposal_id") if isinstance(body, dict) else None
    print(f"   proposal_id={pid}\n")
    if not pid:
        return 1

    print("② POST /proposals/{id}/confirm")
    st, body = call(
        "POST",
        f"/api/v1/ont/v2/proposals/{pid}/confirm",
        {},
        extra={"Idempotency-Key": f"probe-confirm-{pid}"},
    )
    print(f"   status={st} -> {str(body)[:200]}\n")

    print("③ POST /proposals/{id}/execute  (关键：Function 执行 + 属性回写)")
    st, body = call(
        "POST",
        f"/api/v1/ont/v2/proposals/{pid}/execute",
        {},
        extra={"Idempotency-Key": f"probe-exec-{pid}"},
    )
    print(f"   status={st} -> {str(body)[:500]}\n")

    print("④ GET /individuals/{rid}  (看 outcome 是否被函数写入)")
    st, body = call("GET", f"/api/v1/ont/v2/individuals/{rid_ind}")
    print(f"   status={st} -> {json.dumps(body, ensure_ascii=False)[:400] if isinstance(body, dict) else body}\n")

    print("⑤ POST /object-sets/query  (filter_expr DSL)")
    for expr in ["", "raw-score == 7", "raw-score > 5", "raw-score > 100"]:
        st, body = call(
            "POST",
            "/api/v1/ont/v2/object-sets/query",
            {"class_rid": rid_obj, "filter_expr": expr, "paging_limit": 10},
        )
        print(f"   expr={expr!r:22} status={st} -> {json.dumps(body, ensure_ascii=False)[:300]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
