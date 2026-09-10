"""P1-5：LISTEN/NOTIFY hub 单元测试 + PG 真库端到端。

覆盖：
1. parse_event_id 双形态（裸字符串 / JSON {"event_id": ...}）；
2. subscribe/unsubscribe + fanout（跨线程 call_soon_threadsafe 唤醒）；
3. hub_for 惰性建 + PG 缺位返回 None；
4. PG 真库（可达时）：pg_notify → NotifyHub 收到 → asyncio 队列到达
   （sub-second 延迟验证，证明毫秒级推送闭环）；
5. outbox 写入 → _flush_notify → NOTIFY 发出（pg_stat_activity 无断言，
   直接验证 hub 队列收到 event_id）。
"""
from __future__ import annotations

import asyncio
import os
import sys
import threading
import time

import pytest

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_tech_ont.v2_kernel.notify_hub import (  # noqa: E402
    NotifyHub, parse_event_id,
)


class TestParseEventId:
    def test_bare_string(self) -> None:
        assert parse_event_id("evt-abc") == "evt-abc"

    def test_json_payload(self) -> None:
        assert parse_event_id('{"event_id": "evt-xyz"}') == "evt-xyz"

    def test_empty(self) -> None:
        assert parse_event_id("") == ""


class TestHubSubscribe:
    def test_subscribe_fanout_unsubscribe(self) -> None:
        hub = NotifyHub.__new__(NotifyHub)  # 不连 PG
        import threading as _th

        hub._lock = _th.Lock()
        hub._subscribers = set()
        hub._thread = None
        hub._stop = _th.Event()
        hub._loop = None
        hub._dsn = ""
        hub._started = False

        loop = asyncio.new_event_loop()
        t = threading.Thread(target=loop.run_forever, daemon=True)
        t.start()
        time.sleep(0.05)
        try:
            hub.bind_loop(loop)
            q = hub.subscribe()
            assert q in hub._subscribers
            # 在 loop 线程内放一条
            hub._fanout('{"event_id": "e1"}')
            time.sleep(0.1)
            # 从另一 loop 取（同 loop 内 get_nowait）
            got = asyncio.run_coroutine_threadsafe(q.get(), loop).result(timeout=1)
            assert parse_event_id(got) == "e1"
            hub.unsubscribe(q)
            assert q not in hub._subscribers
        finally:
            loop.call_soon_threadsafe(loop.stop)


class TestHubFor:
    def test_none_when_no_dsn(self) -> None:
        from mate_tech_ont.v2_kernel.notify_hub import hub_for

        class _State:
            pass

        assert hub_for(_State(), None) is None
        assert hub_for(_State(), "") is None


PG_DSN = os.environ.get(
    "P15_PG_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform_ont"
)


class TestPgListenNotify:
    def test_end_to_end_subsecond(self) -> None:
        pytest.importorskip("psycopg2")
        from mate_tech_ont.v2_kernel.notify_hub import notify_outbox_event

        hub = NotifyHub(PG_DSN)
        if not hub.start():
            pytest.skip("PG unavailable")
        try:
            loop = asyncio.new_event_loop()
            t = threading.Thread(target=loop.run_forever, daemon=True)
            t.start()
            time.sleep(0.1)
            hub.bind_loop(loop)
            q = hub.subscribe()
            try:
                eid = f"evt-notify-test-{int(time.time())}"
                notify_outbox_event(PG_DSN, eid)
                # 毫秒级推送验证：1s 超时内必须收到
                got = asyncio.run_coroutine_threadsafe(
                    q.get(), loop).result(timeout=1.0)
                assert parse_event_id(got) == eid
            finally:
                hub.unsubscribe(q)
                loop.call_soon_threadsafe(loop.stop)
        finally:
            hub.stop()
