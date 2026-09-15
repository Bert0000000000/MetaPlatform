"""ADR-0064 S4 部署态冒烟（经网关 8100 → mate-tech-ont 容器 → metaplatform 库）。

场景：
  A. 纯声明式 ActionType（function_ref 空）：/propose（此前 500 的路径）→
     confirm → execute → revert 全链
  B. 混合式 ActionType（declarative + function_ref 并存，D-2 不互斥）：可创建、
     契约接受双声明；propose-edit-set 带显式 edits（全集，跳过 function）→
     confirm → execute
全部对象 drill-act05u- 前缀，跑完即清。
"""

from __future__ import annotations

import json
import sys
import urllib.request

BASE = "http://localhost:8100/api/v1/ont/v2"
T = "tenant-default"
PFX = "drill-act05u"
RUN = __import__("time").strftime("%H%M%S")  # 幂等键防跨跑冲突

OBJ = f"ont.{T}.obj.drill.{PFX}-employee.v1"
P_NAME = f"ont.{T}.prop.drill.{PFX}-ename.v1"
P_STATUS = f"ont.{T}.prop.drill.{PFX}-estatus.v1"
ACT_PURE = f"ont.{T}.act.drill.{PFX}-set-status-declarative.v1"
ACT_HYBRID = f"ont.{T}.act.drill.{PFX}-promote-hybrid.v1"
IND = f"ont.{T}.ind.{PFX}-employee.smoke1"


def _login() -> str:
    req = urllib.request.Request(
        "http://localhost:8100/api/v1/iam/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["accessToken"]


_TOKEN = ""


def call(method: str, path: str, body: dict | None = None, key: str = "") -> tuple[int, object]:
    global _TOKEN
    if not _TOKEN:
        _TOKEN = _login()
    token = _TOKEN
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            **({"Idempotency-Key": key} if key else {}),
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def prop(name: str, title: str, pk: bool = False, nullable: bool = True) -> dict:
    return {
        "rid": name,
        "type_id": "string",
        "nullable": nullable,
        "primary_key": pk,
        "title": title,
        "format": "string",
    }


def main() -> int:
    failures: list[str] = []

    def check(what: str, ok: bool, detail: object = "") -> None:
        print(f"{'PASS' if ok else 'FAIL'}  {what}  {detail if not ok else ''}")
        if not ok:
            failures.append(f"{what}: {detail}")

    # ── 建模：ObjectType + Individual ──
    code, out = call(
        "POST",
        "/object-types",
        {
            "rid": OBJ,
            "primary_key": [P_NAME],
            "properties": [prop(P_NAME, "name", pk=True, nullable=False), prop(P_STATUS, "status")],
            "display_name": "smoke-employee",
        },
    )
    check("upsert object-type", code == 200, out)

    code, out = call(
        "POST",
        "/individuals",
        {
            "rid": IND,
            "class_rid": OBJ,
            "props": {P_NAME: {"value": "smoke1"}, P_STATUS: {"value": "active"}},
            "primary_key": "smoke1",
        },
    )
    check("create individual", code in (200, 201), out)

    edit_tmpl = {
        "op": "set_property",
        "target": "$target",
        "property_rid": P_STATUS,
        "value": "$param.new-status",
    }

    # ── A. 纯声明式（function_ref 缺省 = 可选化）──
    code, out = call(
        "POST",
        "/action-types",
        {
            "rid": ACT_PURE,
            "parameters": [prop(f"ont.{T}.prop.drill.{PFX}-newstatus.v1", "new-status", nullable=False)],
            "function_ref": "",
            "on": [OBJ],
            "title": "Drill Set Status (declarative)",
            "declarative_edits": [edit_tmpl],
        },
    )
    check("A1 upsert pure-declarative action (function_ref 空)", code == 200, out)

    code, out = call("GET", f"/action-types/{ACT_PURE}")
    check(
        "A2 读回 function_ref 为空串 + edits 保留",
        code == 200 and out.get("function_ref") == "" and len(out.get("declarative_edits") or []) == 1,
        out,
    )

    code, out = call(
        "POST",
        f"/action-types/{ACT_PURE}/propose",
        {"parameters": {"new-status": "promoted"}, "target_iid": IND},
    )
    check("A3 propose（action 端点，此前 execute 500）", code == 200, out)
    pid = out.get("proposal_id", "")

    code, out = call("POST", f"/proposals/{pid}/confirm", {}, key=f"{PFX}-cfm-a-{RUN}")
    check("A4 confirm", code == 200, out)

    code, out = call("POST", f"/proposals/{pid}/execute", key=f"{PFX}-exe-a-{RUN}")
    check("A5 execute（统一执行器，无 500）", code == 200, out)

    code, out = call("GET", f"/individuals/{IND}")
    props = dict(out.get("props") or {}) if code == 200 else {}
    check("A6 落库生效", props.get(P_STATUS) == "promoted", out)

    code, out = call("POST", f"/proposals/{pid}/revert", {}, key=f"{PFX}-rv-a-{RUN}")
    check("A7 revert", code == 200, out)

    code, out = call("GET", f"/individuals/{IND}")
    props = dict(out.get("props") or {}) if code == 200 else {}
    check("A8 revert 后回旧值", props.get(P_STATUS) == "active", out)

    # ── B. 混合式（declarative + function_ref 并存）──
    code, out = call(
        "POST",
        "/action-types",
        {
            "rid": ACT_HYBRID,
            "parameters": [prop(f"ont.{T}.prop.drill.{PFX}-newstatus.v1", "new-status", nullable=False)],
            "function_ref": f"ont.{T}.fn.drill.{PFX}-compute.v1",  # 不注册执行体：冒烟走显式 edits 路径
            "on": [OBJ],
            "title": "Drill Promote (hybrid)",
            "declarative_edits": [edit_tmpl],
        },
    )
    check("B1 upsert hybrid action（两来源并存合法）", code == 200, out)

    code, out = call("GET", f"/action-types/{ACT_HYBRID}")
    check(
        "B2 读回双声明",
        code == 200 and out.get("function_ref") and len(out.get("declarative_edits") or []) == 1,
        out,
    )

    code, out = call(
        "POST",
        f"/action-types/{ACT_HYBRID}/propose-edit-set",
        {
            "parameters": {},
            "target_iid": IND,
            "edits": [
                {
                    "op": "set_property",
                    "target": IND,
                    "property_rid": P_STATUS,
                    "value": "hybrid-away",
                }
            ],
        },
    )
    check("B3 propose-edit-set（显式 edits = 全集，跳过 function）", code == 200, out)
    pid2 = out.get("proposal_id", "")

    code, out = call("POST", f"/proposals/{pid2}/confirm", {}, key=f"{PFX}-cfm-b-{RUN}")
    check("B4 confirm", code == 200, out)

    code, out = call("POST", f"/proposals/{pid2}/execute", key=f"{PFX}-exe-b-{RUN}")
    check("B5 execute", code == 200, out)

    code, out = call("GET", f"/individuals/{IND}")
    props = dict(out.get("props") or {}) if code == 200 else {}
    check("B6 落库生效", props.get(P_STATUS) == "hybrid-away", out)

    # ── 清理（drill 前缀）──
    for rid in (ACT_PURE, ACT_HYBRID, OBJ):
        call("DELETE", f"/object-types/{rid}")  # ont 无类型 DELETE 时忽略
    print(f"\n{'=' * 50}\n{'SMOKE PASS' if not failures else 'SMOKE FAIL'}: {len(failures)} failures")
    for f in failures:
        print(" -", f)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
