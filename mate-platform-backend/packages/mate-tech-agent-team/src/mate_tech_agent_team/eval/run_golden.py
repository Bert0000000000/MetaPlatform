"""``python -m mate_tech_agent_team.eval.run_golden`` —— Golden Evaluation 的 CLI 入口。

在**真实 provider** 上把 :mod:`~.dataset` 里的任务逐条跑一遍，用 :mod:`.scorer`
打分，输出机读报告（JSON）与人读摘要。

**绝不静默失败**，三条退出码分工明确：

===== ================================================================
0     全部任务在真实 provider 上跑完，**没有**假回执，报告可信
2     真实服务 / provider 不可达（探活失败）——"没跑成"，不是"跑得差"
3     检出假回执（回显 / 零模型调用）——本次报告**不可信**，不许当基线
4     有任务在预算内没到终态（超时）——报告只覆盖跑完的那些
===== ================================================================

用法::

    python -m mate_tech_agent_team.eval.run_golden \\
        --base-url http://127.0.0.1:8100 \\
        --out .tmp/golden-report.json

凭据默认取 ``MATE_EVAL_USERNAME`` / ``MATE_EVAL_PASSWORD``，回落到开发环境的
admin/admin123（env-facts 里公开的 dev 登录）。**不把口令写进代码**，只在缺省
兜底时用那个公开的 dev 值。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections.abc import Callable
from pathlib import Path

from .client import AgentTeamClient, ProviderUnavailable, RunTimedOut, roster_items
from .dataset import DatasetError, GoldenDataset, load_dataset
from .report import build_report, now_iso
from .scorer import score
from .trace import FakeReceiptError, RunTrace, assert_real_provider, parse_run_state

EXIT_OK = 0
EXIT_PROVIDER_UNAVAILABLE = 2
EXIT_FAKE_RECEIPT = 3
EXIT_INCOMPLETE = 4


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m mate_tech_agent_team.eval.run_golden",
        description="在真实 provider 上跑 Golden Dataset 并产出机读报告。",
    )
    parser.add_argument(
        "--dataset",
        default=None,
        help="数据集 YAML 路径（默认取包内 eval/golden_dataset.yaml）",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("MATE_EVAL_BASE_URL", "http://127.0.0.1:8100"),
        help="API 网关地址（评测走生产同一条链，不直连域容器）",
    )
    parser.add_argument("--username", default=os.getenv("MATE_EVAL_USERNAME", "admin"))
    parser.add_argument("--password", default=os.getenv("MATE_EVAL_PASSWORD", "admin123"))
    parser.add_argument("--task", action="append", default=None, help="只跑指定 task id（可重复）")
    parser.add_argument(
        "--repeat",
        type=int,
        default=1,
        help="每个任务跑几遍（>=2 才有「重启后结果一致率」；默认 1）",
    )
    parser.add_argument("--poll-interval", type=float, default=5.0)
    parser.add_argument("--timeout", type=float, default=420.0, help="单任务墙钟预算（秒）")
    parser.add_argument("--out", default=".tmp/golden-report.json", help="JSON 报告落点")
    parser.add_argument("--quiet", action="store_true", help="只打摘要，不打实时进度")
    return parser


def _selected_tasks(dataset: GoldenDataset, wanted: list[str] | None):
    if not wanted:
        return list(dataset.tasks)
    known = {t.id for t in dataset.tasks}
    missing = [w for w in wanted if w not in known]
    if missing:
        raise DatasetError(f"--task 指定的 id 不在数据集里：{'、'.join(missing)}")
    return [t for t in dataset.tasks if t.id in wanted]


def _write_failure_record(out_path: str, *, reason: str, dataset: GoldenDataset) -> None:
    """provider 不可达时也留一份**明确记录**——"没跑成因为 X"，不是空白。"""
    from .report import REPORT_VERSION

    payload = {
        "report_version": REPORT_VERSION,
        "dataset": {"version": dataset.version, "created_at": dataset.created_at},
        "valid": False,
        "provider_error": reason,
        "metrics": [],
        "per_task": {},
        "notes": ["provider 不可达，未产出任何基线数字——这是缺失记录，不是零分"],
    }
    target = Path(out_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _describe_probe(profiles: dict) -> dict:
    ids = [str(p.get("profile_id") or "") for p in roster_items(profiles) if isinstance(p, dict)]
    return {
        "summary": f"{len(ids)} 名员工：{'、'.join(i for i in ids if i)}",
        "profiles": ids,
    }


def main(
    argv: list[str] | None = None,
    *,
    client_factory: Callable[..., AgentTeamClient] = AgentTeamClient,
) -> int:
    """CLI 主入口。``client_factory`` 是**测试注入点**——用例据此喂假传输，
    不必碰网络，但走的是与生产逐字相同的编排（探活 / 失败记录 / 退出码）。"""
    args = _parser().parse_args(argv)
    try:
        dataset = load_dataset(args.dataset)
        tasks = _selected_tasks(dataset, args.task)
    except DatasetError as exc:
        print(f"[golden] 数据集不合法：{exc}", file=sys.stderr)
        return EXIT_PROVIDER_UNAVAILABLE

    repeats = max(1, args.repeat)
    client = client_factory(
        base_url=args.base_url.rstrip("/"), username=args.username, password=args.password
    )
    started_at = now_iso()
    started_monotonic = time.monotonic()

    # ── 探活：不可达就**整轮退出**，绝不在空服务上跑出一堆 0 分 ──────────
    try:
        client.login()
        profiles = client.probe()
    except ProviderUnavailable as exc:
        reason = f"真实 provider/服务不可达：{exc}"
        print(f"[golden] {reason}", file=sys.stderr)
        _write_failure_record(args.out, reason=reason, dataset=dataset)
        print(f"[golden] 已写入未运行记录：{args.out}", file=sys.stderr)
        return EXIT_PROVIDER_UNAVAILABLE

    probe = _describe_probe(profiles)
    usage_before = client.usage_snapshot(dataset.tenant_id)

    traces: list[RunTrace] = []
    repeat_traces: list[RunTrace] = []
    fake_receipts: list[str] = []
    incomplete: list[str] = []

    for round_index in range(repeats):
        bucket = traces if round_index == 0 else repeat_traces
        for task in tasks:
            label = task.id if repeats == 1 else f"{task.id}#{round_index + 1}"
            if not args.quiet:
                print(f"[golden] 起 run：{label} —— {task.title}", flush=True)

            def _tick(elapsed: float, _label: str = label) -> None:
                if not args.quiet:
                    print(f"[golden]   {_label} 已等 {elapsed:.0f}s …", flush=True)

            try:
                timed = client.run_task(
                    goal=task.goal,
                    max_parallel=task.max_parallel,
                    poll_interval=args.poll_interval,
                    timeout_seconds=args.timeout,
                    on_poll=_tick,
                )
            except RunTimedOut as exc:
                incomplete.append(f"{label}: {exc}")
                print(f"[golden]   {label} 超时未终态：{exc}", file=sys.stderr, flush=True)
                continue
            except ProviderUnavailable as exc:
                # 轮询期服务短暂不可达（网关 502 / agent-team 重启）——这一件没
                # 跑成，但整轮评测要**继续并落报告**，不是把堆栈甩出去。
                incomplete.append(f"{label}: 服务不可达：{exc}")
                print(f"[golden]   {label} 服务不可达：{exc}", file=sys.stderr, flush=True)
                continue

            trace = parse_run_state(
                task_id=task.id,
                raw=timed.raw,
                observed_statuses=timed.observed_statuses,
                first_response_seconds=timed.first_response_seconds,
                total_seconds=timed.total_seconds,
            )
            try:
                # 假回执 = harness 失效，如实记下但**不**把它当质量信号。
                assert_real_provider(trace)
            except FakeReceiptError as exc:
                fake_receipts.append(f"{label}: {exc}")
                print(f"[golden]   {label} ⚠ 假回执：{exc}", file=sys.stderr, flush=True)
            bucket.append(trace)
            if not args.quiet:
                print(
                    f"[golden]   {label} 终态={trace.status} 子任务={len(trace.subtasks)} "
                    f"员工={len(trace.results)} 证据={trace.evidence_count} "
                    f"首响应={trace.first_response_seconds}s",
                    flush=True,
                )

    usage_after = client.usage_snapshot(dataset.tenant_id)
    usage_delta = None
    if usage_before and usage_after:
        usage_delta = {
            "total_tokens": int(usage_after.get("total_tokens") or 0)
            - int(usage_before.get("total_tokens") or 0),
            "total_cost": float(usage_after.get("total_cost") or 0.0)
            - float(usage_before.get("total_cost") or 0.0),
            "by_model": usage_after.get("by_model"),
        }

    score_report = score(
        dataset,
        traces,
        repeats=repeat_traces or None,
        usage_delta=usage_delta,
    )

    notes = [
        "词法覆盖（required_aspects / 角色命中）是代理量，不是语义判分——口径见 scorer 模块 docstring",
        "成本真值只在 llmgw /usage/{tenant}；检查点里没有 token 字段",
    ]
    if repeats == 1:
        notes.append("本轮未跑第二遍（--repeat 1），「重启后结果一致率」按口径记 not_computed")
    elapsed = time.monotonic() - started_monotonic
    notes.append(f"整轮墙钟 {elapsed:.0f}s（{len(tasks)} 任务 × {repeats} 遍）")

    report = build_report(
        dataset=dataset,
        score=score_report,
        provider_probe=probe,
        started_at=started_at,
        finished_at=now_iso(),
        fake_receipts=fake_receipts,
        notes=notes,
    )
    path = report.write(args.out)

    print("")
    for line in report.summary_lines():
        print(line)
    print(f"\n报告写入：{path}")

    if fake_receipts:
        print(
            f"\n[golden] 退出码 {EXIT_FAKE_RECEIPT}：检出 {len(fake_receipts)} 条假回执，"
            "本次数字不得作为基线。",
            file=sys.stderr,
        )
        return EXIT_FAKE_RECEIPT
    if incomplete:
        print(
            f"\n[golden] 退出码 {EXIT_INCOMPLETE}：{len(incomplete)} 个任务超时未终态。",
            file=sys.stderr,
        )
        return EXIT_INCOMPLETE
    return EXIT_OK


if __name__ == "__main__":  # pragma: no cover - 由 __main__ 入口触发
    raise SystemExit(main())


__all__ = [
    "EXIT_FAKE_RECEIPT",
    "EXIT_INCOMPLETE",
    "EXIT_OK",
    "EXIT_PROVIDER_UNAVAILABLE",
    "main",
]
