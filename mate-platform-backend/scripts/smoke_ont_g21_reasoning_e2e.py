"""ONT-G21 — 推理端到端 live 冒烟（网关全链，无 mock）。

链路：建类型（person/employee/manager，属性继承）→ 建 3 实例 → 注册
subclass 公理（rid + slug 两种写法）→ /reasoning/run 三规则 →
/object-sets/query(祖先类) 命中后代实例（闭包扩展）→ Function 注册面 →
ACL 负例（跨租户 axiom rid 拒绝 / 跨租户 class rid 查询拒绝）。

用法：python scripts/smoke_ont_g21_reasoning_e2e.py
前置：docker 全栈运行中（网关 8100 + mate-tech-ont）。
"""
from __future__ import annotations

import json
import time
import urllib.request

_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
urllib.request.install_opener(_opener)

GW = "http://localhost:8100"
TENANT = "tenant-default"


def _call(method: str, path: str, token: str, payload: dict | None = None,
          tenant: str = TENANT) -> tuple[int, object]:
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json", "X-Tenant-Id": tenant}
    if token:  # 空 token 不发 Authorization（空 Bearer 头会被上游拒绝）
        headers["Authorization"] = f"Bearer {token}"
    last_exc: Exception | None = None
    for attempt in range(3):
        req = urllib.request.Request(GW + path, data=data, headers=headers,
                                     method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            try:
                return e.code, json.loads(body)
            except json.JSONDecodeError:
                if e.code >= 500 and attempt < 2:
                    last_exc = RuntimeError(body[:120])
                    time.sleep(2)
                    continue
                return e.code, body
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_exc = e
            time.sleep(2)
    raise RuntimeError(f"{method} {path} failed after retries: {last_exc}")


def _login() -> str:
    last = ""
    for attempt in range(5):
        status, body = _call("POST", "/api/v1/iam/auth/login", "",
                             {"username": "admin", "password": "admin123"})
        if status == 200:
            return body["accessToken"]
        last = f"{status} {body}" if not isinstance(body, str) else f"{status} {body}"
        time.sleep(3)
    raise AssertionError(f"login failed after retries: {last}")


def main() -> int:
    token = _login()
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        results.append((name, ok, detail))
        print(f"  {'PASS' if ok else 'FAIL'}: {name} {detail}", flush=True)

    rid_p = f"ont.{TENANT}.obj.g21-person.v1"
    rid_e = f"ont.{TENANT}.obj.g21-employee.v1"
    rid_m = f"ont.{TENANT}.obj.g21-manager.v1"
    prop_p = f"ont.{TENANT}.prop.g21-name.v1"

    def type_body(rid: str, name: str) -> dict:
        return {"rid": rid, "display_name": name,
                "primary_key": [prop_p],
                "properties": [{"rid": prop_p, "type_id": "string",
                                "nullable": False, "primary_key": True,
                                "title": "name", "format": "string"}]}

    print("== 1. 类型层（属性继承：三类共用 name 属性）==", flush=True)
    for rid, name in ((rid_p, "person"), (rid_e, "employee"), (rid_m, "manager")):
        status, body = _call("POST", "/api/v1/ont/v2/object-types", token,
                             type_body(rid, name))
        check(f"create type {name}", status in (200, 201), f"HTTP {status}")

    print("== 2. 实例层 ==", flush=True)
    for name, cls in (("alice", rid_p), ("bob", rid_e), ("carol", rid_m)):
        ind = {"rid": f"ont.{TENANT}.ind.g21.{name}.v1", "class_rid": cls,
               "props": {prop_p: {"value": name, "type": "string"}},
               "primary_key": name}
        status, body = _call("POST", "/api/v1/ont/v2/individuals", token, ind)
        check(f"create {name}", status in (200, 201), f"HTTP {status}")

    print("== 3. 公理注册（rid + slug 两种写法）==", flush=True)
    ax1 = {"rid": f"ont.{TENANT}.ax.g21-employee-person.v1",
           "kind": "subclass", "operands": [rid_e, rid_p], "enabled": True}
    ax2 = {"rid": f"ont.{TENANT}.ax.g21-manager-employee.v1",
           "kind": "subclass", "operands": ["g21-manager", "g21-employee"], "enabled": True}
    for ax in (ax1, ax2):
        status, body = _call("POST", "/api/v1/ont/v2/reasoning/axioms", token, ax)
        check(f"register axiom {ax['rid'].rsplit('.', 2)[-2]}", status == 200,
              f"HTTP {status}")

    print("== 4. 推理执行（三规则）==", flush=True)
    status, out = _call("POST", "/api/v1/ont/v2/reasoning/run", token, {
        "subclass_axioms": [["employee", "person"], ["person", "agent"]],
        "individuals": {"emp-1": ["employee"]},
        "same_as_pairs": [], "transitive_axioms": [], "property_edges": [],
    })
    r1_ok = (status == 200
             and out["classification"]["emp-1"]["inferred"] == ["agent", "person"])
    check("reasoning/run R1 closure", r1_ok, f"HTTP {status}")

    print("== 5. ObjectSet 祖先查询命中后代实例（闭包扩展）==", flush=True)
    for cls, expect, label in ((rid_p, {"alice", "bob", "carol"}, "person"),
                               (rid_e, {"bob", "carol"}, "employee"),
                               (rid_m, {"carol"}, "manager")):
        status, body = _call("POST", "/api/v1/ont/v2/object-sets/query", token,
                             {"class_rid": cls, "filter_expr": "g21-name",
                              "paging_limit": 100})
        names = set()
        if isinstance(body, dict):
            for r in body.get("results") or []:
                props = r.get("props") or {}
                v = props.get(prop_p)
                if isinstance(v, dict):
                    v = v.get("value")
                if v:
                    names.add(str(v))
        check(f"object-set query {label}", status == 200 and names == expect,
              f"HTTP {status} got {sorted(names)} expect {sorted(expect)}")

    print("== 6. Function 注册面 ==", flush=True)
    fn = {"rid": f"ont.{TENANT}.fn.g21-classify.v1", "language": "python",
          "version": 1,
          "source_ref": "mate-platform://g21/classify.py#classify",
          "signatures": [["classify", "string"]]}
    status, body = _call("POST", "/api/v1/ont/v2/functions", token, fn)
    fn_created = status in (200, 201)
    status2, body2 = _call("GET", "/api/v1/ont/v2/functions", token)
    fn_listed = status2 == 200 and isinstance(body2, list) and any(
        f2.get("rid") == fn["rid"] for f2 in body2)
    check("function register+list", fn_created and fn_listed,
          f"HTTP {status}/{status2}")

    print("== 7. ACL 负例（tenant 透传）==", flush=True)
    status, _ = _call("POST", "/api/v1/ont/v2/reasoning/axioms", token,
                      {"rid": "ont.tenant-acme.ax.g21-cross.v1",
                       "kind": "subclass", "operands": ["a", "b"], "enabled": True})
    check("cross-tenant axiom rid denied", status in (403, 422), f"HTTP {status}")
    status, _ = _call("POST", "/api/v1/ont/v2/object-sets/query", token,
                      {"class_rid": "ont.tenant-acme.obj.x.v1",
                       "filter_expr": "y"})
    check("cross-tenant class query denied", status == 403, f"HTTP {status}")

    print("\n=== ONT-G21 E2E RESULTS ===", flush=True)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, detail in results:
        print(f"  {'PASS' if ok else 'FAIL'}: {name} {detail}", flush=True)
    print(f"\nTOTAL: {passed}/{total} PASS", flush=True)
    print("ONT-G21-E2E", "PASS" if passed == total else "FAIL", flush=True)
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
