"""copilot → ontology kernel 桥接测试（三大原理 #3）。

覆盖 /actions/execute 与 /actions/{id}/execute：
- 映射 action（act-approve-leave / act-close-ticket）经 kernel apply 落库，
  output 回显 applied_at + side_effects_emitted + action_rid
- 前端 camelCase ``actionId`` 与后端 snake_case ``action_id`` 均被接受
- kernel 调用失败 / 未映射 action → 降级 emit-only（status=completed，无 kernel 字段）
- 仍发 copilot.action.executed outbox 事件
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from mate_app_copilot.clients.base import AsyncCopilotClient

KERNEL_RESPONSE: dict[str, Any] = {
    "action_rid": "ont.tenant-acme.act.approve-leave.v1",
    "applied_at": "2026-08-07T10:00:00+00:00",
    "audit_id": "audit-123",
    "side_effects_emitted": ["notify_email", "audit_log"],
}


class _FakeClient(AsyncCopilotClient):
    """覆盖 ont_apply_action 的假 client；其余方法复用 stub provider。"""

    def __init__(self, *, fail: bool = False, calls: list[tuple] | None = None):
        super().__init__(
            base_url="http://gateway.test:8100",
            auth=_dummy_auth(),
            provider=__import__("mate_app_copilot.llm.stub_provider", fromlist=["x"]),
        )
        self._fail = fail
        self._calls: list[tuple] = calls if calls is not None else []

    async def ont_apply_action(self, rid, tenant_id, parameters=None,
                               target_iid="", provenance=None,
                               fallback_token=None) -> dict[str, Any]:
        self._calls.append((rid, tenant_id, parameters, target_iid, fallback_token))
        if self._fail:
            raise RuntimeError("kernel unavailable")
        return dict(KERNEL_RESPONSE, action_rid=rid)


def _dummy_auth():
    from mate_clients.security.bearer import BearerAuth
    return BearerAuth(
        token_uri="http://localhost:8080/realms/metaplatform/protocol/openid-connect/token",
        client_id="metaplatform-backend",
        client_secret="stub",
        scope="platform.read platform.write",
    )


@pytest.fixture
def client(outbox) -> TestClient:
    from mate_app_copilot.main import create_app
    from mate_app_copilot.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()
    app = create_app()
    app.state.outbox_writer = outbox
    app.state.copilot_client = _FakeClient()
    yield TestClient(app)
    in_memory_repo.reset_store()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    import time
    import jwt as pyjwt

    now = int(time.time())
    token = pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "alice",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": ["tenant-acme"]},
            "tenant_id": "tenant-acme",
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        "test-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


class TestOntBridgeExecuteByBody:
    def test_action_id_snake_case_bridges_to_kernel(self, client, auth_headers):
        """后端原有 snake_case action_id → 走 kernel 落库 + 回显。"""
        c = client
        r = c.post(
            "/api/v1/copilot/actions/execute",
            json={"action_id": "act-approve-leave", "params": {"decision": "approve"}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "completed"
        assert body["action_id"] == "act-approve-leave"
        out = body["output"]
        assert out["side_effects_emitted"] == ["notify_email", "audit_log"]
        assert out["applied_at"] == KERNEL_RESPONSE["applied_at"]
        assert out["action_rid"] == "ont.tenant-acme.act.approve-leave.v1"
        # 桥接调用确实发生了
        fake = app_client(client)
        assert fake._calls, "ont_apply_action 未被调用"
        rid, tid, params, target, _ft = fake._calls[0]
        assert rid == "ont.tenant-acme.act.approve-leave.v1"
        assert tid == "tenant-acme"
        assert params == {"decision": "approve"}
        # 入站 user token 被透传（dev fallback 认证路径）
        assert _ft

    def test_actionId_camel_case_accepted(self, client, auth_headers):
        """前端 SuperAI 面板发 camelCase actionId → 修复后不再 404。"""
        r = client.post(
            "/api/v1/copilot/actions/execute",
            json={"actionId": "act-close-ticket", "params": {"resolution": "fixed"}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["action_id"] == "act-close-ticket"
        assert body["output"]["side_effects_emitted"] == ["notify_email", "audit_log"]
        fake = app_client(client)
        assert fake._calls[0][0] == "ont.tenant-acme.act.close-ticket.v1"

    def test_kernel_failure_falls_back_to_emit_only(self, outbox):
        """kernel 不可用 → 仍 completed（emit-only 降级），不发 kernel 字段。"""
        from mate_app_copilot.main import create_app
        from mate_app_copilot.repositories import in_memory as in_memory_repo

        in_memory_repo.reset_store()
        app = create_app()
        app.state.outbox_writer = outbox
        app.state.copilot_client = _FakeClient(fail=True)
        with TestClient(app) as c:
            r = c.post(
                "/api/v1/copilot/actions/execute",
                json={"action_id": "act-approve-leave", "params": {"decision": "approve"}},
                headers=_acme_headers(),
            )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "completed"
        assert "side_effects_emitted" not in body["output"]
        assert "applied_at" not in body["output"]
        assert "action_rid" not in body["output"]
        # outbox 事件仍发出
        events = [r.event for r in outbox.all_records()]
        assert any(e.type == "copilot.action.executed" for e in events)
        in_memory_repo.reset_store()

    def test_unmapped_action_stays_emit_only(self, client, auth_headers):
        """未映射 action（act-send-email）→ 不触碰 kernel，纯 emit-only。"""
        r = client.post(
            "/api/v1/copilot/actions/execute",
            json={"action_id": "act-send-email", "params": {"to": "a@b.c"}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        assert "applied_at" not in r.json()["output"]
        assert app_client(client)._calls == []

    def test_unknown_action_404(self, client, auth_headers):
        r = client.post(
            "/api/v1/copilot/actions/execute",
            json={"action_id": "act-nope"},
            headers=auth_headers,
        )
        assert r.status_code == 404


class TestOntBridgeExecutePath:
    def test_path_variant_bridges_to_kernel(self, client, auth_headers):
        r = client.post(
            "/api/v1/copilot/actions/act-approve-leave/execute",
            json={"params": {"decision": "approve", "target_iid": "ont.x.ind.1"}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["output"]["side_effects_emitted"] == ["notify_email", "audit_log"]
        fake = app_client(client)
        rid, _tid, params, target, _ft = fake._calls[0]
        # target_iid 从 params 弹出并单独传递
        assert target == "ont.x.ind.1"
        assert "target_iid" not in params

    def test_path_variant_unknown_404(self, client, auth_headers):
        r = client.post(
            "/api/v1/copilot/actions/act-nope/execute",
            json={"params": {}},
            headers=auth_headers,
        )
        assert r.status_code == 404


def app_client(client: TestClient) -> _FakeClient:
    return client.app.state.copilot_client  # type: ignore[no-any-return]


def _acme_headers() -> dict[str, str]:
    import time
    import jwt as pyjwt

    now = int(time.time())
    token = pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "alice",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": ["tenant-acme"]},
            "tenant_id": "tenant-acme",
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        "test-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}
