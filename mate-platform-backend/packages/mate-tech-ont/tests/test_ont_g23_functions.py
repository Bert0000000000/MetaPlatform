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
        rid=ClassRef(FN),
        language="python",
        version=version,
        source_ref="inline://x",
        signatures=(),
    )


def _repo() -> InMemoryOntologyRepository:
    r = InMemoryOntologyRepository()
    # ADR-0063 S2：显式登记 inline 源码（不再回落恒等函数）
    r.register_function_source(FN, "def handler(target, params):\n    return params\n")
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
        stub = FunctionStub(result="ok", error=RuntimeError("boom"), fail_first_n=1)
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


def _setup_g25(r, OBJ2, P2, ACT2, T2):
    from mate_kernel.ontology.types.action_type import ActionType
    from mate_kernel.ontology.types.object_type import ObjectType
    from mate_kernel.ontology.types.property_ import Property, PropertyFormat
    r.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ2),
            primary_key=(ClassRef(P2),),
            properties=(
                Property(
                    rid=ClassRef(P2),
                    type_id="string",
                    nullable=False,
                    primary_key=True,
                    title="id",
                    format=PropertyFormat.STRING,
                ),
            ),
            display_name="task",
        )
    )
    r.upsert_action_type(
        ActionType(
            rid=ClassRef(ACT2),
            parameters=(),
            submission_criteria=(),
            side_effects=("task.closed",),
            function_ref=ClassRef(f"ont.{T2}.fn.x.v1"),
            on=(ClassRef(OBJ2),),
            title="Close Task",
        )
    )


class TestWebSocketSubscription:
    def test_memory_edit_set_preserves_task_closed_side_effect(self):
        r=InMemoryOntologyRepository()
        tenant='g25-memory';obj=f'ont.{tenant}.obj.task';prop=f'ont.{tenant}.prop.id';action=f'ont.{tenant}.act.close'
        _setup_g25(r,obj,prop,action,tenant)
        r.set_outbox_writer(lambda *args:'evt-task-closed')
        r.apply_edit_set_now(action,None,{},[{'op':'create_object','class_rid':obj,'primary_key':'t1','props':{prop:'t1'}}],actor='ops-1')
        events=r.list_outbox_events('0',20)
        assert any(e['event_type']=='task.closed' for e in events)


    """G25：WS 订阅 —— edit-set 触发 outbox 事件推送到连接客户端。"""

    def test_ws_receives_outbox_event(self) -> None:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from mate_kernel.ontology.types.action_type import ActionType
        from mate_kernel.ontology.types.object_type import ObjectType
        from mate_kernel.ontology.types.property_ import Property, PropertyFormat

        import os,uuid
        from urllib.parse import urlparse
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
        dsn=os.environ.get('MP11_WS_PG_DSN','')
        if not dsn and os.environ.get('MP11_WS_PG_REQUIRED')!='1':
            import pytest
            pytest.skip('Explicit PG integration profile not configured; candidate requires MP11_WS_PG_REQUIRED=1')
        target=urlparse(dsn)
        if target.hostname!='127.0.0.1' or target.port!=55497 or not target.path.startswith('/codex_mp11_'):
            raise RuntimeError('G23 requires explicit owned MP11_WS_PG_DSN on127.0.0.1:55497')
        T2 = 'g25-'+uuid.uuid4().hex[:8]
        OBJ2 = f"ont.{T2}.obj.ops.task.v1"
        P2 = f"ont.{T2}.prop.tid.v1"
        ACT2 = f"ont.{T2}.act.ops.close-task.v1"
        r = PgOntologyRepository(dsn=dsn)
        r._ensure_schema()
        _setup_g25(r, OBJ2, P2, ACT2, T2)

        app = FastAPI()
        app.state.kernel_repo = r
        app.include_router(__import__("mate_tech_ont.v2_kernel.api", fromlist=["router"]).router)
        client = TestClient(app)
        import json,time,jwt
        from cryptography.hazmat.primitives.asymmetric import rsa
        from mate_platform.auth.config import AuthConfig
        from mate_platform.auth.middleware import install_auth
        class SignedFixture:
            def __repr__(self):return '<LocalRSAWebSocketFixture>'
            def __init__(self):self.key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
            def headers(self):
                now=int(time.time())
                claims={'sub':'reader','azp':'web','sid':'fixture','preferred_username':'reader','tenant_id':T2,'iss':config.issuer,'aud':config.audience,'iat':now,'exp':now+60,'scope':'platform.read ont.read'}
                return {'Authorization':'Bearer '+jwt.encode(claims,self.key,algorithm='RS256',headers={'kid':'fixture'})}
        fixture=SignedFixture()
        config=AuthConfig('https://issuer.invalid','mp11','backend','backend','fixture-only',300,5,0,False,False)
        verifier=install_auth(app,config=config)
        verifier._cache._by_kid={'fixture':json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(fixture.key.public_key()))}
        with client.websocket_connect('/api/v1/ont/v2/ws/object-changes',headers=fixture.headers()) as ws:
            hello = ws.receive_json()
            assert hello["type"] == "subscribed"
            # Real PG producer commits edit-set, audit and outbox under the signed tenant.
            with r.tenant_scope(T2):
                r.apply_edit_set_now(
                    ACT2,
                    None,
                    {},
                    [
                        {
                            "op": "create_object",
                            "class_rid": OBJ2,
                            "primary_key": "t1",
                            "props": {P2: "t1"},
                        }
                    ],
                    actor="ops-1",
                    impact_summary="",
                )
            # Bound receive independently of the 60-second JWT lifetime.
            import queue,threading
            received=queue.Queue()
            def receive():
                try:received.put(ws.receive_json())
                except Exception:received.put(None)
            threading.Thread(target=receive,daemon=True).start()
            try:got=received.get(timeout=6)
            finally:
                hub=getattr(app.state,'notify_hub',None)
                if hub:hub.stop()
            assert got is not None
            assert got['event_type']=='edit_set.applied'
            assert got['payload']['action_rid']==ACT2
            assert got['payload']['applied_count']==1
            with r.tenant_scope(T2):
                events=r.list_outbox_events('0',20)
            assert any(e['event_id']==got['event_id'] and e['event_type']=='edit_set.applied' and e['payload']==got['payload'] for e in events)
