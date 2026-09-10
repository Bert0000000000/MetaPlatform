"""P1-5：PG LISTEN/NOTIFY 事件总线 —— outbox 写入即时推 WS 订阅者。

设计：
- ``NotifyHub``：单例。一个专用 psycopg2 连接执行 ``LISTEN ont_changes``；
  后台线程 ``select()`` 阻塞等 NOTIFY → 解析 event_id → 唤醒全部
  asyncio 订阅者（``asyncio.Queue`` per 订阅，容量有界防慢消费者撑爆）。
- outbox 写入侧（pg_repo 两处 INSERT 后）在**同事务外**发
  ``SELECT pg_notify('ont_changes', '<event_id>')`` —— 事务提交后
  LISTEN 端才收到（PG NOTIFY 语义），保证消费者读到已提交事件。
- WS 端点改造：优先订阅 hub（毫秒级推）；hub 不可用（memory repo /
  PG 缺位）回退现有 1.5s 轮询 —— 双路径语义一致（sent 集合去重
  挡住两路重叠）。
"""

from __future__ import annotations

import asyncio
import json
import threading
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

NOTIFY_CHANNEL = "ont_changes"
QUEUE_MAX = 256


class NotifyHub:
    """PG LISTEN/NOTIFY → asyncio 队列扇出。线程安全（lock 保护订阅表）。"""

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._lock = threading.Lock()
        self._subscribers: set[asyncio.Queue[str]] = set()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._started = False

    # ───── 生命周期 ─────

    def start(self) -> bool:
        """启动监听线程。返回 False = PG 不可连（调用方回退轮询）。"""
        if self._started:
            return True
        try:
            import psycopg2

            conn = psycopg2.connect(self._dsn, connect_timeout=3)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(f"LISTEN {NOTIFY_CHANNEL}")
            self._conn = conn
        except Exception as e:
            logger.info("notify_hub.pg_unavailable", error=str(e)[:120])
            return False
        self._started = True
        self._thread = threading.Thread(
            target=self._listen_loop, daemon=True, name="ont-notify-hub"
        )
        self._thread.start()
        logger.info("notify_hub.started", channel=NOTIFY_CHANNEL)
        return True

    def stop(self) -> None:
        self._stop.set()
        try:
            # select 超时 1s 让线程自然退出
            if self._thread is not None:
                self._thread.join(timeout=2)
        except Exception:
            pass
        try:
            self._conn.close()
        except Exception:
            pass
        self._started = False

    def _listen_loop(self) -> None:
        import select

        while not self._stop.is_set():
            try:
                r, _, _ = select.select([self._conn], [], [], 1.0)
                if not r:
                    continue
                self._conn.poll()
                while self._conn.notifies:
                    note = self._conn.notifies.pop(0)
                    self._fanout(getattr(note, "payload", "") or "")
            except Exception as e:
                if self._stop.is_set():
                    return
                logger.warning("notify_hub.listen_error", error=str(e)[:120])
                import time

                time.sleep(1.0)

    # ───── 订阅面 ─────

    def subscribe(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=QUEUE_MAX)
        with self._lock:
            self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        with self._lock:
            self._subscribers.discard(q)

    def _fanout(self, payload: str) -> None:
        """NOTIFY payload（event_id JSON）→ 全部订阅者。跨线程唤醒。"""
        with self._lock:
            subs = list(self._subscribers)
        loop = self._loop
        if loop is None or not subs:
            return
        for q in subs:

            def _put(q_ref: asyncio.Queue[str] = q) -> None:
                try:
                    q_ref.put_nowait(payload)
                except asyncio.QueueFull:
                    pass  # 慢消费者：丢帧（轮询兜底补齐）

            try:
                loop.call_soon_threadsafe(_put)
            except RuntimeError:
                pass  # loop 已关

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """FastAPI startup 时绑定主事件循环（跨线程唤醒目标）。"""
        self._loop = loop


def parse_event_id(payload: str) -> str:
    """NOTIFY payload → event_id（裸字符串或 {"event_id": ...} JSON）。"""
    if not payload:
        return ""
    if payload.startswith("{"):
        try:
            return str(json.loads(payload).get("event_id") or "")
        except Exception:
            return ""
    return payload


def hub_for(app_state: Any, dsn: str | None = None) -> NotifyHub | None:
    """从 app.state 取（或惰性建）NotifyHub；PG 缺位返回 None。"""
    hub = getattr(app_state, "notify_hub", None)
    if hub is not None:
        return hub
    if not dsn:
        return None
    hub = NotifyHub(dsn)
    if not hub.start():
        return None
    app_state.notify_hub = hub
    return hub


def notify_outbox_event(dsn: str, event_id: str) -> None:
    """outbox 写入方调用（事务提交后）：pg_notify 唤醒监听端。

    独立短连接（重连安全）；失败静默 —— 轮询兜底。psycopg2 sync
    实现，在 PG repo 的同步代码路径中直接调用。
    """
    try:
        import psycopg2

        conn = psycopg2.connect(dsn, connect_timeout=2)
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_notify(%s, %s)", (NOTIFY_CHANNEL, event_id))
        finally:
            conn.close()
    except Exception:
        pass  # 静默：订阅端轮询兜底
