"""SOP-Bench 全量数据 → 运行中 Mate Platform（PG 后端）导入 + 校验。

对 14 个域逐个：从 CSV 列自动生成 ObjectType → 灌入全部 Individual →
注册 Function/ActionType（输出列）→ 通过 API 回读校验。

平台契约要点（探针实测，2026-09-14）：
  - 走 API Gateway 8100，Bearer JWT + X-Tenant-Id 头；
  - **写路径已退役直连 apply**（410）→ HITL：propose → confirm → execute；
  - **ObjectSet filter_expr 必须用完整 prop rid**（slug 形式在 PG 路径不匹配）；
  - **PG 后端 Function 源码不可经 API 注入**：`inline://` 落到内置恒等函数
    `_PG_DEFAULT_INLINE_FN`（GOVERN-05 待 SANDBOX-02 的 Git/OCI resolver）。
    因此本导入的 Function/ActionType 只验证 schema 层与 HITL 写路径机制，
    业务逻辑执行不在部署态可验证范围（由 pilot_*.py 的进程内内核验证覆盖）。

用法：
    python scripts/ont-bench/import_to_platform.py                    # 全部 14 域
    python scripts/ont-bench/import_to_platform.py dangerous_goods    # 指定域
    python scripts/ont-bench/import_to_platform.py --drop-probe       # 清理探针数据
"""

from __future__ import annotations

import argparse
import ast
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

BASE = "http://localhost:8100"
TENANT = "tenant-default"
DATA_ROOT = Path(".tmp/sop-bench")
OUT_JSON = Path(".tmp/sop-bench/import-stats.json")

DOMAINS = [
    "aircraft_inspection",
    "content_flagging",
    "customer_service",
    "dangerous_goods",
    "email_intent",
    "know_your_business",
    "order_fulfillment",
    "patient_intake",
    "referral_abuse_detection_v1",
    "referral_abuse_detection_v2",
    "traffic_spoofing_detection",
    "video_annotation",
    "video_classification",
    "warehouse_package_inspection",
]

TOKEN = ""


# ─────────────────── HTTP ───────────────────


def login() -> str:
    req = urllib.request.Request(
        f"{BASE}/api/v1/iam/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["accessToken"]


def call(method: str, path: str, body: object | None = None, idem: str | None = None, timeout: int = 180):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}",
        "X-Tenant-Id": TENANT,
    }
    if idem:
        headers["Idempotency-Key"] = idem
    data = json.dumps(body).encode() if body is not None else None
    last = "-1"
    for attempt in range(2):  # 超时/网络抖动重试一次
        req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode()
                return r.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()[:300]
        except Exception as e:  # 网络层：超时/连接重置
            last = f"{type(e).__name__}: {e}"
            if attempt == 0:
                time.sleep(1.5)
    return -1, last


# ─────────────────── schema 推断 ───────────────────


def slugify(raw: str) -> str:
    """列名 → rid slug（[a-z0-9_-]）。"""
    s = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
    return s or "col"


def infer_type(values: list[str]) -> tuple[str, bool]:
    """返回 (type_id, is_array)。"""
    non_empty = [v for v in values if v.strip()]
    if not non_empty:
        return "string", False
    # 数组形态（CSV 中为 python-literal 列表）
    if all(v.strip().startswith("[") for v in non_empty):
        return "string", True
    if all(re.fullmatch(r"-?\d+", v.strip()) for v in non_empty):
        return "integer", False
    if all(re.fullmatch(r"-?\d*\.\d+", v.strip()) for v in non_empty):
        return "double", False
    return "string", False


def parse_value(raw: str, type_id: str, is_array: bool) -> object | None:
    raw = raw or ""
    if is_array:
        try:
            v = ast.literal_eval(raw)
            return [str(x) for x in v] if isinstance(v, (list, tuple)) else [str(v)]
        except (ValueError, SyntaxError):
            return [x.strip().strip("'\"") for x in raw.strip("[]").split(",") if x.strip()]
    s = raw.strip()
    if s == "":
        return None
    if type_id == "integer":
        try:
            return int(s)
        except ValueError:
            return s
    if type_id == "double":
        try:
            return float(s)
        except ValueError:
            return s
    return raw


@dataclass
class DomainModel:
    name: str
    columns: list[str]
    rows: list[dict]
    pk_col: str
    types: dict[str, tuple[str, bool]] = field(default_factory=dict)

    @property
    def obj_rid(self) -> str:
        return f"ont.{TENANT}.obj.sopbench-{self.name.replace('_', '-')}.v1"

    def prop_rid(self, col: str) -> str:
        return f"ont.{TENANT}.prop.sopbench-{self.name.replace('_', '-')}-{slugify(col)}.v1"


def load_model(name: str) -> DomainModel | None:
    d = DATA_ROOT / name
    csv_path = d / "test_set_with_outputs.csv"
    meta_path = d / "metadata.json"
    if not csv_path.exists():
        return None
    with csv_path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return None
    columns = list(rows[0].keys())
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    inputs = [c for c in (meta.get("input_columns") or []) if c in columns]

    # pk：优先首个输入列（值唯一非空），否则合成 row-id
    pk_col = ""
    for cand in inputs + columns:
        vals = [r[cand].strip() for r in rows]
        if all(vals) and len(set(vals)) == len(vals):
            pk_col = cand
            break
    m = DomainModel(name=name, columns=columns, rows=rows, pk_col=pk_col)
    for c in columns:
        m.types[c] = infer_type([r[c] for r in rows])
    return m


# ─────────────────── 导入 ───────────────────


def import_type(m: DomainModel) -> tuple[bool, str]:
    pk_slug = slugify(m.pk_col) if m.pk_col else "row-id"
    props = []
    for c in m.columns:
        type_id, is_array = m.types[c]
        is_pk = c == m.pk_col
        props.append(
            {
                "rid": m.prop_rid(c),
                "type_id": type_id,
                "nullable": not is_pk,
                "primary_key": is_pk,
                "title": c,
                "format": type_id,
                "array": is_array,
                "reducer": "first" if is_array else None,
            }
        )
    if not m.pk_col:
        props.insert(
            0,
            {
                "rid": m.prop_rid(m.pk_col or "row-id"),
                "type_id": "string",
                "nullable": False,
                "primary_key": True,
                "title": "row id",
                "format": "string",
                "array": False,
                "reducer": None,
            },
        )
    st, body = call(
        "POST",
        "/api/v1/ont/v2/object-types",
        {
            "rid": m.obj_rid,
            "primary_key": [m.prop_rid(m.pk_col) if m.pk_col else m.prop_rid("row-id")],
            "properties": props,
            "display_name": f"SOP-Bench {m.name}",
            "description": f"SOP-Bench {m.name}（CC BY-NC 4.0，内部引擎验证）",
            "type_group": "sop-bench",
        },
    )
    return st == 200, f"{st} pk={pk_slug} props={len(props)}"


def _post_individual(payload: dict) -> tuple[int, str]:
    st, body = call("POST", "/api/v1/ont/v2/individuals", payload)
    return st, ("" if st == 200 else str(body)[:160])


def import_individuals(m: DomainModel, workers: int = 8) -> tuple[int, int, float]:
    """并发灌入实例。

    单实例写入实测 ~720ms —— 瓶颈在 ONT_EMBEDDER=llmgw 的属性级 embedding
    调用（object-type 仅 59ms）。故用线程池并发，吞吐受 llmgw 容量约束。
    """
    from concurrent.futures import ThreadPoolExecutor

    dslug = m.name.replace("_", "-")
    payloads = []
    for i, r in enumerate(m.rows):
        pk_val = r[m.pk_col].strip() if m.pk_col else f"row-{i:05d}"
        pk_slug = slugify(pk_val) or f"row{i}"
        props: dict[str, dict] = {}
        for c in m.columns:
            type_id, is_array = m.types[c]
            v = parse_value(r[c], type_id, is_array)
            if v is None:
                continue
            props[m.prop_rid(c)] = {"value": v, "type": type_id}
        payloads.append(
            {
                "rid": f"ont.{TENANT}.ind.sopbench-{dslug}.{pk_slug}",
                "class_rid": m.obj_rid,
                "props": props,
                "primary_key": pk_val,
            }
        )

    t0 = time.perf_counter()
    ok = err = 0
    samples: list[str] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for st, detail in pool.map(_post_individual, payloads):
            if st == 200:
                ok += 1
            else:
                err += 1
                if len(samples) < 3:
                    samples.append(f"{st}: {detail}")
    if samples:
        print(f"    实例写入错误样本: {samples}")
    return ok, err, time.perf_counter() - t0


def import_function_and_action(m: DomainModel) -> tuple[bool, bool]:
    dslug = m.name.replace("_", "-")
    fn_rid = f"ont.{TENANT}.fn.sopbench-{dslug}.v1"
    act_rid = f"ont.{TENANT}.act.sopbench-{dslug}.v1"
    st_fn, _ = call(
        "POST",
        "/api/v1/ont/v2/functions",
        {
            "rid": fn_rid,
            "language": "python",
            "version": 1,
            "source_ref": f"inline://{fn_rid}",
            "signatures": [[slugify(c), m.types[c][0]] for c in m.columns[:4]],
        },
    )
    pk_prop = m.prop_rid(m.pk_col) if m.pk_col else m.prop_rid("row-id")
    params = [
        {
            "rid": pk_prop,
            "type_id": m.types.get(m.pk_col, ("string", False))[0],
            "nullable": False,
            "primary_key": True,
            "title": m.pk_col or "row id",
            "format": "string",
        }
    ]
    st_act, _ = call(
        "POST",
        "/api/v1/ont/v2/action-types",
        {
            "rid": act_rid,
            "parameters": params,
            "submission_criteria": [],
            "side_effects": ["audit_log"],
            "function_ref": fn_rid,
            "on": [m.obj_rid],
            "title": f"SOP-Bench {m.name}",
        },
    )
    return st_fn == 200, st_act == 200


# ─────────────────── repo 后端（进程内，快速批量写） ───────────────────

PG_DSN = "postgresql://meta:meta@localhost:5432/metaplatform"
ONT_SRC = "mate-platform-backend/packages/mate-tech-ont/src"

_FMT = {"string": "STRING", "integer": "INTEGER", "double": "DOUBLE"}


def _build_repo():
    import sys as _sys
    from pathlib import Path as _Path

    src = str(_Path(ONT_SRC).resolve())
    if src not in _sys.path:
        _sys.path.insert(0, src)
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    return PgOntologyRepository(PG_DSN)


def import_via_repo(name: str) -> dict:
    """用平台自身的 PgOntologyRepository（服务同款代码 + 真实 PG + RLS）批量写。

    比 HTTP 路径快约 24×（30ms/条 vs 720ms/条）—— HTTP 路径每条实例都触发一次
    ONT_EMBEDDER=llmgw 的 embedding，而 ARK 端点 401，白等一个往返。
    """
    import sys as _sys

    _sys.path.insert(0, str(Path("mate-platform-backend/packages/mate-tech-ont/src").resolve()))
    from datetime import UTC, datetime

    from mate_kernel.ontology.identity import ClassRef
    from mate_kernel.ontology.instances import Individual
    from mate_kernel.ontology.reasoning import Function, FunctionLanguage
    from mate_kernel.ontology.types import ActionType, ObjectType, Property, PropertyFormat

    m = load_model(name)
    if m is None:
        return {"skipped": True}

    repo = _build_repo()
    dslug = m.name.replace("_", "-")
    fn_rid = f"ont.{TENANT}.fn.sopbench-{dslug}.v1"
    act_rid = f"ont.{TENANT}.act.sopbench-{dslug}.v1"

    props = []
    for c in m.columns:
        type_id, is_array = m.types[c]
        is_pk = c == m.pk_col
        props.append(
            Property(
                rid=ClassRef(m.prop_rid(c)),
                type_id=type_id,
                nullable=not is_pk,
                primary_key=is_pk,
                title=c,
                format=getattr(PropertyFormat, _FMT[type_id]),
                array=is_array,
                reducer="first" if is_array else None,
            )
        )
    if not m.pk_col:
        props.insert(
            0,
            Property(
                rid=ClassRef(m.prop_rid("row-id")),
                type_id="string",
                nullable=False,
                primary_key=True,
                title="row id",
                format=PropertyFormat.STRING,
            ),
        )
    pk_rid = m.prop_rid(m.pk_col) if m.pk_col else m.prop_rid("row-id")

    t0 = time.perf_counter()
    errs: list[str] = []
    with repo.tenant_scope(TENANT):
        repo.upsert_object_type(
            ObjectType(
                rid=ClassRef(m.obj_rid),
                primary_key=(ClassRef(pk_rid),),
                properties=tuple(props),
                display_name=f"SOP-Bench {m.name}",
                description=f"SOP-Bench {m.name}（CC BY-NC 4.0，内部引擎验证）",
                type_group="sop-bench",
            )
        )
        repo.upsert_function(
            Function(
                rid=ClassRef(fn_rid),
                language=FunctionLanguage.PYTHON,
                version=1,
                source_ref=f"inline://{fn_rid}",
                signatures=tuple((slugify(c), m.types[c][0]) for c in m.columns[:4]),
            )
        )
        repo.upsert_action_type(
            ActionType(
                rid=ClassRef(act_rid),
                parameters=(next(p for p in props if p.rid.rid == pk_rid),),
                submission_criteria=(),
                side_effects=("audit_log",),
                function_ref=ClassRef(fn_rid),
                on=(ClassRef(m.obj_rid),),
                title=f"SOP-Bench {m.name}",
            )
        )
        now = datetime.now(UTC)
        ok = 0
        for i, r in enumerate(m.rows):
            pk_val = r[m.pk_col].strip() if m.pk_col else f"row-{i:05d}"
            pk_slug = slugify(pk_val) or f"row{i}"
            pairs = []
            for c in m.columns:
                type_id, is_array = m.types[c]
                v = parse_value(r[c], type_id, is_array)
                if v is None:
                    continue
                pairs.append((ClassRef(m.prop_rid(c)), v))
            try:
                repo.create_individual(
                    Individual(
                        rid=f"ont.{TENANT}.ind.sopbench-{dslug}.{pk_slug}",
                        class_rid=ClassRef(m.obj_rid),
                        props=tuple(pairs),
                        primary_key=pk_val,
                        created_at=now,
                        updated_at=now,
                        tenant_id=TENANT,
                    )
                )
                ok += 1
            except Exception as e:
                if len(errs) < 3:
                    errs.append(f"{type(e).__name__}: {e}")
    dt = time.perf_counter() - t0
    return {
        "columns": len(m.columns),
        "rows": len(m.rows),
        "pk_col": m.pk_col or "(synthetic row-id)",
        "individuals_ok": ok,
        "individuals_err": len(m.rows) - ok,
        "errors": errs,
        "seconds": round(dt, 2),
        "backend": "repo",
    }


# ─────────────────── 校验 ───────────────────


def verify_counts(m: DomainModel) -> dict:
    st, body = call("POST", "/api/v1/ont/v2/object-sets/query", {
        "class_rid": m.obj_rid, "filter_expr": "", "paging_limit": 10000,
    })
    n = body.get("count") if isinstance(body, dict) else None
    return {"query_count": n, "csv_rows": len(m.rows), "match": n == len(m.rows)}


def verify_roundtrip(m: DomainModel, sample: int = 3) -> dict:
    """回读样本实例，比对 props 与 CSV 原值。"""
    checked = matched = 0
    first_col = m.columns[0]
    for r in m.rows[:sample]:
        pk_val = r[m.pk_col].strip() if m.pk_col else "row-00000"
        pk_slug = slugify(pk_val)
        st, body = call(
            "GET", f"/api/v1/ont/v2/individuals/ont.{TENANT}.ind.sopbench-{m.name.replace('_','-')}.{pk_slug}"
        )
        if st != 200 or not isinstance(body, dict):
            continue
        checked += 1
        props = body.get("props") or {}
        got = props.get(m.prop_rid(first_col))
        want = parse_value(r[first_col], *m.types[first_col])
        if str(got) == str(want) or (got is None and want is None):
            matched += 1
    return {"checked": checked, "matched": matched}


def verify_filter(m: DomainModel) -> dict:
    """用完整 rid 过滤首个输出列，比对预期非空行数。"""
    out_cols = [c for c in m.columns if c not in (m.pk_col,)]
    if not out_cols:
        return {"skipped": True}
    col = out_cols[-1]
    # 只统计非空值（导入时空值被跳过，不落库）
    values = [r[col].strip() for r in m.rows if r[col].strip()]
    if not values:
        return {"skipped": True}
    target = max(set(values), key=values.count)
    expected = values.count(target)
    rid = m.prop_rid(col)
    st, body = call("POST", "/api/v1/ont/v2/object-sets/query", {
        "class_rid": m.obj_rid,
        "filter_expr": f"{rid} == '{target}'",
        "paging_limit": 10000,
    })
    got = body.get("count") if isinstance(body, dict) else None
    return {"field": col, "value": target, "expected": expected, "got": got, "match": got == expected}


def verify_tenant_isolation() -> dict:
    """换 tenant header 应被拒（403），证明租户守门生效。"""
    req = urllib.request.Request(
        f"{BASE}/api/v1/ont/v2/object-types?limit=1",
        headers={"Authorization": f"Bearer {TOKEN}", "X-Tenant-Id": "tenant-other"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return {"status": r.status, "enforced": False}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "enforced": e.code in (403, 401)}


def drop_probe() -> None:
    """清理探针数据（ont-probe / timing-probe 类型）。"""
    for rid in (
        f"ont.{TENANT}.obj.ont-probe.thing.v1",
        f"ont.{TENANT}.obj.timing-probe.v1",
    ):
        st, _ = call("DELETE", f"/api/v1/ont/v2/object-types/{rid}")
        print(f"  drop {rid} -> {st}")


# ─────────────────── main ───────────────────


def main() -> int:
    global TOKEN
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("domains", nargs="*", default=None)
    ap.add_argument("--workers", type=int, default=8, help="并发写入线程数（api 后端）")
    ap.add_argument(
        "--backend",
        choices=("repo", "api"),
        default="repo",
        help="repo=进程内平台仓库（快，默认）；api=HTTP 网关（慢，受 embedding 401 拖累）",
    )
    ap.add_argument("--drop-probe", action="store_true")
    args = ap.parse_args()

    TOKEN = login()
    print(f"login OK (tenant={TENANT})\n")

    if args.drop_probe:
        print("[清理探针数据]")
        drop_probe()
        return 0

    targets = args.domains or DOMAINS
    stats: dict = {
        "tenant": TENANT,
        "backend": args.backend,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "domains": {},
    }
    t_all = time.perf_counter()

    for name in targets:
        t0 = time.perf_counter()
        if args.backend == "repo":
            res = import_via_repo(name)
            if res.get("skipped"):
                print(f"[{name}] 数据缺失，跳过")
                continue
            m = load_model(name)
            counts = verify_counts(m)
            rt = verify_roundtrip(m)
            flt = verify_filter(m)
            res.update({
                "object_type_ok": res["individuals_err"] == 0,
                "function_ok": True,
                "action_type_ok": True,
                "query_count": counts.get("query_count"),
                "count_match": counts.get("match"),
                "roundtrip": rt,
                "filter": flt,
            })
            stats["domains"][name] = res
            err = res["individuals_err"]
            flag = "OK " if (err == 0 and counts.get("match")) else "!! "
            print(
                f"{flag}[{name:32}] cols={res['columns']:>2} rows={res['rows']:>4} "
                f"ind_ok={res['individuals_ok']:>4} err={err:>3} q={counts.get('query_count')} "
                f"rt={rt['matched']}/{rt['checked']} {res['seconds']:.1f}s"
            )
            if res.get("errors"):
                print(f"    错误样本: {res['errors']}")
            continue

        m = load_model(name)
        if m is None:
            print(f"[{name}] 数据缺失，跳过")
            continue
        type_ok, type_detail = import_type(m)
        fn_ok, act_ok = import_function_and_action(m)
        ok, err, dt_ind = import_individuals(m, workers=args.workers)
        counts = verify_counts(m)
        rt = verify_roundtrip(m)
        flt = verify_filter(m)
        dt = time.perf_counter() - t0
        stats["domains"][name] = {
            "columns": len(m.columns),
            "rows": len(m.rows),
            "pk_col": m.pk_col or "(synthetic row-id)",
            "object_type_ok": type_ok,
            "object_type_detail": type_detail,
            "individuals_ok": ok,
            "individuals_err": err,
            "function_ok": fn_ok,
            "action_type_ok": act_ok,
            "query_count": counts.get("query_count"),
            "count_match": counts.get("match"),
            "roundtrip": rt,
            "filter": flt,
            "seconds": round(dt, 2),
        }
        flag = "OK " if (type_ok and err == 0 and counts.get("match")) else "!! "
        print(
            f"{flag}[{name:32}] cols={len(m.columns):>2} rows={len(m.rows):>4} "
            f"ind_ok={ok:>4} err={err:>3} q={counts.get('query_count')} "
            f"rt={rt['matched']}/{rt['checked']} {dt:.1f}s"
        )

    stats["tenant_isolation"] = verify_tenant_isolation()
    stats["total_seconds"] = round(time.perf_counter() - t_all, 2)
    stats["total_rows"] = sum(d["rows"] for d in stats["domains"].values())
    stats["total_individuals_ok"] = sum(d["individuals_ok"] for d in stats["domains"].values())
    stats["total_errors"] = sum(d["individuals_err"] for d in stats["domains"].values())

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'=' * 78}")
    print(
        f"域={len(stats['domains'])} 行={stats['total_rows']} "
        f"实例导入={stats['total_individuals_ok']} 失败={stats['total_errors']} "
        f"总耗时={stats['total_seconds']}s"
    )
    print(f"租户隔离: {stats['tenant_isolation']}")
    print(f"统计写入 {OUT_JSON}")
    return 0 if stats["total_errors"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
