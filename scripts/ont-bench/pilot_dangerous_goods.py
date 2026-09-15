"""SOP-Bench dangerous_goods → mate-tech-ont v2 kernel 端到端验证 pilot。

数据源：amazon-science/SOP-Bench（CC BY-NC 4.0，仅限内部引擎验证）。
前置：scripts/ont-bench/fetch_sop_bench.py dangerous_goods 已拉取数据到
.tmp/sop-bench/dangerous_goods/。

验证内容（12 基元覆盖 10/12；LinkType/LinkInstance 属关系型域，本单实体域不含）：
  ClassRef / Property / ObjectType / Interface / Individual / Function /
  ActionType / Axiom / ObjectSet / Version

闭环：
  1. toolspecs.json + SOP 文本   → Function（4 个评分 + 1 个分类，源码内嵌 ground truth）
  2. CSV 274 行                  → Individual 灌入
  3. ActionType.apply（唯一合法写入口）驱动 4 次评分 + 1 次分类
  4. 断言 hazard_score / hazard_class == ground truth（274/274）
  5. SubprocessExecutor 沙箱抽样复跑一致性
  6. ObjectSet 过滤 / Interface 多态查询计数断言

SOP 语义（从 sop.txt + ground truth 反推校准，274/274 复现）：
  §5.1  product_id 不匹配 ^P_[0-9]{5}$ → hazard_score=0, Unable to Decide
  §5.6  缺失/0 分计数 >=2              → hazard_score=0, Unable to Decide
  §5.6  缺失/0 分计数 ==1              → 用其余分数最大值填补
  §5.6  hazard_score = 四项之和（4..20）
  §5.7  4-7→A, 8-12→B, 13-16→C, 17-20→D

用法：
    mate-platform-backend/.venv/Scripts/python.exe scripts/ont-bench/pilot_dangerous_goods.py
    ... --sandbox-sample 0        # 跳过沙箱抽样
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from mate_kernel.action.engine import SubmissionCriteriaFailed
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, AxiomKind, Function, FunctionLanguage
from mate_kernel.ontology.types import (
    ActionType,
    Interface,
    ObjectType,
    Property,
    PropertyFormat,
)
from mate_kernel.sandbox.k8s import SubprocessExecutor, _SimplePythonExecutor

TENANT = "sopbench"
DATA = Path(".tmp/sop-bench/dangerous_goods")

OBJ = f"ont.{TENANT}.obj.dangerous-good.v1"
IFACE = f"ont.{TENANT}.if.scorable.v1"

TEXT_SLUGS = {
    "sds-label-text": "sds_label_text",
    "handling-guidelines": "handling_and_storage_guidelines",
    "transport-requirements": "transportation_requirements",
    "disposal-guidelines": "disposal_guidelines",
}
SCORE_SLUGS = ["sds-score", "handling-score", "transport-score", "disposal-score"]
GT_SCORE_COLS = ["sds_label_score", "handling_score", "transportation_score", "disposal_score"]


def P(slug: str) -> str:
    return f"ont.{TENANT}.prop.{slug}.v1"


def _prop(
    slug: str, type_id: str, title: str, *, pk: bool = False, nullable: bool = False
) -> Property:
    fmt = PropertyFormat.INTEGER if type_id == "integer" else PropertyFormat.STRING
    return Property(
        rid=ClassRef(P(slug)),
        type_id=type_id,
        nullable=nullable,
        primary_key=pk,
        title=title,
        format=fmt,
    )


# ─────────────────── 数据加载 ───────────────────


def load_ground_truth() -> list[dict]:
    with (DATA / "test_set_with_outputs.csv").open(encoding="utf-8") as f:
        raw = list(csv.DictReader(f))

    def num(x: str) -> float | None:
        x = (x or "").strip()
        return float(x) if x else None

    rows = []
    for r in raw:
        rows.append(
            {
                "pid": r["product_id"],
                "texts": [r[c] for c in TEXT_SLUGS.values()],
                "scores": [num(r[c]) for c in GT_SCORE_COLS],
                "hazard_score": int(float(r["hazard_score"])),
                "hazard_class": r["hazard_class"],
            }
        )
    return rows


# ─────────────────── Function 源码生成 ───────────────────


def score_fn_source(slug: str, table: dict[str, float | None]) -> str:
    """评分 Function 源码：内嵌 ground truth 查表（与基准 mock tools.py 同语义）。

    分数转 int 字面量，保证分类求和保持整数语义。
    """
    import json as _json

    lines = ",".join(
        f"{_json.dumps(k)}: {None if v is None else int(v)}" for k, v in sorted(table.items())
    )
    return (
        f"def handler(target_iid, params):\n"
        f"    table = {{{lines}}}\n"
        f"    pid = params['product-id']\n"
        f"    return {{'{slug}': table.get(pid)}}\n"
    )


CLASSIFY_SOURCE = '''\
def handler(target_iid, params):
    """SOP dangerous_goods §5.1-§5.7 分类（274/274 GT 校准）。

    约束：helper 全部内嵌（kernel 执行器以 globals/locals 分离模式 exec），
    且只用运算符 + 方法调用（_SimplePythonExecutor 的 builtins 为空 dict）。
    """
    utd = "Unable to Decide"
    pid = params.get("product-id", "")
    # §5.1 ^P_[0-9]{5}$ 等价校验（不用 len/all）
    ok_id = (
        pid[:2] == "P_"
        and pid[7:] == ""
        and pid[6:] != ""
        and pid[2:].isdigit()
    )
    if not ok_id:
        return {"hazard-score": 0, "hazard-class": utd}

    keys = ("sds-score", "handling-score", "transport-score", "disposal-score")
    scores = (
        params.get(keys[0]),
        params.get(keys[1]),
        params.get(keys[2]),
        params.get(keys[3]),
    )
    # §5.6 缺失/0 分 >=2 → Unable to Decide
    present = []
    n_missing = 0
    for s in scores:
        if s is None or s == 0:
            n_missing += 1
        else:
            present.append(s)
    if n_missing >= 2:
        return {"hazard-score": 0, "hazard-class": utd}

    # §5.6 缺失/0 分用其余最大值填补
    fill = present[0]
    for s in present:
        if s > fill:
            fill = s
    total = 0
    for s in scores:
        if s is None or s == 0:
            total += fill
        else:
            total += s

    # §5.7 阈值分级（4-7→A, 8-12→B, 13-16→C, 17-20→D）
    cls = "D"
    if total <= 7:
        cls = "A"
    elif total <= 12:
        cls = "B"
    elif total <= 16:
        cls = "C"
    return {"hazard-score": total, "hazard-class": "Hazard Class " + cls}
'''


# ─────────────────── Stage 实现 ───────────────────

CHECKS: list[tuple[str, bool, str]] = []


def check(desc: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((desc, ok, detail))


def stage_schema(repo: InMemoryOntologyRepository) -> None:
    text_props = [_prop(s, "string", c, nullable=True) for s, c in TEXT_SLUGS.items()]
    score_props = [_prop(s, "integer", s, nullable=True) for s in SCORE_SLUGS]
    pid_prop = _prop("product-id", "string", "product id", pk=True)
    hazard_props = [
        _prop("hazard-score", "integer", "hazard score", nullable=True),
        _prop("hazard-class", "string", "hazard class", nullable=True),
    ]
    for p in [pid_prop, *text_props, *score_props, *hazard_props]:
        repo.upsert_property(p)

    scorable = Interface(
        rid=ClassRef(IFACE),
        properties=tuple(score_props),
    )
    repo.upsert_interface(scorable)

    repo.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ),
            primary_key=(pid_prop.rid,),
            properties=(
                pid_prop,
                *text_props,
                *score_props,
                *hazard_props,
            ),
            interfaces=(scorable.rid,),
            display_name="Dangerous Good",
            description="SOP-Bench dangerous_goods 域产品（CC BY-NC 4.0 内部验证用）",
            type_group="sopbench",
        )
    )
    ot = repo.get_object_type(ClassRef(OBJ))
    check("ObjectType 注册（11 属性 + Interface 引用）", len(ot.properties) == 11)
    check("Interface scorable 注册", any(i.rid == ClassRef(IFACE) for i in repo.list_interfaces()))


def stage_version(repo: InMemoryOntologyRepository) -> None:
    v = repo.snapshot_version(
        ClassRef(OBJ),
        author="sopbench-pilot",
        parent=None,
        change_set=("initial-schema",),
    )
    versions = repo.list_versions(ClassRef(OBJ))
    check("Version 快照（schema 冻结点）", len(versions) == 1, f"version={v}")


def stage_functions(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    tables: dict[str, dict[str, float | None]] = {slug: {} for slug in SCORE_SLUGS}
    for r in rows:
        for slug, score in zip(SCORE_SLUGS, r["scores"]):
            tables[slug][r["pid"]] = score

    fn_rids = []
    for slug in SCORE_SLUGS:
        rid = f"ont.{TENANT}.fn.calc-{slug}.v1"
        repo.upsert_function(
            Function(
                rid=ClassRef(rid),
                language=FunctionLanguage.PYTHON,
                version=1,
                source_ref=f"inline://{rid}",
                signatures=((slug, "integer"),),
            )
        )
        fn_rids.append(rid)
        # 源码注册进 resolver（GOVERN-05 InMemoryFunctionResolver）
        repo._function_resolver.register(
            FunctionLanguage.PYTHON, f"inline://{rid}", score_fn_source(slug, tables[slug])
        )
    classify_rid = f"ont.{TENANT}.fn.classify-danger.v1"
    repo.upsert_function(
        Function(
            rid=ClassRef(classify_rid),
            language=FunctionLanguage.PYTHON,
            version=1,
            source_ref=f"inline://{classify_rid}",
            signatures=(("hazard-score", "integer"), ("hazard-class", "string")),
        )
    )
    repo._function_resolver.register(
        FunctionLanguage.PYTHON, f"inline://{classify_rid}", CLASSIFY_SOURCE
    )
    check("Function 注册（4 评分 + 1 分类）", len(repo.list_functions()) == 5)

    # ── ActionType（唯一合法写入口）──
    pid_prop = _prop("product-id", "string", "product id", pk=True)
    for i, slug in enumerate(SCORE_SLUGS):
        text_slug = list(TEXT_SLUGS)[i]
        repo.upsert_action_type(
            ActionType(
                rid=ClassRef(f"ont.{TENANT}.act.calc-{slug}.v1"),
                parameters=(
                    pid_prop,
                    _prop(text_slug, "string", text_slug, nullable=True),
                    _prop(slug, "integer", slug, nullable=True),
                ),
                submission_criteria=("product-id startswith P_",),
                side_effects=("audit_log",),
                function_ref=ClassRef(f"ont.{TENANT}.fn.calc-{slug}.v1"),
                on=(ClassRef(OBJ),),
                title=f"计算 {slug}",
            )
        )
    repo.upsert_action_type(
        ActionType(
            rid=ClassRef(f"ont.{TENANT}.act.classify-danger.v1"),
            parameters=(
                pid_prop,
                *(_prop(s, "integer", s, nullable=True) for s in SCORE_SLUGS),
                _prop("hazard-score", "integer", "hazard score", nullable=True),
                _prop("hazard-class", "string", "hazard class", nullable=True),
            ),
            submission_criteria=(),
            side_effects=("hazard_registry_record", "audit_log"),
            function_ref=ClassRef(classify_rid),
            on=(ClassRef(OBJ),),
            title="危险品分级（SOP §5.6-5.7）",
        )
    )
    check("ActionType 注册（5 个）", len(repo.list_action_types()) == 5)

    repo.set_function_executor(_SimplePythonExecutor())


def stage_individuals(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    now = datetime.now(UTC)
    for r in rows:
        slug_vals = list(TEXT_SLUGS.items())
        repo.create_individual(
            Individual(
                rid=f"ont.{TENANT}.ind.dangerous-good.{r['pid'].lower()}",
                class_rid=ClassRef(OBJ),
                props=tuple(
                    [(ClassRef(P("product-id")), r["pid"])]
                    + [(ClassRef(P(s)), r["texts"][i]) for i, (s, _) in enumerate(slug_vals)]
                ),
                primary_key=r["pid"],
                created_at=now,
                updated_at=now,
                tenant_id=TENANT,
                marking=(),
            )
        )
    n = len(repo.list_individuals(ClassRef(OBJ)))
    check(f"Individual 灌入（{len(rows)} 行）", n == len(rows), f"count={n}")


def stage_axioms(repo: InMemoryOntologyRepository) -> None:
    repo.upsert_axiom(
        Axiom(
            rid=ClassRef(f"ont.{TENANT}.ax.dg-product-key.v1"),
            kind=AxiomKind.HAS_KEY,
            operands=(ClassRef(OBJ), ClassRef(P("product-id"))),
            rule_ref="builtin.has_key",
            metadata=(("sop", "§5.1 product_id 唯一标识"),),
        )
    )
    for i, slug in enumerate(SCORE_SLUGS):
        repo.upsert_axiom(
            Axiom(
                rid=ClassRef(f"ont.{TENANT}.ax.range-{slug}.v1"),
                kind=AxiomKind.PROPERTY,
                operands=(ClassRef(P(slug)),),
                rule_ref="builtin.value_range",
                metadata=(
                    ("min", "1"),
                    ("max", "5"),
                    ("sop", f"§5.{i + 2} 分数有效性校验"),
                ),
            )
        )
    check("Axiom 注册（HAS_KEY + 4×PROPERTY range）", len(repo.list_axioms()) == 5)


def run_pipeline(
    repo: InMemoryOntologyRepository,
    rows: list[dict],
    pids_subset: set[str] | None = None,
) -> tuple[int, int, list[str]]:
    """对（子集）行执行 4 评分 + 1 分类，返回 (ok, bad, mismatch 详情)。"""
    ok = bad = 0
    diffs: list[str] = []
    for r in rows:
        if pids_subset is not None and r["pid"] not in pids_subset:
            continue
        ind_rid = f"ont.{TENANT}.ind.dangerous-good.{r['pid'].lower()}"
        # §5.1 格式门：不合法 ID 不调用评分工具（criteria 拒绝即 SOP "no further action"）
        valid_id = r["pid"].startswith("P_") and len(r["pid"]) == 7 and r["pid"][2:].isdigit()
        if valid_id:
            for i, slug in enumerate(SCORE_SLUGS):
                repo.apply_action(
                    ClassRef(f"ont.{TENANT}.act.calc-{slug}.v1"),
                    ind_rid,
                    {"product-id": r["pid"], list(TEXT_SLUGS)[i]: r["texts"][i]},
                    {"actor": "sopbench-pilot", "tenant_id": TENANT},
                )
        scores = {slug: repo.get_individual(ind_rid).get(ClassRef(P(slug))) for slug in SCORE_SLUGS}
        repo.apply_action(
            ClassRef(f"ont.{TENANT}.act.classify-danger.v1"),
            ind_rid,
            {"product-id": r["pid"], **scores},
            {"actor": "sopbench-pilot", "tenant_id": TENANT},
        )
        ind = repo.get_individual(ind_rid)
        got = (
            ind.get(ClassRef(P("hazard-score"))),
            ind.get(ClassRef(P("hazard-class"))),
        )
        want = (r["hazard_score"], r["hazard_class"])
        if got == want:
            ok += 1
        else:
            bad += 1
            if len(diffs) < 5:
                diffs.append(f"{r['pid']}: got={got} want={want}")
    return ok, bad, diffs


def stage_execute(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    t0 = time.perf_counter()
    ok, bad, diffs = run_pipeline(repo, rows)
    dt = time.perf_counter() - t0
    check(
        f"端到端分类 vs ground truth（{ok + bad} 行）",
        bad == 0,
        f"ok={ok} bad={bad} elapsed={dt:.1f}s" + (f" diffs={diffs}" if diffs else ""),
    )


def stage_sandbox_sample(repo: InMemoryOntologyRepository, rows: list[dict], n: int) -> None:
    """SubprocessExecutor（python -I 真子进程沙箱）抽样复跑，断言与 in-process 结果一致。"""
    sample = [r for r in rows if r["pid"].startswith("P_")][:n]
    repo.set_function_executor(SubprocessExecutor(timeout_seconds=30))
    t0 = time.perf_counter()
    ok, bad, diffs = run_pipeline(repo, sample)
    dt = time.perf_counter() - t0
    check(
        f"SubprocessExecutor 沙箱抽样（{len(sample)} 行复跑）",
        bad == 0,
        f"ok={ok} bad={bad} elapsed={dt:.1f}s" + (f" diffs={diffs}" if diffs else ""),
    )
    repo.set_function_executor(_SimplePythonExecutor())


def stage_objectset(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    n_all = len(
        repo.evaluate_object_set(
            ObjectSet(class_rid=ClassRef(OBJ), filter_expr="", paging_limit=10000)
        )
    )
    check("ObjectSet 全量查询", n_all == len(rows), f"count={n_all}")

    gt_d = sum(1 for r in rows if r["hazard_class"] == "Hazard Class D")
    got_d = len(
        repo.evaluate_object_set(
            ObjectSet(class_rid=ClassRef(OBJ), filter_expr="hazard-class == 'Hazard Class D'")
        )
    )
    check(f"ObjectSet 过滤 hazard-class == D（期望 {gt_d}）", got_d == gt_d, f"count={got_d}")

    gt_hi = sum(1 for r in rows if r["hazard_score"] > 16)
    got_hi = len(
        repo.evaluate_object_set(
            ObjectSet(class_rid=ClassRef(OBJ), filter_expr="hazard-score > 16")
        )
    )
    check(
        f"ObjectSet 数值过滤 hazard-score > 16（期望 {gt_hi}）", got_hi == gt_hi, f"count={got_hi}"
    )

    # EXP-01：Interface 作为多态查询源
    got_if = len(
        repo.evaluate_object_set(
            ObjectSet(class_rid=ClassRef(IFACE), filter_expr="", paging_limit=10000)
        )
    )
    check(
        "Interface 多态查询源（scorable → dangerous-good）", got_if == len(rows), f"count={got_if}"
    )


# ─────────────────── main ───────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--sandbox-sample", type=int, default=8, help="SubprocessExecutor 抽样行数（0 跳过）"
    )
    args = ap.parse_args()

    if not (DATA / "test_set_with_outputs.csv").exists():
        print(f"数据缺失：{DATA}。先运行 fetch_sop_bench.py dangerous_goods", file=sys.stderr)
        return 2

    rows = load_ground_truth()
    print(f"SOP-Bench dangerous_goods → mate-tech-ont pilot（{len(rows)} 行 ground truth）\n")

    repo = InMemoryOntologyRepository()
    t0 = time.perf_counter()

    stage_schema(repo)
    stage_version(repo)
    stage_functions(repo, rows)
    stage_individuals(repo, rows)
    stage_axioms(repo)
    stage_execute(repo, rows)
    if args.sandbox_sample > 0:
        stage_sandbox_sample(repo, rows, args.sandbox_sample)
    stage_objectset(repo, rows)

    total_dt = time.perf_counter() - t0
    print(f"{'=' * 72}")
    failed = 0
    for desc, ok, detail in CHECKS:
        mark = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        line = f"[{mark}] {desc}"
        if detail:
            line += f"  — {detail}"
        print(line)
    print(f"{'=' * 72}")
    print(
        f"基元覆盖 10/12（ClassRef/Version/Property/ObjectType/Interface/Individual/"
        f"Function/ActionType/Axiom/ObjectSet；LinkType/LinkInstance 待关系型域）"
    )
    print(f"总耗时 {total_dt:.1f}s · {len(CHECKS) - failed}/{len(CHECKS)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
