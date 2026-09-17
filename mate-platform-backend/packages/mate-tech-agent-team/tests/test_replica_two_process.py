"""`MP-REPLICA-READINESS-01` 的判据：**两个真进程**同时在跑。

**为什么单开一个文件**：``test_cross_replica_cancel.py`` 与
``test_idempotency_race.py`` 里的"跨副本"是**同进程两个 RunControl 实例共享一个
内存对象**。它们验到的是真东西（另有两个文件里各有一条真 PG 用例，8 条独立连接
并发抢同一把钥匙、断言恰好一个赢），但**"两个进程同时在跑"这个状态本身**从来没
被验过——而那正是多副本的定义。

这里用 ``subprocess`` 起**两个真的 Python 进程**，各自 import 本包、各自连库、
各自抢同一把钥匙。断言：

1. 跨进程并发抢同一轮的租约 → **恰好一个赢**；
2. 赢的那个进程持有租约期间，另一个进程抢不走（它不是"读后写窗口"，是数据库在挡）；
3. 持有的进程被杀 → 租约到期后**另一个进程能接管**（接手 epoch 前进）。

子进程通过 stdout 回一行 JSON 汇报结果——**不靠退出码猜**，因为"进程活着但结论
是失败"与"进程死了"是两件事。
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from typing import Any

TENANT = "tenant-replica-proc"
RUN = "run-two-proc-1"

#: 子进程脚本：起事件循环、连真库、按传进来的动作做一件事、把结论打成一行 JSON。
_CHILD = r"""
import asyncio, json, os, sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from mate_tech_agent_team.run_lease import PgRunLeases

DSN, SCHEMA, OWNER, ACTION, TTL = sys.argv[1:6]

async def main():
    leases = PgRunLeases(DSN, schema=SCHEMA, ttl=float(TTL))
    if ACTION == "acquire":
        lease = await leases.acquire(
            tenant_id="tenant-replica-proc", run_id="run-two-proc-1",
            owner=OWNER, ttl=float(TTL),
        )
        print(json.dumps({"owner": OWNER, "won": lease is not None,
                          "epoch": lease.lease_epoch if lease else 0}), flush=True)
        return
    if ACTION == "hold":
        # 抢到之后一直续租，直到被叫停（父进程 kill）
        lease = await leases.acquire(
            tenant_id="tenant-replica-proc", run_id="run-two-proc-1",
            owner=OWNER, ttl=float(TTL),
        )
        print(json.dumps({"owner": OWNER, "won": lease is not None,
                          "epoch": lease.lease_epoch if lease else 0}), flush=True)
        if lease is None:
            return
        while True:
            await asyncio.sleep(float(TTL) / 4)
            await leases.renew(tenant_id="tenant-replica-proc", run_id="run-two-proc-1",
                               owner=OWNER, epoch=lease.lease_epoch, ttl=float(TTL))

asyncio.run(main())
"""


def _spawn(*, dsn: str, schema: str, owner: str, action: str, ttl: float) -> subprocess.Popen[str]:
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    # 子进程 import 本包要走主树的 src（与父进程同一份代码）。
    src = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src")
    env["PYTHONPATH"] = os.pathsep.join([src, env.get("PYTHONPATH", "")])
    return subprocess.Popen(
        [sys.executable, "-c", _CHILD, dsn, schema, owner, action, str(ttl)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env=env,
    )


def _report(proc: subprocess.Popen[str], *, timeout: float = 30.0) -> dict[str, Any]:
    """等子进程打出那一行 JSON。超时/崩溃都把 stderr 带出来——别让人猜。"""
    deadline = time.monotonic() + timeout
    assert proc.stdout is not None
    while time.monotonic() < deadline:
        line = proc.stdout.readline()
        if line:
            return json.loads(line.strip())
        if proc.poll() is not None:
            break
        time.sleep(0.01)
    err = proc.stderr.read() if proc.stderr is not None else ""
    raise AssertionError(f"子进程没给出结论（rc={proc.poll()}）：\n{err[-2000:]}")


def _kill(proc: subprocess.Popen[str]) -> None:
    proc.kill()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:  # pragma: no cover - 杀不掉的极端情况
        pass


# ── 判据：两个真进程 ────────────────────────────────────────────────────


def test_two_real_processes_cannot_both_claim_the_same_run(rls_schema: str, app_dsn: str) -> None:
    """**跨进程并发抢同一轮 → 恰好一个赢**（判据 ⑥ 的真进程版）。

    两个进程各自 import 本包、各自连库、同时打那一条
    ``INSERT ... ON CONFLICT ... WHERE ... RETURNING``。赢家只有一个这件事由
    **数据库**保证，不是靠 Python 里的时序——这正是同进程模拟验不到的那部分。
    """
    procs = [
        _spawn(dsn=app_dsn, schema=rls_schema, owner=f"proc-{i}", action="acquire", ttl=60.0)
        for i in range(2)
    ]
    try:
        reports = [_report(proc) for proc in procs]
    finally:
        for proc in procs:
            if proc.poll() is None:
                _kill(proc)

    winners = [r for r in reports if r["won"]]
    assert len(winners) == 1, f"两个进程都抢到了：{reports}"
    assert winners[0]["epoch"] == 1


def test_a_second_process_cannot_steal_a_lease_a_live_process_is_holding(
    rls_schema: str, app_dsn: str
) -> None:
    """持有者还活着（一直续租）时，另一个进程**抢不走**。

    这条与上一条的差别很重要：上一条是两个进程**同时**打；这一条是"一个已经
    稳稳持有、并在续租"，另一个再打——它必须空手而归（而不是"晚一点就抢到了"）。
    """
    holder = _spawn(dsn=app_dsn, schema=rls_schema, owner="proc-holder", action="hold", ttl=5.0)
    try:
        first = _report(holder)
        assert first["won"] is True

        # 让持有者先续租一轮（证明它真的活着），再让挑战者上
        time.sleep(1.5)
        challenger = _spawn(
            dsn=app_dsn, schema=rls_schema, owner="proc-challenger", action="acquire", ttl=60.0
        )
        try:
            second = _report(challenger)
        finally:
            if challenger.poll() is None:
                _kill(challenger)
        assert second["won"] is False, "持有者还在续租，挑战者却抢到了"
    finally:
        _kill(holder)


def test_a_killed_holder_leaves_a_lease_another_process_can_take_over(
    rls_schema: str, app_dsn: str
) -> None:
    """持有者**被真的杀掉** → 租约到期后另一个进程能接管，且 epoch 前进。

    这一条对应"随机杀死执行 Pod 后 Run 被接管"的那个前提：进程没了，
    续租就停了；另一台机器必须能接上，而且接上之后**上一任的延迟写会被拒**
    （epoch 判据，见 ``test_run_lease.py``）。
    """
    holder = _spawn(dsn=app_dsn, schema=rls_schema, owner="proc-doomed", action="hold", ttl=3.0)
    try:
        first = _report(holder)
        assert first["won"] is True
    finally:
        _kill(holder)  # 硬杀：不给它任何收尾机会（= Pod 被 kill）

    # 等租约自然过期（TTL 3s），再让新进程接管。
    deadline = time.monotonic() + 20.0
    winner: dict[str, Any] | None = None
    while time.monotonic() < deadline:
        taker = _spawn(
            dsn=app_dsn, schema=rls_schema, owner="proc-taker", action="acquire", ttl=60.0
        )
        try:
            report = _report(taker)
        finally:
            if taker.poll() is None:
                _kill(taker)
        if report["won"]:
            winner = report
            break
        time.sleep(0.5)

    assert winner is not None, "持有者被杀之后，租约到期了也没人能接管"
    assert winner["epoch"] == first["epoch"] + 1, "接管没有让 epoch 前进"
