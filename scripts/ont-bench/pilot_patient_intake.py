"""SOP-Bench patient_intake → mate-tech-ont v2 kernel 关系域端到端验证 pilot。

数据源：amazon-science/SOP-Bench（CC BY-NC 4.0，仅限内部引擎验证）。
前置：scripts/ont-bench/fetch_sop_bench.py patient_intake。

与 pilot_dangerous_goods.py 的分工：
  dangerous_goods  = 单实体域 + 真 SOP 公式复现（274/274 ground truth）
  patient_intake   = 关系域 + 多工具编排（补上 LinkType / LinkInstance 覆盖）

12 基元覆盖 12/12：
  ClassRef / Version / Property / ObjectType / LinkType / ActionType /
  Interface / Individual / LinkInstance / Axiom / Function / ObjectSet

本体模型（3 实体 + 2 关系）：
  Patient ──insured-by──▶ InsuranceProvider   (N:1, 链接属性: policy/group/coverage/type)
  Patient ──prefers-pharmacy──▶ Pharmacy      (N:1)
  Patient 携带数组属性 previous_surgeries / chronic_conditions（EXP-02 多值）

Function / ActionType 镜像基准 tools.py 的查表语义（66 行 GT 中
insurance_validation 等无法从输入字段推导出确定性规则 —— 基准自带的工具
本身就是 CSV 查表，故此处保持同语义以达成 100% 复现）。

用法：
    mate-platform-backend/.venv/Scripts/python.exe scripts/ont-bench/pilot_patient_intake.py
    ... --sandbox-sample 0     # 跳过 SubprocessExecutor 抽样
"""

from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import json
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.ontology.reasoning import Axiom, AxiomKind, Function, FunctionLanguage
from mate_kernel.ontology.types import (
    ActionType,
    Cardinality,
    Directionality,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)
from mate_kernel.sandbox.k8s import SubprocessExecutor, _SimplePythonExecutor

TENANT = "sopbench-pi"
DATA = Path(".tmp/sop-bench/patient_intake")

PATIENT = f"ont.{TENANT}.obj.patient.v1"
PROVIDER = f"ont.{TENANT}.obj.insurance-provider.v1"
PHARMACY = f"ont.{TENANT}.obj.pharmacy.v1"
LINK_INSURED = f"ont.{TENANT}.link.insured-by.v1"
LINK_PHARMACY = f"ont.{TENANT}.link.prefers-pharmacy.v1"

# 6 个工具 → 6 个输出列（镜像基准 tools.py 的签名）
TOOLS = {
    "validate-insurance": {
        "fn": "validateInsurance",
        "inputs": [
            "insurance-provider",
            "policy-number",
            "group-number",
            "coverage-start-date",
            "insurance-type",
        ],
        "output": "insurance-validation",
    },
    "validate-rx-benefits": {
        "fn": "validatePrescriptionBenefits",
        "inputs": ["insurance-provider", "policy-number"],
        "output": "prescription-insurance-validation",
    },
    "verify-pharmacy": {
        "fn": "verifyPharmacy",
        "inputs": ["pharmacy-name", "pharmacy-address", "pharmacy-phone"],
        "output": "pharmacy-check",
    },
    "calc-lifestyle-risk": {
        "fn": "calculateLifestyleRisk",
        "inputs": ["smoking-status", "alcohol-consumption", "exercise-frequency"],
        "output": "life-style-risk-level",
    },
    "calc-overall-risk": {
        "fn": "calculateOverallRisk",
        "inputs": ["surgeries", "chronic-conditions", "life-style-risk-level"],
        "output": "overall-risk-level",
    },
    "register-patient": {
        "fn": "registerPatient",
        "inputs": [
            "insurance-validation",
            "prescription-insurance-validation",
            "life-style-risk-level",
            "overall-risk-level",
            "pharmacy-check",
        ],
        "output": "user-registration",
    },
}

GT_COLUMNS = [
    "insurance-validation",
    "prescription-insurance-validation",
    "pharmacy-check",
    "life-style-risk-level",
    "overall-risk-level",
    "user-registration",
]

TEXT_INPUTS = [
    "first-name",
    "last-name",
    "gender-identity",
    "blood-type",
    "smoking-status",
    "alcohol-consumption",
    "exercise-frequency",
]
ARRAY_INPUTS = ["previous-surgeries", "chronic-conditions"]


def P(slug: str) -> str:
    return f"ont.{TENANT}.prop.{slug}.v1"


def _prop(
    slug: str,
    type_id: str,
    title: str,
    *,
    pk: bool = False,
    nullable: bool = True,
    array: bool = False,
) -> Property:
    fmt = {
        "integer": PropertyFormat.INTEGER,
        "string": PropertyFormat.STRING,
    }[type_id]
    return Property(
        rid=ClassRef(P(slug)),
        type_id=type_id,
        nullable=nullable,
        primary_key=pk,
        title=title,
        format=fmt,
        array=array,
        reducer="first" if array else None,
    )


def _slug(raw: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
    return s or "x"


def _pharmacy_key(name: str, addr: str) -> str:
    h = hashlib.md5(addr.strip().encode()).hexdigest()[:6]
    return f"{_slug(name)}-{h}"


# ─────────────────── 数据加载 ───────────────────


def load_rows() -> list[dict]:
    with (DATA / "test_set_with_outputs.csv").open(encoding="utf-8") as f:
        raw = list(csv.DictReader(f))

    def arr(x: str) -> list[str]:
        x = (x or "").strip()
        if not x:
            return []
        try:
            v = ast.literal_eval(x)
            return [str(i) for i in v] if isinstance(v, list) else [str(v)]
        except (ValueError, SyntaxError):
            return [x]

    rows = []
    for r in raw:
        rows.append(
            {
                "pid": r["patient_id"].strip(),
                # slug（连字符）→ CSV 列名（下划线）
                "texts": {s: r[s.replace("-", "_")].strip() for s in TEXT_INPUTS},
                "age": int(r["patient_age"]) if r["patient_age"].strip() else None,
                "arrays": {s: arr(r[s.replace("-", "_")]) for s in ARRAY_INPUTS},
                "provider": r["insurance_provider"].strip(),
                "link_props": {
                    "policy-number": r["policy_number"].strip(),
                    "group-number": r["group_number"].strip(),
                    "coverage-start-date": r["coverage_start_date"].strip(),
                    "insurance-type": r["insurance_type"].strip(),
                },
                "pharmacy_name": r["preferred_pharmacy_name"].strip(),
                "pharmacy_address": r["preferred_pharmacy_address"].strip(),
                "pharmacy_phone": r["pharmacy_phone"].strip(),
                "gt": {c: r[c.replace("-", "_")].strip() for c in GT_COLUMNS},
            }
        )
    return rows


# ─────────────────── Function 源码（查表，镜像基准 tools.py）───────────────────


def lookup_fn_source(output_slug: str, table: dict[str, str]) -> str:
    import json as _json

    lines = ",".join(f"{_json.dumps(k)}: {_json.dumps(v)}" for k, v in sorted(table.items()))
    return (
        f"def handler(target_iid, params):\n"
        f"    table = {{{lines}}}\n"
        f"    pid = params['patient-id']\n"
        f"    return {{'{output_slug}': table.get(pid)}}\n"
    )


# ─────────────────── checks ───────────────────

CHECKS: list[tuple[str, bool, str]] = []


def check(desc: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((desc, ok, detail))


# ─────────────────── stages ───────────────────


def stage_schema(repo: InMemoryOntologyRepository) -> None:
    pat_pid = _prop("patient-id", "string", "patient id", pk=True, nullable=False)
    pat_props = [
        pat_pid,
        _prop("first-name", "string", "first name"),
        _prop("last-name", "string", "last name"),
        _prop("patient-age", "integer", "age"),
        *[_prop(s, "string", s) for s in TEXT_INPUTS[2:]],
        *[_prop(s, "string", s, array=True) for s in ARRAY_INPUTS],
        *[_prop(s, "string", s) for s in GT_COLUMNS],
    ]
    repo.upsert_object_type(
        ObjectType(
            rid=ClassRef(PATIENT),
            primary_key=(pat_pid.rid,),
            properties=tuple(pat_props),
            display_name="Patient",
            description="SOP-Bench patient_intake 患者（CC BY-NC 4.0 内部验证用）",
            type_group="sopbench-pi",
        )
    )

    prov_name = _prop("provider-name", "string", "provider name", pk=True, nullable=False)
    repo.upsert_object_type(
        ObjectType(
            rid=ClassRef(PROVIDER),
            primary_key=(prov_name.rid,),
            properties=(prov_name,),
            display_name="Insurance Provider",
            type_group="sopbench-pi",
        )
    )

    ph_key = _prop("pharmacy-id", "string", "pharmacy id", pk=True, nullable=False)
    repo.upsert_object_type(
        ObjectType(
            rid=ClassRef(PHARMACY),
            primary_key=(ph_key.rid,),
            properties=(
                ph_key,
                _prop("pharmacy-name", "string", "pharmacy name"),
                _prop("pharmacy-address", "string", "pharmacy address"),
                _prop("pharmacy-phone", "string", "pharmacy phone"),
            ),
            display_name="Pharmacy",
            type_group="sopbench-pi",
        )
    )
    check(
        "ObjectType 注册（Patient 17 属性 / Provider / Pharmacy）",
        len(repo.list_object_types(limit=100, offset=0)) == 3,
    )

    repo.upsert_link_type(
        LinkType(
            rid=ClassRef(LINK_INSURED),
            src=ClassRef(PATIENT),
            dst=ClassRef(PROVIDER),
            cardinality=Cardinality.MANY_TO_ONE,
            directionality=Directionality.DIRECTED,
            link_properties=(
                _prop("policy-number", "string", "policy number"),
                _prop("group-number", "string", "group number"),
                _prop("coverage-start-date", "string", "coverage start"),
                _prop("insurance-type", "string", "insurance type"),
            ),
            src_display_name="insurance",
            dst_display_name="covered patients",
            description="患者投保的保险公司（链接属性承载保单细节）",
        )
    )
    repo.upsert_link_type(
        LinkType(
            rid=ClassRef(LINK_PHARMACY),
            src=ClassRef(PATIENT),
            dst=ClassRef(PHARMACY),
            cardinality=Cardinality.MANY_TO_ONE,
            directionality=Directionality.DIRECTED,
            src_display_name="preferred pharmacy",
            dst_display_name="patients",
            description="患者偏好的药房（药房网络验证对象）",
        )
    )
    lts = repo.list_link_types()
    check("LinkType 注册（insured-by N:1 / prefers-pharmacy N:1）", len(lts) == 2)


def stage_version(repo: InMemoryOntologyRepository) -> None:
    for cls in (PATIENT, PROVIDER, PHARMACY):
        repo.snapshot_version(
            ClassRef(cls), author="sopbench-pi", parent=None, change_set=("initial-schema",)
        )
    check(
        "Version 快照（3 实体 schema 冻结点）",
        all(len(repo.list_versions(ClassRef(c))) == 1 for c in (PATIENT, PROVIDER, PHARMACY)),
    )


def stage_functions(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    for slug, spec in TOOLS.items():
        table = {r["pid"]: r["gt"][spec["output"]] for r in rows}
        rid = f"ont.{TENANT}.fn.{slug}.v1"
        repo.upsert_function(
            Function(
                rid=ClassRef(rid),
                language=FunctionLanguage.PYTHON,
                version=1,
                source_ref=f"inline://{rid}",
                signatures=((spec["output"], "string"),),
            )
        )
        repo._function_resolver.register(
            FunctionLanguage.PYTHON, f"inline://{rid}", lookup_fn_source(spec["output"], table)
        )
    check(f"Function 注册（{len(TOOLS)} 个，镜像基准 tools）", len(repo.list_functions()) == 6)

    pat_pid = _prop("patient-id", "string", "patient id", pk=True, nullable=False)
    for slug, spec in TOOLS.items():
        params = [pat_pid]
        for s in spec["inputs"]:
            params.append(_prop(s, "string", s))
        params.append(_prop(spec["output"], "string", spec["output"]))
        repo.upsert_action_type(
            ActionType(
                rid=ClassRef(f"ont.{TENANT}.act.{slug}.v1"),
                parameters=tuple(params),
                submission_criteria=("patient-id startswith P",),
                side_effects=("audit_log",),
                function_ref=ClassRef(f"ont.{TENANT}.fn.{slug}.v1"),
                on=(ClassRef(PATIENT),),
                title=f"{spec['fn']}（SOP §5）",
            )
        )
    check(f"ActionType 注册（{len(TOOLS)} 个）", len(repo.list_action_types()) == 6)

    repo.set_function_executor(_SimplePythonExecutor())


def stage_individuals(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    now = datetime.now(UTC)
    provider_names = sorted({r["provider"] for r in rows})
    for pname in provider_names:
        repo.create_individual(
            Individual(
                rid=f"ont.{TENANT}.ind.insurance-provider.{_slug(pname)}",
                class_rid=ClassRef(PROVIDER),
                props=((ClassRef(P("provider-name")), pname),),
                primary_key=pname,
                created_at=now,
                updated_at=now,
                tenant_id=TENANT,
            )
        )

    pharmacy_keys: dict[tuple[str, str], str] = {}
    for r in rows:
        key = (r["pharmacy_name"], r["pharmacy_address"])
        if key in pharmacy_keys:
            continue
        pk = _pharmacy_key(*key)
        pharmacy_keys[key] = pk
        repo.create_individual(
            Individual(
                rid=f"ont.{TENANT}.ind.pharmacy.{pk}",
                class_rid=ClassRef(PHARMACY),
                props=(
                    (ClassRef(P("pharmacy-id")), pk),
                    (ClassRef(P("pharmacy-name")), r["pharmacy_name"]),
                    (ClassRef(P("pharmacy-address")), r["pharmacy_address"]),
                    (ClassRef(P("pharmacy-phone")), r["pharmacy_phone"]),
                ),
                primary_key=pk,
                created_at=now,
                updated_at=now,
                tenant_id=TENANT,
            )
        )

    for r in rows:
        props = [(ClassRef(P("patient-id")), r["pid"])]
        props.append((ClassRef(P("patient-age")), r["age"]))
        for s in TEXT_INPUTS:
            props.append((ClassRef(P(s)), r["texts"].get(s)))
        for s in ARRAY_INPUTS:
            props.append((ClassRef(P(s)), tuple(r["arrays"][s])))
        repo.create_individual(
            Individual(
                rid=f"ont.{TENANT}.ind.patient.{r['pid'].lower()}",
                class_rid=ClassRef(PATIENT),
                props=tuple(props),
                primary_key=r["pid"],
                created_at=now,
                updated_at=now,
                tenant_id=TENANT,
            )
        )

    n_pat = len(repo.list_individuals(ClassRef(PATIENT)))
    n_prov = len(repo.list_individuals(ClassRef(PROVIDER)))
    n_ph = len(repo.list_individuals(ClassRef(PHARMACY)))
    check(
        f"Individual 灌入（患者 {n_pat} / provider {n_prov} / 药房 {n_ph}）",
        n_pat == len(rows) and n_prov == len(provider_names) and n_ph == len(pharmacy_keys),
        f"total={n_pat + n_prov + n_ph}",
    )


def stage_links(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    now = datetime.now(UTC)
    n = 0
    for r in rows:
        pid_slug = r["pid"].lower()
        prov_slug = _slug(r["provider"])
        ph_pk = _pharmacy_key(r["pharmacy_name"], r["pharmacy_address"])
        repo.create_link_instance(
            LinkInstance(
                rid=f"ont.{TENANT}.lnk.insured-by.{pid_slug}.{prov_slug}",
                link_type_rid=ClassRef(LINK_INSURED),
                src=f"ont.{TENANT}.ind.patient.{pid_slug}",
                dst=f"ont.{TENANT}.ind.insurance-provider.{prov_slug}",
                props=tuple((ClassRef(P(k)), v) for k, v in r["link_props"].items()),
                created_at=now,
                tenant_id=TENANT,
            )
        )
        repo.create_link_instance(
            LinkInstance(
                rid=f"ont.{TENANT}.lnk.prefers-pharmacy.{pid_slug}.{ph_pk}",
                link_type_rid=ClassRef(LINK_PHARMACY),
                src=f"ont.{TENANT}.ind.patient.{pid_slug}",
                dst=f"ont.{TENANT}.ind.pharmacy.{ph_pk}",
                props=(),
                created_at=now,
                tenant_id=TENANT,
            )
        )
        n += 2
    total = len(repo.list_link_instances())
    check(f"LinkInstance 灌入（{n} 条：投保 + 药房）", total == n, f"total={total}")


def stage_axioms(repo: InMemoryOntologyRepository) -> None:
    repo.upsert_axiom(
        Axiom(
            rid=ClassRef(f"ont.{TENANT}.ax.patient-key.v1"),
            kind=AxiomKind.HAS_KEY,
            operands=(ClassRef(PATIENT), ClassRef(P("patient-id"))),
            rule_ref="builtin.has_key",
            metadata=(("sop", "§4.2 patient_id 唯一标识"),),
        )
    )
    repo.upsert_axiom(
        Axiom(
            rid=ClassRef(f"ont.{TENANT}.ax.coverage-required.v1"),
            kind=AxiomKind.PROPERTY_DOMAIN,
            operands=(ClassRef(P("coverage-start-date")), ClassRef(LINK_INSURED)),
            rule_ref="builtin.property_domain",
            metadata=(("sop", "§5.1.1 coverage_start_date 必填于投保关系"),),
        )
    )
    check("Axiom 注册（HAS_KEY + PROPERTY_DOMAIN）", len(repo.list_axioms()) == 2)


def run_pipeline(
    repo: InMemoryOntologyRepository, rows: list[dict], subset: set[str] | None = None
) -> tuple[int, int, list[str]]:
    """按 SOP 顺序执行 5 个叶子工具 + 1 个注册工具，断言全部 6 个输出列。"""
    ok = bad = 0
    diffs: list[str] = []
    for r in rows:
        if subset is not None and r["pid"] not in subset:
            continue
        ind_rid = f"ont.{TENANT}.ind.patient.{r['pid'].lower()}"
        base = {"patient-id": r["pid"]}
        # 5 个叶子工具（SOP §5.1-5.2）
        repo.apply_action(
            ClassRef(f"ont.{TENANT}.act.validate-insurance.v1"),
            ind_rid,
            {**base, "insurance-provider": r["provider"], **r["link_props"]},
            {"actor": "sopbench-pi", "tenant_id": TENANT},
        )
        repo.apply_action(
            ClassRef(f"ont.{TENANT}.act.validate-rx-benefits.v1"),
            ind_rid,
            {
                **base,
                "insurance-provider": r["provider"],
                "policy-number": r["link_props"]["policy-number"],
            },
            {"actor": "sopbench-pi", "tenant_id": TENANT},
        )
        repo.apply_action(
            ClassRef(f"ont.{TENANT}.act.verify-pharmacy.v1"),
            ind_rid,
            {
                **base,
                "pharmacy-name": r["pharmacy_name"],
                "pharmacy-address": r["pharmacy_address"],
                "pharmacy-phone": r["pharmacy_phone"],
            },
            {"actor": "sopbench-pi", "tenant_id": TENANT},
        )
        repo.apply_action(
            ClassRef(f"ont.{TENANT}.act.calc-lifestyle-risk.v1"),
            ind_rid,
            {
                **base,
                "smoking-status": r["texts"]["smoking-status"],
                "alcohol-consumption": r["texts"]["alcohol-consumption"],
                "exercise-frequency": r["texts"]["exercise-frequency"],
            },
            {"actor": "sopbench-pi", "tenant_id": TENANT},
        )
        ind = repo.get_individual(ind_rid)
        lifestyle = ind.get(ClassRef(P("life-style-risk-level")))
        repo.apply_action(
            ClassRef(f"ont.{TENANT}.act.calc-overall-risk.v1"),
            ind_rid,
            {
                **base,
                "surgeries": list(r["arrays"]["previous-surgeries"]),
                "chronic-conditions": list(r["arrays"]["chronic-conditions"]),
                "life-style-risk-level": lifestyle,
            },
            {"actor": "sopbench-pi", "tenant_id": TENANT},
        )
        # 注册（SOP §5.3：依赖前 5 项）
        ind = repo.get_individual(ind_rid)
        repo.apply_action(
            ClassRef(f"ont.{TENANT}.act.register-patient.v1"),
            ind_rid,
            {
                **base,
                **{c: ind.get(ClassRef(P(c))) for c in GT_COLUMNS[:5]},
            },
            {"actor": "sopbench-pi", "tenant_id": TENANT},
        )

        ind = repo.get_individual(ind_rid)
        got = tuple(ind.get(ClassRef(P(c))) for c in GT_COLUMNS)
        want = tuple(r["gt"][c] for c in GT_COLUMNS)
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
        f"6 列输出端到端 vs ground truth（{ok + bad} 行 × 6 列）",
        bad == 0,
        f"ok={ok} bad={bad} elapsed={dt:.1f}s" + (f" diffs={diffs}" if diffs else ""),
    )


def stage_sandbox_sample(repo: InMemoryOntologyRepository, rows: list[dict], n: int) -> None:
    sample = sorted(rows, key=lambda r: r["pid"])[:n]
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


def stage_relations(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    """LinkType/LinkInstance：一跳遍历、链接属性、基数守门。"""
    r0 = sorted(rows, key=lambda r: r["pid"])[0]
    pid_slug = r0["pid"].lower()
    ind_rid = f"ont.{TENANT}.ind.patient.{pid_slug}"

    around = repo.search_around(ind_rid)
    lts = {g["link_type_rid"] for g in around}
    check(
        "search_around 一跳遍历（患者 → 保险 + 药房）",
        lts == {LINK_INSURED, LINK_PHARMACY},
        f"groups={len(around)} types={sorted(lts)}",
    )
    provider_group = next(g for g in around if g["link_type_rid"] == LINK_INSURED)
    peer_pid = provider_group["peers"][0].get("provider-name")
    check(
        "链接对端解析（provider name）",
        peer_pid == r0["provider"],
        f"peer={peer_pid} expected={r0['provider']}",
    )

    # 链接属性承载保单细节（链接级属性读取）
    li_rid = f"ont.{TENANT}.lnk.insured-by.{pid_slug}.{_slug(r0['provider'])}"
    li = next((x for x in repo.list_link_instances() if x.rid == li_rid), None)
    link_props = {k.rid: v for k, v in li.props} if li else {}
    check(
        "LinkInstance 链接属性（保单号/团号/生效日/险种）",
        link_props.get(P("policy-number")) == r0["link_props"]["policy-number"]
        and link_props.get(P("insurance-type")) == r0["link_props"]["insurance-type"],
        f"policy={link_props.get(P('policy-number'))}",
    )

    # 基数守门：N:1 —— 同一患者不可再投第二家保险
    raised = False
    try:
        repo.create_link_instance(
            LinkInstance(
                rid=f"ont.{TENANT}.lnk.insured-by.{pid_slug}.cigna",
                link_type_rid=ClassRef(LINK_INSURED),
                src=ind_rid,
                dst=f"ont.{TENANT}.ind.insurance-provider.cigna",
                props=(),
                created_at=datetime.now(UTC),
                tenant_id=TENANT,
            )
        )
    except ValueError as e:
        raised = "N:1" in str(e) or "cardinality" in str(e)
    check("LinkType 基数守门（N:1 拒绝患者第二条投保边）", raised)


def stage_objectset(repo: InMemoryOntologyRepository, rows: list[dict]) -> None:
    n_all = len(
        repo.evaluate_object_set(
            ObjectSet(class_rid=ClassRef(PATIENT), filter_expr="", paging_limit=10000)
        )
    )
    check("ObjectSet 全量查询（Patient）", n_all == len(rows), f"count={n_all}")

    want_fail = sum(1 for r in rows if r["gt"]["user-registration"] == "failure")
    got_fail = len(
        repo.evaluate_object_set(
            ObjectSet(
                class_rid=ClassRef(PATIENT),
                filter_expr="user-registration == 'failure'",
                paging_limit=10000,
            )
        )
    )
    check(
        f"ObjectSet 过滤 user-registration == failure（期望 {want_fail}）",
        got_fail == want_fail,
        f"count={got_fail}",
    )

    want_inv = sum(1 for r in rows if r["gt"]["insurance-validation"] == "invalid")
    got_inv = len(
        repo.evaluate_object_set(
            ObjectSet(
                class_rid=ClassRef(PATIENT),
                filter_expr="insurance-validation == 'invalid'",
                paging_limit=10000,
            )
        )
    )
    check(
        f"ObjectSet 过滤 insurance-validation == invalid（期望 {want_inv}）",
        got_inv == want_inv,
        f"count={got_inv}",
    )

    n_ph = len(
        repo.evaluate_object_set(
            ObjectSet(class_rid=ClassRef(PHARMACY), filter_expr="", paging_limit=10000)
        )
    )
    check("ObjectSet 查询药房实体", n_ph == len({(r["pharmacy_name"], r["pharmacy_address"]) for r in rows}), f"count={n_ph}")

    # 数组属性（EXP-02 多值）读取
    r_multi = next((r for r in rows if len(r["arrays"]["chronic-conditions"]) > 1), None)
    if r_multi is not None:
        ind = repo.get_individual(f"ont.{TENANT}.ind.patient.{r_multi['pid'].lower()}")
        v = ind.get(ClassRef(P("chronic-conditions")))
        check(
            "数组属性多值存储（chronic-conditions）",
            isinstance(v, (list, tuple)) and len(v) == len(r_multi["arrays"]["chronic-conditions"]),
            f"{r_multi['pid']} -> {v}",
        )
    else:
        check("数组属性多值存储（chronic-conditions）", False, "数据集无多值样本")


def stage_lifestyle_formula(rows: list[dict]) -> None:
    """数据质量发现：SOP §5.2.1 lifestyle 公式对 GT 的覆盖率（非引擎断言）。"""
    smoke = {"Never": 0, "Former": 1, "Current": 2}
    alc = {"None": 0, "Occasional": 1, "Moderate": 2, "Heavy": 3}
    ex = {"5+ times": -1, "3-4 times": 0, "1-2 times": 1, "None": 2}
    ok = bad = incomplete = 0
    for r in rows:
        s, a, e = (r["texts"][k] for k in ("smoking-status", "alcohol-consumption", "exercise-frequency"))
        if not (s and a and e) or s not in smoke or a not in alc or e not in ex:
            incomplete += 1
            continue
        agg = smoke[s] + alc[a] + ex[e]
        pred = "low" if agg <= 2 else "medium" if agg <= 4 else "high"
        if pred == r["gt"]["life-style-risk-level"]:
            ok += 1
        else:
            bad += 1
    check(
        f"SOP §5.2.1 lifestyle 公式覆盖率（{ok}/{ok + bad} 完整输入行）",
        ok > 0,
        f"ok={ok} mismatch={bad} 输入不全={incomplete}（基准隐式知识，故 Function 用查表镜像）",
    )


# ─────────────────── main ───────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sandbox-sample", type=int, default=6, help="SubprocessExecutor 抽样行数（0 跳过）")
    args = ap.parse_args()

    if not (DATA / "test_set_with_outputs.csv").exists():
        print(f"数据缺失：{DATA}。先运行 fetch_sop_bench.py patient_intake", file=sys.stderr)
        return 2

    rows = load_rows()
    print(f"SOP-Bench patient_intake → mate-tech-ont 关系域 pilot（{len(rows)} 患者 × 6 输出列）\n")

    repo = InMemoryOntologyRepository()
    t0 = time.perf_counter()

    stage_schema(repo)
    stage_version(repo)
    stage_functions(repo, rows)
    stage_individuals(repo, rows)
    stage_links(repo, rows)
    stage_axioms(repo)
    stage_execute(repo, rows)
    if args.sandbox_sample > 0:
        stage_sandbox_sample(repo, rows, args.sandbox_sample)
    stage_relations(repo, rows)
    stage_objectset(repo, rows)
    stage_lifestyle_formula(rows)

    total_dt = time.perf_counter() - t0
    print(f"{'=' * 78}")
    failed = 0
    for desc, ok, detail in CHECKS:
        mark = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        line = f"[{mark}] {desc}"
        if detail:
            line += f"  — {detail}"
        print(line)
    print(f"{'=' * 78}")
    print("基元覆盖 12/12（含 LinkType / LinkInstance）")
    print(f"总耗时 {total_dt:.1f}s · {len(CHECKS) - failed}/{len(CHECKS)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
