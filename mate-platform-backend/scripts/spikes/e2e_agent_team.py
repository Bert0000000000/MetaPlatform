"""端到端主链演示（真跑，不是回放）。

一句话 → 大脑拆任务图 → 并行派给 ≥2 个数字员工（各带自己的提示词与工具白名单）
→ 真实执行（真调 llmgw、真查本体）→ 停一次等人确认 → 汇总。

运行（先起好网关/llmgw/ont，并设 SERVICE_CLIENT_SECRET）::

    cd mate-platform-backend
    export SERVICE_CLIENT_SECRET=<...>
    PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe scripts/spikes/e2e_agent_team.py

判读要点：
  * 每个员工的 ``source`` 必须是 ``llm``，且 ``llm_calls`` > 0；
  * ``output`` 不能等于 ``instruction``（相等即"假回执"）；
  * 员工之间 ``output`` 必须不同；
  * 第一段跑完状态必须是 ``awaiting_approval``（停在人工闸门）。
"""

from __future__ import annotations

import asyncio
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "packages/mate-tech-agent-team/src"))
sys.path.insert(0, str(ROOT / "packages/mate-clients/src"))
sys.path.insert(0, str(ROOT / "packages/mate-platform/src"))
sys.path.insert(0, str(ROOT / "packages/mate-tech-db/src"))
sys.path.insert(0, str(ROOT / "packages/mate-kernel/src"))
sys.path.insert(0, str(ROOT / "packages/mate-common/src"))
sys.path.insert(0, str(ROOT / "scripts"))

os.environ.setdefault(
    "MATE_AGENT_TEAM_ADMIN_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform"
)
os.environ.setdefault(
    "MATE_AGENT_TEAM_DSN", "postgresql://mate_app:mate_app@127.0.0.1:5432/metaplatform"
)
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8180")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "false")
os.environ.setdefault("MATE_LLMGW_URL", "http://localhost:8008")
os.environ.setdefault("MATE_ONT_URL", "http://localhost:8007")
os.environ.setdefault("MATE_MCP_URL", "http://localhost:8081")
os.environ.setdefault("MATE_GATEWAY_URL", "http://localhost:8100")

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from dev_user_token import login

TENANT = "tenant-default"
GOAL = "把本月的异常订单找出来，逐个分析原因，给我一份汇总"


def _rule(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
    return ok


async def main() -> int:
    if not os.getenv("SERVICE_CLIENT_SECRET"):
        print("请先设置 SERVICE_CLIENT_SECRET（服务身份密钥）", file=sys.stderr)
        return 2

    from mate_tech_agent_team.wiring import build_service

    user_token = login()
    service = build_service()
    results: list[bool] = []

    _rule("① 一句话 → 任务图（跑到人工闸门为止）")
    print(f"目标：{GOAL}")
    run = await service.start(tenant_id=TENANT, goal=GOAL, user_token=user_token)
    print(f"status = {run['status']}   run_id = {run['run_id']}")
    if run.get("error"):
        print(f"  error: {run['error'][:400]}")
    for task in run.get("subtasks", []):
        print(f"  · {task['task_id']} → {task['profile_id']}：{task['instruction'][:70]}")
    results.append(_check("拆出 ≥2 个可并行子任务", len(run.get("subtasks", [])) >= 2))
    results.append(
        _check("停在人工确认闸门", run["status"] == "awaiting_approval", run.get("hitl_reason", ""))
    )

    _rule("② 各员工回执（真跑：真调模型、真查本体）")
    for task_id, result in sorted(run.get("results", {}).items()):
        print(f"\n--- {task_id} · {result.get('profile_id')} ---")
        print(
            f"  source={result.get('source')} llm_calls={result.get('llm_calls')} "
            f"status={result.get('status')}"
        )
        for call in result.get("tool_calls", []):
            verdict = "允许" if call.get("allowed") else f"拒绝({call.get('rejected')})"
            print(f"  tool: {call.get('name')} → {verdict}")
        print(f"  产出：{(result.get('output') or result.get('error') or '')[:400]}")

    ok_results = {tid: r for tid, r in run.get("results", {}).items() if r.get("status") == "ok"}
    outputs = {tid: r.get("output", "") for tid, r in ok_results.items()}
    instructions = {t["task_id"]: t["instruction"] for t in run.get("subtasks", [])}
    results.append(
        _check(
            "每个员工都调过模型", all(r.get("llm_calls", 0) >= 1 for r in run["results"].values())
        )
    )
    results.append(
        _check(
            "至少一个员工跑通", bool(ok_results), f"{len(ok_results)}/{len(run.get('results', {}))}"
        )
    )
    results.append(
        _check(
            "跑通的产出不是原话回填（D-10）",
            bool(outputs)
            and all(outputs[tid].strip() not in ("", instructions.get(tid, "")) for tid in outputs),
        )
    )
    results.append(_check("跑通的员工之间产出不同", len(set(outputs.values())) == len(outputs)))

    if run["status"] != "awaiting_approval":
        print("\n本次运行未到闸门（多为上游模型超时/限流），跳过后续步骤。")
        return 1

    _rule("③ 人工确认 → 汇总")
    done = await service.resume(
        tenant_id=TENANT, run_id=run["run_id"], approved=True, user_token=user_token
    )
    print(f"status = {done['status']}")
    print("\n汇总：\n" + (done.get("summary") or "")[:1500])
    results.append(_check("确认后完成", done["status"] == "completed"))

    _rule("结果")
    print(json.dumps({"passed": sum(results), "total": len(results)}, ensure_ascii=False))
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
