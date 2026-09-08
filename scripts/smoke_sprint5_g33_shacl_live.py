"""Sprint5 第三批 — SHACL W3C 增量 + G33 对齐/合并 REST live 取证。

全链经网关（8100），无 mock：
  ① ontValidateV2Shacl：severity=Warning 不破 conforms / sh:not 负例 /
     sh:languageIn / sh:qualifiedValueShape（stateless 四连）
  ② ontAlignV2Individuals：显式 + 词汇 + 结构证据聚类
  ③ ontPreviewV2ObjectTypeMerge：字段并集 + 冲突标记 + 审计
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

GW = "http://localhost:8100"
TENANT = "tenant-default"
EMP = "ont.tenant-default.obj.g33-employee.v1"


def http(method: str, url: str, body: dict | None = None,
         token: str | None = None) -> dict:
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("X-Tenant-Id", TENANT)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"_status": e.code, "_body": e.read().decode()[:300]}


def main() -> int:
    tok = http("POST", f"{GW}/api/v1/iam/auth/login",
               {"username": "admin", "password": "admin123"})["accessToken"]
    print("[login] OK")
    ok = True

    # ① SHACL：severity=Warning —— pattern 违例但 conforms=true
    r = http("POST", f"{GW}/api/v1/ont/v2/shacl/validate", {
        "target_class": EMP,
        "individuals": [{"rid": f"{EMP}#i1", "class_rid": EMP,
                         "props": {f"ont.{TENANT}.prop.name.v1": "bad-id"}}],
        "property_shapes": [
            {"path": f"ont.{TENANT}.prop.name.v1",
             "pattern": r"^EMP-\d+$", "severity": "Warning"}],
    }, token=tok)
    step = r.get("conforms") is True and \
        r.get("violations", [{}])[0].get("constraint") == "pattern"
    ok &= step
    print(f"[1] shacl severity=Warning conforms={r.get('conforms')} "
          f"counts={r.get('severity_counts')} -> {'PASS' if step else 'FAIL'}")

    # ② SHACL：sh:not —— 值满足被取反 shape ⟹ 违例
    r = http("POST", f"{GW}/api/v1/ont/v2/shacl/validate", {
        "target_class": EMP,
        "individuals": [{"rid": f"{EMP}#i2", "class_rid": EMP,
                         "props": {f"ont.{TENANT}.prop.name.v1": "12345"}}],
        "property_shapes": [
            {"path": f"ont.{TENANT}.prop.name.v1",
             "not_shape": {"path": f"ont.{TENANT}.prop.name.v1",
                           "pattern": r"^\d+$"}}],
    }, token=tok)
    step = r.get("conforms") is False and \
        any(v.get("constraint") == "not" for v in r.get("violations", []))
    ok &= step
    print(f"[2] shacl sh:not violation detected -> {'PASS' if step else 'FAIL'}")

    # ③ SHACL：languageIn —— 无语言标签违例
    r = http("POST", f"{GW}/api/v1/ont/v2/shacl/validate", {
        "target_class": EMP,
        "individuals": [{"rid": f"{EMP}#i3", "class_rid": EMP,
                         "props": {f"ont.{TENANT}.prop.name.v1": "plain"}}],
        "property_shapes": [
            {"path": f"ont.{TENANT}.prop.name.v1", "language_in": ["en"]}],
    }, token=tok)
    step = not r.get("conforms") and \
        any(v.get("constraint") == "languageIn" for v in r.get("violations", []))
    ok &= step
    print(f"[3] shacl languageIn violation -> {'PASS' if step else 'FAIL'}")

    # ④ SHACL：qualifiedValueShape
    r = http("POST", f"{GW}/api/v1/ont/v2/shacl/validate", {
        "target_class": EMP,
        "individuals": [{"rid": f"{EMP}#i4", "class_rid": EMP,
                         "props": {f"ont.{TENANT}.prop.name.v1":
                                   ["EMP-1", "nope"]}}],
        "property_shapes": [
            {"path": f"ont.{TENANT}.prop.name.v1",
             "qualified_value_shape": {
                 "path": f"ont.{TENANT}.prop.name.v1",
                 "pattern": r"^EMP-\d+$"},
             "qualified_min_count": 2}],
    }, token=tok)
    step = not r.get("conforms") and \
        any(v.get("constraint") == "qualifiedMinCount"
            for v in r.get("violations", []))
    ok &= step
    print(f"[4] shacl qualifiedMinCount violation -> {'PASS' if step else 'FAIL'}")

    # ⑤ G33 alignment：显式 + 词汇 + 结构 → 传递单簇
    lcls, rcls = "ont.tenant-default.obj.g33-cust-a.v1", \
        "ont.tenant-default.obj.g33-cust-b.v1"
    left = [
        {"rid": "a1", "class_rid": lcls,
         "props": {f"ont.{TENANT}.prop.name.v1": "n1",
                   "ont.{TENANT}.prop.email.v1".format(TENANT=TENANT):
                       "shared@corp.io",
                   f"ont.{TENANT}.prop.phone.v1": "555-0001"}},
        {"rid": "a2", "class_rid": lcls,
         "props": {f"ont.{TENANT}.prop.name.v1": "zeta"}},
    ]
    right = [
        {"rid": "b1", "class_rid": rcls,
         "props": {f"ont.{TENANT}.prop.title.v1": "w1",
                   f"ont.{TENANT}.prop.email.v1": "shared@corp.io",
                   f"ont.{TENANT}.prop.phone.v1": "555-0001"}},
        {"rid": "b2", "class_rid": rcls,
         "props": {f"ont.{TENANT}.prop.title.v1": "n1"}},
    ]
    r = http("POST", f"{GW}/api/v1/ont/v2/alignment/run", {
        "left": left, "right": right, "explicit_pairs": [["a1", "b1"]],
    }, token=tok)
    clusters = r.get("clusters", {})
    stats = r.get("stats", {})
    step = stats.get("matched", 0) >= 2 and len(clusters) == 1
    ok &= step
    print(f"[5] alignment clusters={clusters} stats={stats} "
          f"-> {'PASS' if step else 'FAIL'}")

    # ⑥ G33 merge-preview：字段并集 + 冲突 + 审计
    prop = lambda slug, type_id: {  # noqa: E731
        "rid": f"ont.{TENANT}.prop.{slug}.v1",
        "type_id": type_id, "nullable": slug != "id",
        "primary_key": slug == "id", "title": slug, "format": "string"}
    mk = lambda slug, props: {  # noqa: E731
        "rid": f"ont.{TENANT}.obj.{slug}.v1",
        "primary_key": [f"ont.{TENANT}.prop.id.v1"],
        "properties": props, "display_name": slug}
    r = http("POST", f"{GW}/api/v1/ont/v2/object-types/merge-preview", {
        "left": mk("g33-merge-a", [
            prop("id", "string"),
            prop("age", "integer")]),
        "right": mk("g33-merge-b", [
            prop("id", "string"),
            prop("age", "string"),
            prop("email", "string")]),
        "strategy": "keep_left",
    }, token=tok)
    audit = r.get("audit", {})
    merged_props = {p["rid"] for p in r.get("object_type", {}).get("properties", [])}
    step = (audit.get("added") == [f"ont.{TENANT}.prop.email.v1"]
            and len(audit.get("conflicts", [])) == 1
            and audit["conflicts"][0]["resolved"] == "integer"
            and f"ont.{TENANT}.prop.email.v1" in merged_props)
    ok &= step
    print(f"[6] merge-preview added={audit.get('added')} "
          f"conflicts={audit.get('conflicts')} -> {'PASS' if step else 'FAIL'}")

    print("ALL PASS" if ok else "SOME FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
