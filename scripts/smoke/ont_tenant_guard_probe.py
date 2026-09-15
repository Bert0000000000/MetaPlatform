#!/usr/bin/env python3
"""跨租户守门实测：对全部带 ``{rid}`` 的 v2 端点打「其他租户」的 rid。

判定：以 tenant-default 的 JWT 请求 ``ont.other-tenant.*`` 资源，
- 期望 **403**（源码级前缀守门拒绝）或 **404**（不存在）；
- 若返回 200 且带回该租户真实数据 → **泄漏**（FAIL）。

为什么需要造数据：只塞一个不存在的 rid，无守门的端点也会返回 404（查不到），
看不出泄漏。所以脚本先用超级用户把 other-tenant 的对象/动作/链接/实例/公理/
策略各造一份，再逐个端点探测。

用法::

    python scripts/smoke/ont_tenant_guard_probe.py            # 探测 + 报告
    python scripts/smoke/ont_tenant_guard_probe.py --cleanup  # 只清测试数据
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

import psycopg2  # type: ignore

GATEWAY = "http://localhost:8100/api/v1/ont/v2"
DB = "metaplatform_ont"
ADMIN_DSN = f"postgresql://meta:meta@localhost:5432/{DB}"
OTHER = "other-tenant"
PFX = "guardprobe"
# 哨兵：只出现在他租户对象的**内容**里（display_name）。响应回显 rid 不算泄漏，
# 只有真读到内容才会带上哨兵 —— 避免把「200 + 回显 rid」误判成泄漏。
SENTINEL = "GUARDPROBE_SENTINEL"

OBJ = f"ont.{OTHER}.obj.{PFX}.thing.v1"
P_ID = f"ont.{OTHER}.prop.{PFX}.thing-id.v1"
ACT = f"ont.{OTHER}.act.{PFX}.do-thing.v1"
LT = f"ont.{OTHER}.link.{PFX}.thing-self.v1"
IND = f"ont.{OTHER}.ind.{PFX}-thing.t1"
AX = f"ont.{OTHER}.ax.{PFX}.subclass.v1"
WIP = f"ont.{OTHER}.obj.{PFX}.wip-target.v1"
POLICY = f"pol-{PFX}-{OTHER}"
FUNC = f"ont.{OTHER}.fn.{PFX}.noop.v1"

_TOKEN = ""


def _login() -> str:
    req = urllib.request.Request(
        "http://localhost:8100/api/v1/iam/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["accessToken"]


def call(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    global _TOKEN
    if not _TOKEN:
        _TOKEN = _login()
    req = urllib.request.Request(
        f"{GATEWAY}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {_TOKEN}",
            "Content-Type": "application/json",
            "Idempotency-Key": f"guardprobe-{method}-{abs(hash(path)) % 10**8}",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw or b"{}")
            except Exception:  # noqa: BLE001
                return r.status, raw[:200]
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except Exception:  # noqa: BLE001
            return e.code, raw[:200]


def seed() -> None:
    """超级用户直插 other-tenant 数据（绕过 API，确保是「已存在的数据」）。"""
    conn = psycopg2.connect(ADMIN_DSN)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO ont_object_type
               (rid, tenant_id, slug, primary_key, properties, interfaces, display_name,
                marking, archived, parent_class, updated_at)
               VALUES (%s,%s,%s,%s,%s::jsonb,'{}',%s,'{}',FALSE,'',now())
               ON CONFLICT (rid) DO UPDATE SET display_name = EXCLUDED.display_name""",
            (
                OBJ,
                OTHER,
                PFX,
                [P_ID],
                json.dumps(
                    [
                        {
                            "rid": P_ID,
                            "type_id": "string",
                            "nullable": False,
                            "primary_key": True,
                            "title": "id",
                            "format": "string",
                        }
                    ]
                ),
                SENTINEL,
            ),
        )
        cur.execute(
            """INSERT INTO ont_individual
               (rid, tenant_id, class_rid, props, primary_key, marking, created_at, updated_at)
               VALUES (%s,%s,%s,%s::jsonb,%s,'{}',now(),now())
               ON CONFLICT (rid) DO NOTHING""",
            (IND, OTHER, OBJ, json.dumps({P_ID: "t1"}), "t1"),
        )
        cur.execute(
            """INSERT INTO ont_action_type
               (rid, tenant_id, parameters, submission_criteria, side_effects, function_ref,
                target_object_types, title, description, declarative_edits, updated_at)
               VALUES (%s,%s,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,%s,%s,'GuardProbe','',
                       '[]'::jsonb,now())
               ON CONFLICT (rid) DO NOTHING""",
            (ACT, OTHER, FUNC, [OBJ]),
        )
        cur.execute(
            """INSERT INTO ont_link_type
               (rid, tenant_id, src_rid, dst_rid, cardinality, directionality,
                link_properties, src_display_name, dst_display_name, description)
               VALUES (%s,%s,%s,%s,'1-n','directed','[]','','','')
               ON CONFLICT (rid) DO NOTHING""",
            (LT, OTHER, OBJ, OBJ),
        )
        cur.execute(
            """INSERT INTO ont_axiom (rid, tenant_id, kind, operands, rule_ref, enabled, created_at)
               VALUES (%s,%s,'subclass',%s,'probe',TRUE,now())
               ON CONFLICT (rid) DO NOTHING""",
            (AX, OTHER, [OBJ, OBJ]),
        )
        cur.execute(
            """INSERT INTO ont_schema_wip (rid, tenant_id, author, payload, created_at)
               VALUES (%s,%s,'probe','{}'::jsonb,now()) ON CONFLICT (rid) DO NOTHING""",
            (WIP, OTHER),
        )
    conn.close()
    print(f"seeded {OTHER!r} probe rows")


def cleanup() -> None:
    conn = psycopg2.connect(ADMIN_DSN)
    conn.autocommit = True
    with conn.cursor() as cur:
        for tbl in (
            "ont_schema_wip",
            "ont_axiom",
            "ont_link_type",
            "ont_action_type",
            "ont_individual",
            "ont_object_type",
        ):
            cur.execute(f"DELETE FROM {tbl} WHERE tenant_id = %s", (OTHER,))
    conn.close()
    print(f"cleaned {OTHER!r} probe rows")


# (method, path_template, body) —— 全部用 other-tenant 的 rid
PROBES: list[tuple[str, str, dict | None]] = [
    ("GET", f"/object-types/{OBJ}", None),
    ("GET", f"/object-types/{OBJ}/export", None),
    ("GET", f"/object-types/{OBJ}/diff?against=x", None),
    ("POST", f"/object-types/{OBJ}/properties", {"property": {}}),
    ("POST", f"/object-types/{OBJ}/branch", {"note": "probe"}),
    ("POST", f"/object-types/{OBJ}/rollback", {"to_version": "v1"}),
    ("POST", f"/object-types/{OBJ}/lifecycle", {"action": "snooze"}),
    ("GET", f"/object-types/{OBJ}/datasources", None),
    ("POST", f"/object-types/{OBJ}/datasources", {"class_rid": OBJ, "name": "p", "table": "t", "pk_column": "c"}),
    ("GET", f"/object-types/{OBJ}/materialization", None),
    ("POST", f"/object-types/wip/{WIP}/apply", {}),
    ("DELETE", f"/object-types/wip/{WIP}", None),
    ("GET", f"/action-types/{ACT}", None),
    ("GET", f"/action-types/{ACT}/flow", None),
    ("POST", f"/action-types/{ACT}/propose", {"parameters": {}}),
    ("POST", f"/action-types/{ACT}/propose-edit-set", {"parameters": {}}),
    ("POST", f"/action-types/{ACT}/apply-edit-set", {"parameters": {}}),
    ("POST", f"/action-types/{ACT}/apply", {"parameters": {}}),
    ("GET", f"/link-types/{LT}", None),
    ("GET", f"/individuals/{IND}", None),
    ("GET", f"/individuals/{IND}/around", None),
    ("GET", f"/interfaces/{OBJ}/implementations", None),
    ("GET", f"/functions/{FUNC}/versions", None),
    ("POST", f"/functions/{FUNC}/invoke", {"parameters": {}}),
    ("DELETE", f"/reasoning/axioms/{AX}", None),
    ("DELETE", f"/security-policies/{POLICY}", None),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cleanup", action="store_true", help="只清测试数据")
    args = parser.parse_args()

    if args.cleanup:
        cleanup()
        return 0

    cleanup()
    seed()

    leaks: list[str] = []
    guarded: list[str] = []
    notfound: list[str] = []
    noop: list[str] = []
    other: list[str] = []

    print(f"\n{'STATUS':<10} {'CODE':<5} {'METHOD':<7} PATH")
    for method, path, body in PROBES:
        code, payload = call(method, path, body)
        text = (
            payload.decode("utf8", "ignore")
            if isinstance(payload, bytes)
            else json.dumps(payload, ensure_ascii=False)
        )
        if code == 403:
            status, bucket = "GUARDED", guarded
        elif code == 404:
            status, bucket = "404", notfound
        elif code == 200:
            # 写操作：看响应里的实际效果字段（deleted/discarded/ok）
            if isinstance(payload, dict) and any(
                k in payload for k in ("deleted", "discarded", "ok")
            ):
                acted = any(
                    payload.get(k) is True for k in ("deleted", "discarded", "ok")
                )
                if acted or SENTINEL in text:
                    status, bucket = "**LEAK**", leaks
                else:
                    # 200 但没动到数据（RLS / 查询过滤兜住）—— 安全，但缺源码级守门
                    status, bucket = "noop-200", noop
            elif SENTINEL in text:
                status, bucket = "**LEAK**", leaks
            else:
                status, bucket = "200-empty", noop
        else:
            status, bucket = f"{code}?", other
        bucket.append(f"{method} {path} ({code})")
        print(f"{status:<10} {code:<5} {method:<7} {path}")

    print(f"\n{'=' * 64}")
    print(
        f"守卫 403: {len(guarded)} | 404: {len(notfound)} | "
        f"noop-200(缺源码守门但未泄漏): {len(noop)} | 泄漏: {len(leaks)} | 其他: {len(other)}"
    )
    if leaks:
        print("\nLEAKS (跨租户真读到/改到他租户数据):")
        for x in leaks:
            print("  -", x)
    if noop:
        print("\n缺源码级守门（当前靠 RLS/查询过滤兜住，建议补 403）：")
        for x in noop:
            print("  -", x)
    if other:
        print("\n其他状态（需人工判定）:")
        for x in other:
            print("  -", x)

    cleanup()
    return 1 if leaks else 0


if __name__ == "__main__":
    sys.exit(main())
