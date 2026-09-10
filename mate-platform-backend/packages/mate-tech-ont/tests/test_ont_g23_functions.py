"""G23 —— Function 工程化：版本快照 / 别名 / FunctionStub / invoke。"""
from __future__ import annotations

import os
import sys

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from mate_kernel.action.stubs import FunctionStub
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.reasoning.function import Function

T = "g23"
FN = f"ont.{T}.fn.approve.v1"


def _fn(version: int = 1) -> Function:
    return Function(
        rid=ClassRef(FN), language="python", version=version,
        source_ref="inline://x", signatures=(),
    )


def _repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    r.upsert_function(_fn(1))
    return r


class TestVersionSnapshots:
    def test_overwrite_snapshots_old(self) -> None:
        r = _repo()
        r.upsert_function(_fn(2))
        versions = r.list_function_versions(FN)
        assert versions and versions[0]["version"] == 1
        assert r._functions[ClassRef(FN)].version == 2


class TestAlias:
    def test_register_and_resolve(self) -> None:
        r = _repo()
        r.register_function_alias("approve-current", FN)
        assert r.resolve_function_alias("approve-current") == FN

    def test_unknown_alias(self) -> None:
        r = _repo()
        try:
            r.resolve_function_alias("ghost")
            raised = False
        except KeyError:
            raised = True
        assert raised


class TestStubAndInvoke:
    def test_stub_records_and_returns(self) -> None:
        stub = FunctionStub(result={"decision": "approved"})
        r = _repo()
        r._action_service.register_function(FN, stub)
        out = r.invoke_function(FN, {"amount": 42})
        assert out["result"] == {"decision": "approved"}
        assert stub.calls == [(None, {"amount": 42})]

    def test_stub_fail_first_n(self) -> None:
        stub = FunctionStub(result="ok", error=RuntimeError("boom"),
                            fail_first_n=1)
        r = _repo()
        r._action_service.register_function(FN, stub)
        try:
            r.invoke_function(FN, {})
            first_failed = False
        except RuntimeError:
            first_failed = True
        assert first_failed
        assert r.invoke_function(FN, {})["result"] == "ok"

    def test_invoke_unregistered(self) -> None:
        r = _repo()
        try:
            r.invoke_function(f"ont.{T}.fn.ghost.v1", {})
            raised = False
        except KeyError:
            raised = True
        assert raised


class TestWebSocketSubscription:
    """G25：WS 订阅 —— edit-set 触发 outbox 事件推送到连接客户端。"""

    def test_ws_receives_outbox_event(self) -> None:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from mate_kernel.ontology.types.action_type import ActionType
        from mate_kernel.ontology.types.object_type import ObjectType
        from mate_kernel.ontology.types.property_ import Property, PropertyFormat

        T2 = "g25"
        OBJ2 = f"ont.{T2}.obj.ops.task.v1"
        P2 = f"ont.{T2}.prop.tid.v1"
        ACT2 = f"ont.{T2}.act.ops.close-task.v1"
        r = InMemoryOntologyRepository()
        r.upsert_object_type(ObjectType(
            rid=ClassRef(OBJ2), primary_key=(ClassRef(P2),),
            properties=(Property(rid=ClassRef(P2), type_id="string",
                                 nullable=False, primary_key=True,
                                 title="id", format=PropertyFormat.STRING),),
            display_name="task"))
        r.upsert_action_type(ActionType(
            rid=ClassRef(ACT2), parameters=(), submission_criteria=(),
            side_effects=("task.closed",),
            function_ref=ClassRef(f"ont.{T2}.fn.x.v1"),
            on=(ClassRef(OBJ2),), title="Close Task"))
        r.set_outbox_writer(lambda et, tid, payload: f"evt-{et}-{tid}")

        app = FastAPI()
        app.state.kernel_repo = r
        app.include_router(__import__(
            "mate_tech_ont.v2_kernel.api", fromlist=["router"]).router)
        client = TestClient(app)
        with client.websocket_connect("/api/v1/ont/v2/ws/object-changes") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "subscribed"
            # 触发事件（同线程 —— InMemory 同步执行）
            r.apply_edit_set_now(
                ACT2, None, {},
                [{"op": "create_object", "class_rid": OBJ2,
                  "primary_key": "t1", "props": {P2: "t1"}}],
                actor="ops-1", impact_summary="",
            )
            import time

            got = None
            deadline = time.time() + 6
            while time.time() < deadline and got is None:
                # TestClient receive 阻塞 —— 用线程触发已发生，直接收
                try:
                    msg = ws.receive_json()
                    if msg.get("event_type") == "task.closed":
                        got = msg
                        break
                except Exception:
                    break
            assert got is not None
            assert got["event_type"] == "task.closed"
