"""最终冲刺批次一 — Sprint 0 条件验收核销脚本（真实栈，无 mock）。v2

核销对象与条件：
  MP-DEDUP-01        partial UNIQUE / 版本 slug 冲突 / 并发创建 / 跨租户写读
                     隔离 / merge 回滚 / precheck 相似度
  MP-ONT-PROPOSAL-01 重复确认 / 未确认执行 / 非法转移 / 越权 / 故障回滚
  LEGACY 关闭         篡改 token → 401（签名强校验生效）
用法：.venv/Scripts/python scripts/smoke_sprint_final_batch1.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

GW = "http://localhost:8100"
TENANT = "tenant-default"
STAMP = uuid.uuid4().hex[:8]
OT = f"{GW}/api/v1/ont/v2"

RESULTS: list[tuple[str, bool, str]] = []


def http(
    method: str,
    url: str,
    body: dict | None = None,
    token: str | None = None,
    headers: dict | None = None,
    timeout: int = 60,
):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw
    except Exception as e:  # 连接层失败也记录，不吞线程异常
        return -1, str(e)


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")


def type_def(slug: str, version: str = "v1", tenant: str = TENANT) -> dict:
    return {
        "rid": f"ont.{tenant}.obj.batch1.{slug}.{version}",
        "primary_key": [f"ont.{tenant}.prop.batch1-{slug}-id.v1"],
        "properties": [
            {
                "rid": f"ont.{tenant}.prop.batch1-{slug}-id.v1",
                "type_id": "string",
                "nullable": False,
                "primary_key": True,
                "title": "ID",
                "format": "string",
            }
        ],
        "display_name": slug,
    }


def main() -> int:
    code, body = http(
        "POST", f"{GW}/api/v1/iam/auth/login", {"username": "admin", "password": "admin123"}
    )
    tok = body["accessToken"] if isinstance(body, dict) else ""
    check("login.keycloak", code == 200 and tok != "", f"code={code}")

    # ---------- A. LEGACY 关闭：签名强校验 ----------
    tampered = tok[:-6] + ("AAAAAA" if not tok.endswith("AAAAAA") else "BBBBBB")
    code, _ = http("GET", f"{OT}/object-types", token=tampered)
    check("auth.tampered_token_rejected", code == 401, f"code={code}")
    code, _ = http("GET", f"{OT}/object-types", headers={"Authorization": "Bearer not.a.jwt"})
    check("auth.garbage_token_rejected", code == 401, f"code={code}")

    # ---------- B. MP-DEDUP-01 ----------
    slug_a = f"dedupa-{STAMP}"
    code1, _ = http("POST", f"{OT}/object-types", type_def(slug_a), token=tok)

    # B1: 同 slug 不同版本 → 409 slug_conflict（partial UNIQUE 触发）
    code2, b2 = http("POST", f"{OT}/object-types", type_def(slug_a, "v2"), token=tok)
    check(
        "dedup.slug_conflict_409",
        code1 == 200 and code2 == 409,
        f"v1={code1} v2={code2} "
        f"{json.dumps(b2, ensure_ascii=False)[:100] if isinstance(b2, dict) else ''}",
    )

    # B2: 并发创建同 slug 不同版本（4 线程）→ 恰好 1 成功，其余 409
    slug_c = f"dedupc-{STAMP}"
    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = list(
            pool.map(
                lambda i: http(
                    "POST", f"{OT}/object-types", type_def(slug_c, f"v{i + 1}"), token=tok
                )[0],
                range(4),
            )
        )
    check(
        "dedup.concurrent_create", codes.count(200) == 1 and codes.count(409) >= 1, f"codes={codes}"
    )

    # B3: 跨租户写读隔离（GOVERN-06 修复后）
    code, _ = http(
        "POST", f"{OT}/object-types", type_def("dedupx", tenant="tenant-other"), token=tok
    )
    code_g, _ = http("GET", f"{OT}/object-types/ont.tenant-other.obj.batch1.dedupx.v1", token=tok)
    check(
        "dedup.cross_tenant_write_read_blocked",
        code == 403 and code_g == 404,
        f"write={code} read={code_g}",
    )

    # B4: merge 回滚（6 段 rid）
    slug_s = f"dedups-{STAMP}"
    http("POST", f"{OT}/object-types", type_def(slug_s), token=tok)
    code, prop = http(
        "POST",
        f"{OT}/object-types/propose-merge",
        {
            "source_rid": f"ont.{TENANT}.obj.batch1.{slug_s}.v1",
            "target_rid": f"ont.{TENANT}.obj.batch1.{slug_a}.v1",
            "similarity": 0.95,
            "impact_summary": "batch1 merge revert",
        },
        token=tok,
    )
    pid = prop.get("proposal_id", "") if isinstance(prop, dict) else ""
    code_c, _ = http(
        "POST",
        f"{OT}/proposals/{pid}/confirm",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    code_e, exe = http(
        "POST",
        f"{OT}/proposals/{pid}/execute",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    code_r, rev = http(
        "POST",
        f"{OT}/proposals/{pid}/revert",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    merged_ok = code_c == 200 and code_e == 200
    check(
        "dedup.merge_revert",
        merged_ok and code_r == 200,
        f"confirm={code_c} exec={code_e} revert={code_r} "
        f"{json.dumps(rev, ensure_ascii=False)[:150] if isinstance(rev, dict) else ''}",
    )

    # B5: precheck 相似度
    code, pre = http(
        "POST",
        f"{OT}/object-types/precheck",
        {"name": slug_a, "slug": slug_a, "top_k": 3},
        token=tok,
    )
    cands = pre.get("candidates", []) if isinstance(pre, dict) else []
    check(
        "dedup.precheck_candidates",
        code == 200 and len(cands) >= 1 and cands[0].get("similarity", 0) > 0,
        f"top sim={cands[0].get('similarity')}" if cands else "no candidates",
    )

    # ---------- C. MP-ONT-PROPOSAL-01 ----------
    slug_m = f"propm-{STAMP}"
    td = {
        "rid": f"ont.{TENANT}.obj.batch1.{slug_m}.v1",
        "primary_key": [f"ont.{TENANT}.prop.batch1-{slug_m}-id.v1"],
        "properties": [
            {
                "rid": f"ont.{TENANT}.prop.batch1-{slug_m}-id.v1",
                "type_id": "string",
                "nullable": False,
                "primary_key": True,
                "title": "ID",
                "format": "string",
            },
            {
                "rid": f"ont.{TENANT}.prop.batch1-{slug_m}-name.v1",
                "type_id": "string",
                "nullable": True,
                "primary_key": False,
                "title": "Name",
                "format": "string",
            },
        ],
        "display_name": f"PropModel {STAMP}",
    }
    code, p1 = http(
        "POST",
        f"{OT}/object-types/propose",
        {"type_def": td, "impact_summary": "batch1 proposal closure"},
        token=tok,
    )
    p1id = p1.get("proposal_id", "") if isinstance(p1, dict) else ""
    check("prop.model_type_pending", code == 200 and p1.get("status") == "pending", f"code={code}")

    code, _ = http(
        "POST",
        f"{OT}/proposals/{p1id}/execute",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    check("prop.execute_unconfirmed_409", code == 409, f"code={code}")

    code, _ = http(
        "POST",
        f"{OT}/proposals/{p1id}/confirm",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    check("prop.confirm_200", code == 200, f"code={code}")

    code, _ = http(
        "POST",
        f"{OT}/proposals/{p1id}/confirm",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    check("prop.duplicate_confirm_409", code == 409, f"code={code}")

    code, _ = http(
        "POST",
        f"{OT}/proposals/{p1id}/execute",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    code_g, _ = http("GET", f"{OT}/object-types/{td['rid']}", token=tok)
    check("prop.execute_registers_type", code == 200 and code_g == 200, f"exec={code} get={code_g}")

    code, _ = http(
        "POST",
        f"{OT}/proposals/{p1id}/confirm",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    check("prop.invalid_transition_409", code == 409, f"code={code}")

    foreign_def = json.loads(json.dumps(td).replace(f"ont.{TENANT}.", "ont.tenant-other."))
    code, _ = http(
        "POST",
        f"{OT}/object-types/propose",
        {"type_def": foreign_def, "impact_summary": "x"},
        token=tok,
    )
    check("prop.cross_tenant_403", code == 403, f"code={code}")

    # C7: create_instance 全链 + 故障回滚（实例删除等价）
    # props 键用 property slug（execute_proposal 以 slug 查 PK 值）
    code, p2 = http(
        "POST",
        f"{OT}/classes/{td['rid']}/propose-instance",
        {
            "props": {
                f"batch1-{slug_m}-id": f"i-{STAMP}",
                f"ont.{TENANT}.prop.batch1-{slug_m}-name.v1": "alpha",
            },
            "impact_summary": "instance revert check",
        },
        token=tok,
    )
    p2id = p2.get("proposal_id", "") if isinstance(p2, dict) else ""
    http(
        "POST",
        f"{OT}/proposals/{p2id}/confirm",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    code_e, exe2 = http(
        "POST",
        f"{OT}/proposals/{p2id}/execute",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    ind_rid = exe2.get("individual_rid", "") if isinstance(exe2, dict) else ""
    if code_e != 200:
        print(f"  [diag] instance exec detail: {json.dumps(exe2, ensure_ascii=False)[:200]}")
    code_g, _ = http("GET", f"{OT}/individuals/{ind_rid}", token=tok) if ind_rid else (0, "")
    code_r, rev2 = http(
        "POST",
        f"{OT}/proposals/{p2id}/revert",
        {},
        token=tok,
        headers={"Idempotency-Key": uuid.uuid4().hex},
    )
    code_g2, _ = http("GET", f"{OT}/individuals/{ind_rid}", token=tok) if ind_rid else (0, "")
    check(
        "prop.instance_revert_rollback",
        code_e == 200 and code_g == 200 and code_r == 200 and code_g2 == 404,
        f"exec={code_e} get={code_g} revert={code_r} post_get={code_g2}",
    )

    print("\n==== SUMMARY ====")
    fails = [r for r in RESULTS if not r[1]]
    for n, ok, d in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'} {n} {d}")
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} passed")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
