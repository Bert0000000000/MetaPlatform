"""G34 四象限基线跑批脚本 —— AI 参与者用本体引擎真实检索能力答题。

独立可执行脚本（非 pytest）。对 ``question_bank.build_question_bank()`` 的
50 道真实业务题：

1. **AI runner**：每题调 dev 栈网关的本体检索（先 hybrid
   ``POST /api/v1/ont/v2/object-search/hybrid``，0 结果降级语义检索
   ``POST /api/v1/ont/v2/object-search``），取 top-k 对象卡片；
   成功判定 = 卡片非空 **且** 至少一张卡的 ``matched[].value_text``
   与 ``expected_answer`` 有词汇交集（前 3 个实义词子串命中，或
   非停用词 latin token 重叠 ≥1）。单题网络/超时失败记
   ``success=False`` 不中断；每题间隔 ``--delay`` 秒防限流。
2. **human runner（模拟基线，非真实人类）**：keyword-in-data 确定性
   runner——从题目提取关键词，在硬编码的 30 条 seed 已知数据字典中
   查找，命中即 success。这是「有领域知识的人在数据里查找」的确定性
   近似下界，**不是真实人类作答**，四象限 human 侧结论仅作参考下界。
3. **产出**：AI runs 以 ``append_runs`` 格式写 JSONL；stdout 打印
   ``quadrant_report`` 四象限 counts + diagnosis + AI 成功率 + 分域
   （tag）成功率表。

用法::

    cd mate-platform-backend
    .venv/Scripts/python.exe packages/mate-tech-ont/scripts/run_g34_baseline.py \
        [--top-k 5] [--delay 0.3] [--limit N] [--gateway URL] [--append]

网关地址可用环境变量 ``G34_GATEWAY`` 覆盖；登录账号为 dev 栈既有约定
（admin/admin123，仅本地 dev，非密钥）。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

# ── 包导入引导：脚本位于 packages/mate-tech-ont/scripts/，src 加入 sys.path ──
_SCRIPT_DIR = Path(__file__).resolve().parent
_PKG_SRC = _SCRIPT_DIR.parent / "src"
if str(_PKG_SRC) not in sys.path:
    sys.path.insert(0, str(_PKG_SRC))

from mate_tech_ont.v2_kernel.evaluation import (
    DIAGNOSIS,
    EvaluationQuestion,
    RunRecord,
    append_runs,
    quadrant_report,
    run_suite,
)
from mate_tech_ont.v2_kernel.question_bank import (
    QUESTION_BANK_VERSION,
    build_question_bank,
)

# ── 路径：默认输出 mate-platform-backend/scripts/mock/（与运行 cwd 无关） ──
_BACKEND_ROOT = _SCRIPT_DIR.parents[2]
_DEFAULT_OUT_DIR = _BACKEND_ROOT / "scripts" / "mock"
_AI_RUNS_PATH = _DEFAULT_OUT_DIR / "g34_baseline_runs.jsonl"
_HUMAN_RUNS_PATH = _DEFAULT_OUT_DIR / "g34_baseline_human_runs.jsonl"

#: dev 栈网关（环境变量 G34_GATEWAY 可覆盖）。
DEFAULT_GATEWAY = os.environ.get("G34_GATEWAY", "http://localhost:8100")
#: dev 栈既有约定账号（本地 dev，非密钥）。
DEV_USER = "admin"
DEV_PASSWORD = "admin123"

# ---------------------------------------------------------------------------
# 关键词提取：CJK 领域词表 + latin token（无 jieba，确定性实现）
# ---------------------------------------------------------------------------

#: 领域词表（对位 question_bank / seed 的业务词汇；用于无分词环境下
#: 从中文句子中确定性提取「实义词」。命中即视为该词在句中出现）。
_DOMAIN_GLOSSARY: tuple[str, ...] = (
    # 区域 / 等级
    "华东",
    "华北",
    "华南",
    "西南",
    "东北",
    "西北",
    "A级",
    "B级",
    "C级",
    "信用等级",
    "授信",
    # CRM
    "客户",
    "订单",
    "产品",
    "合同",
    "采购",
    "备货",
    "类目",
    "未完结",
    "完结",
    "延迟",
    "复核",
    "续约",
    "到期",
    "签约",
    "下单",
    "回款",
    "跟进",
    "额度",
    "占比",
    "集中度",
    "行业",
    "区域",
    # HR
    "员工",
    "请假",
    "年假",
    "事假",
    "调休",
    "待审批",
    "审批",
    "驳回",
    "部门",
    "排班",
    "缺勤",
    "薪资",
    "社保",
    "加班",
    "招聘",
    "入职",
    "简历",
    "面试",
    "录用",
    "交接",
    "人力",
    "研发",
    "运营",
    # IT
    "工单",
    "优先级",
    "积压",
    "滞留",
    "密码重置",
    "设备",
    "告警",
    "部署",
    "值守",
    "容量",
    "登录",
    "认证",
    "故障",
    "发布",
    "回归",
    # Finance
    "发票",
    "账龄",
    "逾期",
    "催收",
    "坏账",
    "开票",
    "对账",
    "未回款",
    "应收",
    "凭证",
    "报销",
    "审计",
    "关账",
    "收入",
    "利润",
    "计提",
    # 跨域 / 推理
    "数字员工",
    "编排",
    "意图",
    "协同",
    "兜底",
    "人工",
    "根因",
    "卡点",
    "副作用",
    "联动",
    "链路",
    "环节",
    "分布",
    "走势",
    "趋势",
    "环比",
    "周期",
    "清单",
    "名单",
    "明细",
    "全景",
    "剪刀差",
    "转化率",
    "敞口",
    "波动",
    "频次",
    "零下单",
    "冲击",
    "波及",
    "复购",
    "流失",
    "拖累",
    "过载",
    "分流",
    "匹配",
)

#: latin 停用词（泛词不参与 token 重叠判定）。
_LATIN_STOPWORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "of",
        "and",
        "or",
        "to",
        "in",
        "on",
        "for",
        "is",
        "are",
        "be",
        "it",
        "its",
        "id",
        "no",
        "if",
        "at",
        "by",
        "as",
    }
)

_LATIN_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_\-]*")


def _latin_tokens(text: str) -> list[str]:
    """latin/alnum token（小写化，去停用词与单字符）。"""
    return [
        t.lower()
        for t in _LATIN_TOKEN_RE.findall(text)
        if len(t) >= 2 and t.lower() not in _LATIN_STOPWORDS
    ]


def content_words(text: str, limit: int = 3) -> list[str]:
    """取文本前 ``limit`` 个实义词（确定性，无分词依赖）。

    CJK：领域词表子串命中（按首次出现位置排序）；latin：token 化。
    两路合并后按位置排序取前 N —— 即任务口径「去停用词后的前 3 个
    实义词」的可复现实现。
    """
    marks: list[tuple[int, str]] = []
    lowered = text.lower()
    for term in _DOMAIN_GLOSSARY:
        pos = text.find(term)
        if pos >= 0:
            marks.append((pos, term))
    latin_hit: set[str] = set()
    for tok in _latin_tokens(text):
        if tok in latin_hit:
            continue
        latin_hit.add(tok)
        pos = lowered.find(tok)
        if pos >= 0:
            marks.append((pos, tok))
    marks.sort(key=lambda x: x[0])
    # 同位置去重保序，截前 N
    out: list[str] = []
    for _, w in marks:
        if w not in out:
            out.append(w)
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------------------
# human 模拟基线：固定已知数据字典（30 条，源自 seed.py 真实 seed 内容）
# ---------------------------------------------------------------------------

# **模拟基线声明**：以下字典硬编码自 ``v2_kernel/seed.py``（请假审批 demo +
# 企业核心本体 + 7+1 数字员工）的已知对象名/属性值，用于确定性模拟
# 「有领域知识的人类在数据中查找」的下界——不是真实人类作答。
_KNOWN_DATA_FACTS: tuple[dict[str, object], ...] = (
    {
        "keys": ["李华", "EMP-002"],
        "fact": "employee EMP-002 李华 dept=研发；请假 LR-2026-002 事假 1 天 pending",
    },
    {
        "keys": ["王小明", "EMP-001"],
        "fact": "employee EMP-001 王小明 dept=HR；请假 LR-2026-001 年假 3 天 pending",
    },
    {
        "keys": ["赵强", "EMP-003"],
        "fact": "employee EMP-003 赵强 dept=运营；请假 LR-2026-003 调休 5 天 pending",
    },
    {"keys": ["LR-2026-001"], "fact": "请假单 LR-2026-001：年假 3 天 pending（王小明）"},
    {"keys": ["LR-2026-002"], "fact": "请假单 LR-2026-002：事假 1 天 pending（李华）"},
    {"keys": ["LR-2026-003"], "fact": "请假单 LR-2026-003：调休 5 天 pending（赵强）"},
    {
        "keys": ["TK-2026-001", "登录页偶发", "401"],
        "fact": "工单 TK-2026-001「登录页偶发 401」priority=high status=open",
    },
    {
        "keys": ["TK-2026-002", "报表导出慢"],
        "fact": "工单 TK-2026-002「报表导出慢」priority=medium status=open",
    },
    {
        "keys": ["审批请假", "approve-leave"],
        "fact": "act.approve-leave 审批请假 side_effects=notify_email,audit_log",
    },
    {
        "keys": ["关闭工单", "close-ticket"],
        "fact": "act.close-ticket 关闭工单 side_effects=notify_customer",
    },
    {
        "keys": ["订单复核", "order-review-confirm"],
        "fact": "act.order-review-confirm 订单复核确认 "
        "side_effects=update_order,create_follow_up_task,audit_log",
    },
    {
        "keys": ["审批合同", "approve-contract"],
        "fact": "act.approve-contract 审批合同 side_effects=notify_email,audit_log",
    },
    {
        "keys": ["dw-hr-recruiter", "招聘"],
        "fact": "dw-hr-recruiter（HR Recruiter）capabilities="
        "screen_resume,schedule_interview,initiate_onboarding",
    },
    {
        "keys": ["dw-hr-payroll", "薪资"],
        "fact": "dw-hr-payroll（HR Payroll）capabilities="
        "calculate_salary,verify_social_insurance,compute_overtime_fee",
    },
    {
        "keys": ["dw-it-helpdesk", "服务台"],
        "fact": "dw-it-helpdesk（IT Service Desk）capabilities="
        "classify_ticket,reset_password,request_device",
    },
    {
        "keys": ["dw-it-devops", "devops"],
        "fact": "dw-it-devops（IT DevOps）capabilities=trigger_ci,approve_deploy,alert_monitoring",
    },
    {
        "keys": ["dw-finance-ar", "应收"],
        "fact": "dw-finance-ar（Finance AR）capabilities="
        "issue_invoice,reconcile_payment,aging_analysis",
    },
    {
        "keys": ["dw-finance-expense", "报销"],
        "fact": "dw-finance-expense（Expense Auditor）capabilities="
        "audit_expense,reimburse,generate_voucher",
    },
    {
        "keys": ["dw-sales-crm", "销售助理"],
        "fact": "dw-sales-crm（Sales CRM Assistant）capabilities="
        "follow_customer,draft_contract,advance_opportunity",
    },
    {
        "keys": ["superai-orchestrator", "编排者"],
        "fact": "superai-orchestrator capabilities="
        "detect_intent,match_employee,plan_task,aggregate_result",
    },
    {
        "keys": ["superai-orchestrate"],
        "fact": "act.superai-orchestrate 编排调度 side_effects=audit_log",
    },
    {"keys": ["华东"], "fact": "customer-master 样例客户 region=华东（CRM 真实源库已绑定样例）"},
    {
        "keys": ["信用等级", "credit-level"],
        "fact": "customer credit-level 属性（取值 A/B/C）已建模",
    },
    {"keys": ["办公设备"], "fact": "product category=办公设备（类目已建模）"},
    {"keys": ["employee-leave"], "fact": "LinkType employee-leave（员工→请假 1:N）已建模"},
    {"keys": ["customer-order"], "fact": "LinkType customer-order（客户→订单 1:N）已建模"},
    {"keys": ["high"], "fact": "ticket priority=high 为已知取值"},
    {"keys": ["年假", "事假", "调休"], "fact": "leave-request reason 取值：年假/事假/调休"},
    {"keys": ["ORD-"], "fact": "sales-order 单号前缀 ORD-（5000 张订单已绑定为 Individual）"},
    {"keys": ["未回款", "逾期"], "fact": "invoice-status 已建模（含未回款/逾期等取值）"},
)


def _human_answer_question(q: EvaluationQuestion) -> RunRecord:
    """模拟 human runner：keyword-in-data 确定性查找。

    从 business_question 提取前 3 个实义词 + latin token，与字典条目
    keys 做双向子串匹配（并兜底全题干子串扫描——领域专家认识题干里的
    专有名词）。命中任一条目即 success。
    """
    t0 = time.perf_counter()
    question = q.business_question
    kws = content_words(question, 3)
    question_fold = question.casefold()
    hits: list[str] = []
    for entry in _KNOWN_DATA_FACTS:
        keys = [k.casefold() for k in entry["keys"]]  # type: ignore[union-attr]
        kws_fold = [kw.casefold() for kw in kws]
        matched = any(k in question_fold for k in keys) or any(
            kw in k or k in kw for kw in kws_fold for k in keys
        )
        if matched:
            hits.append(str(entry["fact"]))
    success = bool(hits)
    answer = json.dumps(
        {"mode": "human-sim-keyword-in-data", "keywords": kws, "hits": hits[:5]},
        ensure_ascii=False,
    )
    return RunRecord(
        question_id=q.id,
        participant="human",
        success=success,
        answer=answer,
        duration_ms=int((time.perf_counter() - t0) * 1000),
        run_at=datetime.now(UTC).isoformat(),
    )


# ---------------------------------------------------------------------------
# AI runner：本体检索通道（hybrid 优先，0 结果降级语义检索）
# ---------------------------------------------------------------------------


class OntSearchClient:
    """dev 栈网关客户端：登录 + object-search / hybrid。"""

    def __init__(self, gateway: str, timeout_s: float = 120.0) -> None:
        self._base = gateway.rstrip("/")
        self._client = httpx.Client(timeout=httpx.Timeout(timeout_s, connect=15.0))
        self._token: str | None = None

    def login(self) -> None:
        resp = self._client.post(
            f"{self._base}/api/v1/iam/auth/login",
            json={"username": DEV_USER, "password": DEV_PASSWORD},
        )
        resp.raise_for_status()
        token = resp.json().get("accessToken")
        if not token:
            raise RuntimeError(f"登录响应缺少 accessToken: {resp.text[:200]}")
        self._token = token

    def _headers(self) -> dict[str, str]:
        if not self._token:
            self.login()
        return {"Authorization": f"Bearer {self._token}"}

    def search(self, text: str, top_k: int) -> tuple[list[dict], str]:
        """hybrid 优先，0 结果降级语义检索；返回 (cards, 实际使用的通道)。"""
        for path, mode in (
            ("/api/v1/ont/v2/object-search/hybrid", "hybrid"),
            ("/api/v1/ont/v2/object-search", "semantic"),
        ):
            resp = self._client.post(
                f"{self._base}{path}",
                json={"text": text, "top_k": top_k},
                headers=self._headers(),
            )
            resp.raise_for_status()
            cards = resp.json().get("cards", []) or []
            if cards:
                return cards, mode
        return [], "hybrid+semantic"

    def close(self) -> None:
        self._client.close()


def _card_hit_keywords(card: dict, expected_kws: list[str], expected_latin: set[str]) -> list[str]:
    """单卡词汇交集判定：expected 实义词子串命中 或 latin token 重叠。"""
    matched_texts = " ".join(
        str(m.get("value_text", "")) for m in card.get("matched", []) or []
    ).casefold()
    hits: list[str] = []
    for kw in expected_kws:
        if kw.casefold() in matched_texts:
            hits.append(kw)
    card_latin = set(_latin_tokens(matched_texts))
    overlap = expected_latin & card_latin
    hits.extend(sorted(overlap))
    return hits


def _make_ai_runner(client: OntSearchClient, top_k: int, delay_s: float, total: int):
    """构造 AI runner 闭包（run_suite 注入用；每题间隔 delay 秒防限流）。"""
    state = {"done": 0}

    def runner(q: EvaluationQuestion) -> RunRecord:
        t0 = time.perf_counter()
        cards: list[dict] = []
        mode = ""
        error: str | None = None
        hit_kws: list[str] = []
        try:
            cards, mode = client.search(q.business_question, top_k)
        except Exception as exc:  # 网络/超时：记失败不中断
            error = f"{type(exc).__name__}: {exc}"

        expected = q.expected_answer or ""
        expected_kws = content_words(expected, 3)
        expected_latin = set(_latin_tokens(expected))
        if cards:
            for card in cards:
                hit_kws = _card_hit_keywords(card, expected_kws, expected_latin)
                if hit_kws:
                    break
        success = bool(cards) and bool(hit_kws) if expected_kws or expected_latin else bool(cards)

        top = [
            {
                "rid": c.get("individual_rid"),
                "score": c.get("score"),
                "matched": [
                    str(m.get("value_text", ""))[:80] for m in (c.get("matched") or [])[:3]
                ],
            }
            for c in cards[:3]
        ]
        answer = json.dumps(
            {
                "mode": mode,
                "n_cards": len(cards),
                "query": q.business_question,
                "expected_keywords": expected_kws,
                "hit_keywords": hit_kws,
                "top_cards": top,
                **({"error": error} if error else {}),
            },
            ensure_ascii=False,
        )
        state["done"] += 1
        if state["done"] < total and delay_s > 0:
            time.sleep(delay_s)
        return RunRecord(
            question_id=q.id,
            participant="ai",
            success=success,
            answer=answer,
            duration_ms=int((time.perf_counter() - t0) * 1000),
            run_at=datetime.now(UTC).isoformat(),
        )

    return runner


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------


def _pct(n: int, d: int) -> str:
    return f"{n / d * 100:.1f}%" if d else "n/a"


def _print_report(
    questions: list[EvaluationQuestion],
    human_runs: list[RunRecord],
    ai_runs: list[RunRecord],
    ai_path: Path,
    args: argparse.Namespace,
) -> None:
    report = quadrant_report(human_runs, ai_runs)
    ai_ok = sum(1 for r in ai_runs if r.success)
    human_ok = sum(1 for r in human_runs if r.success)
    tag_stats: dict[str, dict[str, list[int]]] = {}
    q_by_id = {q.id: q for q in questions}
    for participant, runs in (("ai", ai_runs), ("human", human_runs)):
        for r in runs:
            for tag in q_by_id[r.question_id].tags:
                bucket = tag_stats.setdefault(tag, {"ai": [0, 0], "human": [0, 0]})
                bucket[participant][1] += 1
                if r.success:
                    bucket[participant][0] += 1

    lines: list[str] = []
    lines.append("=" * 72)
    lines.append("G34 四象限基线报告（question_bank v%s）" % QUESTION_BANK_VERSION)
    lines.append(
        f"题数={len(ai_runs)}  top_k={args.top_k}  delay={args.delay}s  gateway={args.gateway}"
    )
    lines.append(f"AI runs JSONL: {ai_path}")
    lines.append("(human 侧为 keyword-in-data 模拟基线，非真实人类作答)")
    lines.append("-" * 72)
    lines.append("四象限 counts：")
    for quad in ("both_success", "ai_only", "human_only", "both_fail", "unknown"):
        lines.append(f"  {quad:<13} = {report['counts'][quad]:>2}  # {DIAGNOSIS[quad]}")
    lines.append(
        f"  aligned={report['counts']['aligned']}  "
        f"human_total={report['counts']['human_total']}  "
        f"ai_total={report['counts']['ai_total']}"
    )
    lines.append("-" * 72)
    for quad in ("both_success", "ai_only", "human_only", "both_fail", "unknown"):
        ids = report[quad]
        if ids:
            lines.append(f"{quad} ({len(ids)}): {', '.join(ids)}")
    lines.append("-" * 72)
    lines.append(f"AI 成功率: {ai_ok}/{len(ai_runs)} = {_pct(ai_ok, len(ai_runs))}")
    lines.append(
        f"human(模拟) 成功率: {human_ok}/{len(human_runs)} = {_pct(human_ok, len(human_runs))}"
    )
    lines.append("-" * 72)
    lines.append("分 tag 成功率（tag  ai_success/total  human_success/total）：")
    for tag in sorted(tag_stats):
        ai_n, ai_t = tag_stats[tag]["ai"]
        hu_n, hu_t = tag_stats[tag]["human"]
        lines.append(
            f"  {tag:<14} ai {_ai_fmt(ai_n, ai_t)}   human {_pct(hu_n, hu_t)} ({hu_n}/{hu_t})"
        )
    lines.append("=" * 72)
    print("\n".join(lines))


def _ai_fmt(n: int, total: int) -> str:
    return f"{_pct(n, total)} ({n}/{total})"


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="G34 四象限基线跑批（本体检索 AI 参与者）")
    parser.add_argument("--top-k", type=int, default=5, help="检索 top_k（默认 5）")
    parser.add_argument("--delay", type=float, default=0.3, help="每题间隔秒数（默认 0.3）")
    parser.add_argument("--limit", type=int, default=0, help="只跑前 N 题（默认全部 50）")
    parser.add_argument("--gateway", default=DEFAULT_GATEWAY, help="API 网关地址")
    parser.add_argument(
        "--append",
        action="store_true",
        help="追加写 JSONL（默认覆盖，保持基线可复现；格式同 append_runs）",
    )
    parser.add_argument("--timeout", type=float, default=120.0, help="单请求超时秒数")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台 UTF-8
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    questions = build_question_bank()
    if args.limit > 0:
        questions = questions[: args.limit]
    print(f"题库 v{QUESTION_BANK_VERSION}：{len(questions)} 题；网关 {args.gateway}")

    client = OntSearchClient(args.gateway, timeout_s=args.timeout)
    try:
        client.login()
        print("登录 OK，开始 AI 检索作答……")
        ai_runs = run_suite(
            questions, _make_ai_runner(client, args.top_k, args.delay, len(questions))
        )
    finally:
        client.close()

    human_runs = run_suite(questions, _human_answer_question)

    ai_path = _AI_RUNS_PATH
    if not args.append and ai_path.exists():
        ai_path.unlink()
    append_runs(ai_path, ai_runs)
    human_path = _HUMAN_RUNS_PATH
    if not args.append and human_path.exists():
        human_path.unlink()
    append_runs(human_path, human_runs)

    _print_report(questions, human_runs, ai_runs, ai_path, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
