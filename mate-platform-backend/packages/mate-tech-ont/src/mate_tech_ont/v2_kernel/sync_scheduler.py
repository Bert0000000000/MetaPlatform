"""P1-4：数据源同步调度器 —— backing datasource 的周期增量同步。

设计要点：
- **进程内后台任务**（FastAPI lifespan 启动 asyncio task），不依赖外部
  scheduler 服务 —— dev 单容器即可工作；生产可由 KERNEL_BACKEND=pg +
  多副本 + 领导选举升级（v1 单副本假设）。
- 周期 ``ONT_SYNC_INTERVAL_SECONDS``（默认 300s，0=禁用）；每次 tick：
  扫全租户 ``ont_backing_datasource`` 声明 → 按类型分组 → 逐类型调
  ``sync_backing_datasources(class_rid, incremental=True)``。
- **同步健康状态**：``status()`` 返回 per-(tenant,class,source) 的
  last_ok/last_error/last_synced_at/duration —— API 层暴露为
  ``GET /datasources/sync-status``（同步健康面）。
- 失败隔离：单类型失败不中断整轮；错误计数与连续失败次数记录。

测试：``sync_scheduler._run_once`` 是纯函数式单轮执行（可注入 repo 与
时间函数），调度循环只是 asyncio 包装。
"""

from __future__ import annotations

import asyncio
import os
import time
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

DEFAULT_INTERVAL = 300.0


class SyncScheduler:
    """进程内周期同步器。线程不安全（单 asyncio loop 内使用）。"""

    def __init__(self, repo: Any, interval: float | None = None) -> None:
        self._repo = repo
        self._interval = (
            interval
            if interval is not None
            else float(os.environ.get("ONT_SYNC_INTERVAL_SECONDS", str(int(DEFAULT_INTERVAL))))
        )
        self._task: asyncio.Task[None] | None = None
        # (tenant_id, class_rid) → 状态快照
        self._status: dict[tuple[str, str], dict[str, Any]] = {}

    # ───── 生命周期 ─────

    def start(self) -> None:
        if self._interval <= 0:
            logger.info("sync_scheduler.disabled", interval=self._interval)
            return
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.get_event_loop().create_task(self._loop())
        logger.info("sync_scheduler.started", interval=self._interval)

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            logger.info("sync_scheduler.stopped")

    async def _loop(self) -> None:
        # 启动即跑一轮（容器重启立即对齐增量），然后按周期循环
        while True:
            try:
                await self.run_once()
            except Exception as e:
                logger.error("sync_scheduler.tick_failed", error=str(e))
            await asyncio.sleep(self._interval)

    # ───── 单轮执行（测试可直接调）─────

    async def run_once(self) -> dict[str, int]:
        """全租户扫声明 → 逐类型增量同步。返回 {synced, failed, skipped}。"""
        declarations = self._all_declarations()
        stats = {"synced": 0, "failed": 0, "skipped": 0}
        for tenant_id, class_rid in declarations:
            t0 = time.monotonic()
            try:
                result = await asyncio.to_thread(
                    self._sync_one,
                    tenant_id,
                    class_rid,
                )
                self._status[(tenant_id, class_rid)] = {
                    "tenant_id": tenant_id,
                    "class_rid": class_rid,
                    "last_result": result,
                    "last_error": "",
                    "last_duration_ms": int((time.monotonic() - t0) * 1000),
                    "last_run_at": datetime.now(UTC).isoformat(),
                    "consecutive_failures": 0,
                }
                stats["synced"] += 1
            except Exception as e:
                prev = self._status.get((tenant_id, class_rid), {})
                fails = int(prev.get("consecutive_failures", 0)) + 1
                self._status[(tenant_id, class_rid)] = {
                    "tenant_id": tenant_id,
                    "class_rid": class_rid,
                    "last_result": {},
                    "last_error": str(e)[:300],
                    "last_duration_ms": int((time.monotonic() - t0) * 1000),
                    "last_run_at": datetime.now(UTC).isoformat(),
                    "consecutive_failures": fails,
                }
                stats["failed"] += 1
                logger.warning(
                    "sync_scheduler.sync_failed",
                    tenant_id=tenant_id,
                    class_rid=class_rid,
                    error=str(e)[:200],
                    consecutive_failures=fails,
                )
        if declarations:
            logger.info("sync_scheduler.tick", **stats, types=len(declarations))
        return stats

    def _all_declarations(self) -> list[tuple[str, str]]:
        """全租户有声明 backing datasource 的 (tenant, class) 列表。

        从 repo 侧拿全量声明。PgOntologyRepository.list_backing_datasources()
        无参调用返回全部（无 RLS 时）—— 生产走 tenant 上下文；dev 单租户成立。
        """
        try:
            rows = self._repo.list_backing_datasources()  # type: ignore[attr-defined]
        except TypeError:
            rows = self._repo.list_backing_datasources(None)  # type: ignore[arg-type]
        out: list[tuple[str, str]] = []
        seen: set[tuple[str, str]] = set()
        for row in rows:
            tenant = str(row.get("tenant_id") or "")
            cls = str(row.get("class_rid") or "")
            key = (tenant, cls)
            if cls and key not in seen:
                seen.add(key)
                out.append(key)
        return out

    def _sync_one(self, tenant_id: str, class_rid: str) -> dict[str, Any]:
        """单类型增量同步（线程内跑；PG repo 是 sync 实现）。"""
        scope = getattr(self._repo, "tenant_scope", None)
        if scope is not None:
            with scope(tenant_id):
                return self._repo.sync_backing_datasources(class_rid, True)
        return self._repo.sync_backing_datasources(class_rid, True)

    # ───── 状态查询 ─────

    def status(self, class_rid: str | None = None) -> list[dict[str, Any]]:
        rows = list(self._status.values())
        if class_rid:
            rows = [r for r in rows if r["class_rid"] == class_rid]
        return sorted(rows, key=lambda r: r["class_rid"])
