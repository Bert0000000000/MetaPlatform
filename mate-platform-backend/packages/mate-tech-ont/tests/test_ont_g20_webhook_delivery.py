"""G20 —— webhook 投递：HMAC 签名 / 重试 / 投递审计 / 幂等跳过。

用线程内 http.server 收请求验证：签名可复验、事件体正确、失败订阅记
attempts/last_error、已投递事件重跑跳过。
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.ontology.identity.class_ref import ClassRef  # noqa: E402
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository  # noqa: E402
from mate_kernel.ontology.types.action_type import ActionType  # noqa: E402
from mate_kernel.ontology.types.object_type import ObjectType  # noqa: E402
from mate_kernel.ontology.types.property_ import Property, PropertyFormat  # noqa: E402

T = "g20"
OBJ = f"ont.{T}.obj.ops.alert.v1"
P_ID = f"ont.{T}.prop.aid.v1"
ACT = f"ont.{T}.act.ops.raise-alert.v1"


def _mk_repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(ObjectType(
        rid=ClassRef(OBJ), primary_key=(ClassRef(P_ID),),
        properties=(Property(rid=ClassRef(P_ID), type_id="string",
                             nullable=False, primary_key=True,
                             title="id", format=PropertyFormat.STRING),),
        display_name="alert",
    ))
    r.upsert_action_type(ActionType(
        rid=ClassRef(ACT), parameters=(), submission_criteria=(),
        side_effects=("notify.ops",),  # outbox 事件类型
        function_ref=ClassRef(f"ont.{T}.fn.x.v1"),
        on=(ClassRef(OBJ),), title="Raise Alert",
    ))
    return r


class _Collector(BaseHTTPRequestHandler):
    received: list[dict] = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        _Collector.received.append({
            "body": json.loads(body),
            "signature": self.headers.get("X-Mate-Signature", ""),
            "event": self.headers.get("X-Mate-Event", ""),
            "event_id": self.headers.get("X-Mate-Event-Id", ""),
            "raw": body,
        })
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):  # 静默
        pass


class TestWebhookDelivery:
    def test_sign_deliver_retry_idempotent(self) -> None:
        from mate_tech_ont.v2_kernel.webhook_delivery import (
            deliver_pending,
            sign_payload,
        )

        server = HTTPServer(("127.0.0.1", 0), _Collector)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            r = _mk_repo()
            secret = "s3cret"
            # 1) 订阅（事件类型精确匹配 + 一个死地址订阅验证重试）
            r.upsert_webhook_subscription({
                "event_type": "notify.ops", "url": f"http://127.0.0.1:{port}/hook",
                "secret": secret, "tenant_id": T})
            r.upsert_webhook_subscription({
                "event_type": "notify.ops", "url": "http://127.0.0.1:1/dead",
                "secret": "", "tenant_id": T})
            # 2) 触发事件（edit-set 执行 → side_effect outbox 镜像）
            r.set_outbox_writer(lambda et, tid, payload: f"evt-{et}")
            r.apply_edit_set_now(
                ACT, None, {},
                [{"op": "create_object", "class_rid": OBJ,
                  "primary_key": "a1", "props": {P_ID: "a1"}}],
                actor="ops-1", impact_summary="",
            )
            assert len(r._outbox_events) >= 1
            # 3) 签名单元
            sig = sign_payload(secret, b'{"a":1}')
            assert sig.startswith("sha256=")
            expect = "sha256=" + hmac.new(secret.encode(), b'{"a":1}',
                                          hashlib.sha256).hexdigest()
            assert hmac.compare_digest(sig, expect)
            # 4) 投递
            stats = deliver_pending(r)
            assert stats["delivered"] == 1
            assert stats["failed"] == 1  # 死地址重试后失败
            assert len(_Collector.received) == 1
            got = _Collector.received[0]
            assert got["event"] == "notify.ops"
            body_sig = "sha256=" + hmac.new(
                secret.encode(), got["raw"], hashlib.sha256).hexdigest()
            assert hmac.compare_digest(got["signature"], body_sig)
            assert got["body"]["payload"]["action_rid"] == ACT
            # 失败订阅的审计（attempts=3, last_error 非空）
            fails = [d for d in r._webhook_deliveries
                     if d["status"] == "failed"]
            assert fails and fails[0]["attempts"] == 4 and fails[0]["last_error"]  # 1 次 + 3 重试
            # 5) 幂等：重跑 → 成功过的跳过
            stats2 = deliver_pending(r)
            assert stats2["delivered"] == 0
            assert stats2["skipped"] >= 1
        finally:
            server.shutdown()
