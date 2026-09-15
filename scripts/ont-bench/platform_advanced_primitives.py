"""平台层高级基元验证：LinkType / LinkInstance / Interface / Axiom / Version / around。

在已导入的 patient_intake 域之上，通过运行中平台的 HTTP API 补齐关系与推理基元：
  1. 建 InsuranceProvider ObjectType + 6 个 provider 实例；
  2. 建 LinkType patient→provider（N:1，链接属性承载保单细节）；
  3. 由患者的 insurance_provider 属性派生 66 条 LinkInstance；
  4. 用 GET /individuals/{rid}/around 验证一跳遍历；
  5. 建 Interface（6 个输出列的形状契约）+ 查询 implementations；
  6. 建 Axiom（HAS_KEY）+ Version 快照。

用法：
    python scripts/ont-bench/platform_advanced_primitives.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://localhost:8100"
TENANT = "tenant-default"
D = "patient-intake"
DS = "sopbench-patient-intake"
DATA = Path(".tmp/sop-bench/patient_intake")

OBJ = f"ont.{TENANT}.obj.{DS}.v1"
PROV = f"ont.{TENANT}.obj.{DS}-provider.v1"
LINK = f"ont.{TENANT}.link.{DS}-insured-by.v1"
IFACE = f"ont.{TENANT}.if.{DS}-scorable.v1"
AXIOM = f"ont.{TENANT}.ax.{DS}-patient-key.v1"

TOKEN = ""
RESULTS: list[tuple[str, bool, str]] = []


def check(desc: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((desc, ok, detail))


def call(method: str, path: str, body: object | None = None):
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
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"


def prop(slug: str, type_id: str = "string", pk: bool = False) -> dict:
    return {
        "rid": f"ont.{TENANT}.prop.{DS}-{slug}.v1",
        "type_id": type_id,
        "nullable": not pk,
        "primary_key": pk,
        "title": slug,
        "format": type_id,
    }


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.strip().lower()).strip("-") or "x"


def _count_links(link_type_rid: str) -> int:
    """只读查询 PG 中该 LinkType 的实际行数（绕过 API 重放缺陷）。"""
    try:
        import sys as _sys

        _sys.path.insert(0, str(Path("mate-platform-backend/packages/mate-tech-ont/src").resolve()))
        import psycopg2

        conn = psycopg2.connect("postgresql://meta:meta@localhost:5432/metaplatform")
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM ont_link_instance WHERE link_type_rid = %s",
                    (link_type_rid,),
                )
                return int(cur.fetchone()[0])
        finally:
            conn.close()
    except Exception:
        return -1


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
    print(f"login OK\n")

    rows = list(csv.DictReader((DATA / "test_set_with_outputs.csv").open(encoding="utf-8")))

    # ── 1) Provider 类型 + 实例 ──
    p_prov = prop("provider-name", pk=True)
    st, _ = call(
        "POST",
        "/api/v1/ont/v2/object-types",
        {
            "rid": PROV,
            "primary_key": [p_prov["rid"]],
            "properties": [p_prov],
            "display_name": "Insurance Provider",
            "type_group": "sop-bench",
        },
    )
    check("ObjectType: InsuranceProvider 注册", st == 200, f"status={st}")
    providers = sorted({r["insurance_provider"].strip() for r in rows})
    ok = 0
    for pn in providers:
        st, _ = call(
            "POST",
            "/api/v1/ont/v2/individuals",
            {
                "rid": f"ont.{TENANT}.ind.{DS}-provider.{slugify(pn)}",
                "class_rid": PROV,
                "props": {p_prov["rid"]: {"value": pn, "type": "string"}},
                "primary_key": pn,
            },
        )
        ok += st == 200
    check(f"Individual: {len(providers)} 个 provider 实例", ok == len(providers), f"ok={ok}")

    # ── 2) LinkType ──
    st, _ = call(
        "POST",
        "/api/v1/ont/v2/link-types",
        {
            "rid": LINK,
            "src": OBJ,
            "dst": PROV,
            "cardinality": "N:1",
            "directionality": "directed",
            "link_properties": [
                prop("policy-number"),
                prop("group-number"),
                prop("coverage-start-date"),
                prop("insurance-type"),
            ],
            "src_display_name": "insurance",
            "dst_display_name": "covered patients",
            "description": "患者投保的保险公司（链接属性承载保单细节）",
        },
    )
    check("LinkType: patient ─insured-by→ provider (N:1)", st == 200, f"status={st}")

    # ── 3) LinkInstance（由患者属性派生）──
    t0 = time.perf_counter()
    created = existed = err = 0
    for r in rows:
        pid = r["patient_id"].strip()
        pn = r["insurance_provider"].strip()
        st, _ = call(
            "POST",
            "/api/v1/ont/v2/link-instances",
            {
                "rid": f"ont.{TENANT}.lnk.{DS}-insured-by.{slugify(pid)}.{slugify(pn)}",
                "link_type_rid": LINK,
                "src": f"ont.{TENANT}.ind.{DS}.{slugify(pid)}",
                "dst": f"ont.{TENANT}.ind.{DS}-provider.{slugify(pn)}",
                "props": {
                    prop("policy-number")["rid"]: {
                        "value": r["policy_number"].strip(),
                        "type": "string",
                    },
                    prop("group-number")["rid"]: {
                        "value": r["group_number"].strip(),
                        "type": "string",
                    },
                    prop("coverage-start-date")["rid"]: {
                        "value": r["coverage_start_date"].strip(),
                        "type": "string",
                    },
                    prop("insurance-type")["rid"]: {
                        "value": r["insurance_type"].strip(),
                        "type": "string",
                    },
                },
            },
        )
        if st == 200:
            created += 1
        elif st in (409, 400):
            existed += 1  # 重跑幂等：已存在
        else:
            err += 1
    dt = time.perf_counter() - t0
    # 注意：pg_repo.create_link_instance 未传 exclude_rid，同 rid 重放会被基数校验
    # 误判为第二条件边 → 500（in_memory 路径正确排除）。故以 PG 实际行数为准。
    actual = _count_links(LINK)
    check(
        f"LinkInstance: {len(rows)} 条投保关系",
        actual == len(rows),
        f"created={created} err={err} pg_actual={actual} {dt:.1f}s",
    )

    # ── 4) around 一跳遍历 ──
    pid0 = rows[0]["patient_id"].strip()
    st, body = call(
        "GET", f"/api/v1/ont/v2/individuals/ont.{TENANT}.ind.{DS}.{slugify(pid0)}/around"
    )
    groups = body if isinstance(body, list) else (body or {}).get("groups", [])
    found = isinstance(body, (list, dict)) and "insurance" in json.dumps(body, ensure_ascii=False)
    check(
        f"around 一跳遍历（患者 → 保险对端）",
        st == 200 and found,
        f"status={st} groups={len(groups) if isinstance(groups, list) else '?'}",
    )
    peer_ok = rows[0]["insurance_provider"].strip() in json.dumps(body, ensure_ascii=False)
    check("around 对端解析正确（provider 名匹配）", peer_ok)

    # ── 5) Interface ──
    out_cols = [
        "insurance-validation",
        "prescription-insurance-validation",
        "pharmacy-check",
        "life-style-risk-level",
        "overall-risk-level",
        "user-registration",
    ]
    st, _ = call(
        "POST",
        "/api/v1/ont/v2/interfaces",
        {
            "rid": IFACE,
            "properties": [prop(f"{DS}-{c}") for c in out_cols],
            "required_links": [],
        },
    )
    check("Interface: scorable（6 个输出列形状契约）", st == 200, f"status={st}")

    # ── 6) Axiom + Version ──
    st, _ = call(
        "POST",
        "/api/v1/ont/v2/axioms",
        {
            "rid": AXIOM,
            "kind": "has_key",
            "operands": [OBJ, prop(f"{DS}-patient-id")["rid"]],
            "rule_ref": "builtin.has_key",
            "metadata": [["sop", "§4.2 patient_id 唯一标识"]],
        },
    )
    check("Axiom: HAS_KEY(patient, patient_id)", st == 200, f"status={st}")

    st, _ = call(
        "POST",
        f"/api/v1/ont/v2/versions/{OBJ}",
        {"class_ref": OBJ, "author": "sopbench-platform", "change_set": ["initial-schema"]},
    )
    check("Version: schema 快照", st in (200, 201), f"status={st}")

    print("=" * 76)
    failed = 0
    for desc, ok, detail in RESULTS:
        if not ok:
            failed += 1
        print(f"[{'PASS' if ok else 'FAIL'}] {desc}" + (f"  — {detail}" if detail else ""))
    print("=" * 76)
    print(f"{len(RESULTS) - failed}/{len(RESULTS)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
