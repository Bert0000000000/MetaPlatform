"""ONT-PROV-01：copilot AI 工具提案自动溯源（propose×3 注入 provenance）。

口径（见 ``ontology_http_repo._ai_provenance``）：
- ``source="ai"`` 恒有——人工路径（/actions/execute 前端面板）不经过这些
  AI 工具，天然区分；
- ``model`` 仅请求上下文可得时携带（chat stream 已解析生效模型名）；
- ``agent_id`` / ``employee`` 仅上下文有数字员工标识时携带；
- ``confidence`` 仅上游真的产生置信度数值时携带——缺失一律省键，不编造；
- 调用方显式传入的 provenance 键冲突时显式值优先（merge 不覆盖）。

HTTP 断言用 ``httpx.MockTransport`` 捕获 propose 请求体；端点接线断言用
假 repo 记录 ``ai_provenance`` 构造参数（模式对齐 test_agent_stream_persistence）。
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

from mate_app_copilot.ontology_http_repo import (
    OntologyHttpRepo,
    _ai_provenance,
)


def _proposal_response() -> dict[str, Any]:
    """ont v2 propose 端点的最小合法响应（_proposal_ns 容忍缺键）。"""
    return {
        "proposal_id": "prop-test-1",
        "action_rid": "ont.tenant-acme.act.demo.v1",
        "status": "pending",
        "kind": "action",
        "impact_summary": "s",
    }


class _CapturingTransport(httpx.MockTransport):
    """记录每次请求的 (method, path, json) —— 断言请求体用。"""

    def __init__(self, action_type: dict[str, Any] | None = None) -> None:
        self.calls: list[tuple[str, str, dict[str, Any]]] = []
        self._action_type = action_type
        super().__init__(self._handle)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        try:
            payload: dict[str, Any] = dict(json.loads(request.content) or {})
        except Exception:
            payload = {}
        self.calls.append((request.method, path, payload))
        if request.method == "GET" and "/action-types/" in path:
            return httpx.Response(200, json=self._action_type or {})
        return httpx.Response(200, json=_proposal_response())


def _repo(
    transport: _CapturingTransport,
    ai_provenance: dict[str, Any] | None = None,
) -> OntologyHttpRepo:
    return OntologyHttpRepo(
        base_url="http://ont.test",
        ai_provenance=ai_provenance,
        transport=transport,
    )


class TestAiProvenanceHelper:
    def test_injects_source_and_available_context(self) -> None:
        prov = _ai_provenance(
            model="glm-5.3-flash",
            agent_id="agent-ont",
            employee="emp-dw-01",
            confidence=0.87,
        )
        assert prov == {
            "source": "ai",
            "model": "glm-5.3-flash",
            "agent_id": "agent-ont",
            "employee": "emp-dw-01",
            "confidence": 0.87,
        }

    def test_missing_context_omits_keys_no_confidence(self) -> None:
        prov = _ai_provenance()
        assert prov == {"source": "ai"}
        # 模型名拿不到就省键，不硬编码假值；无置信度不带 confidence 键
        assert "model" not in _ai_provenance(model=None)
        assert "confidence" not in _ai_provenance()
        assert "agent_id" not in _ai_provenance(agent_id="")
        assert "employee" not in _ai_provenance(employee="")

    def test_explicit_provenance_wins_merge_not_overwrite(self) -> None:
        prov = _ai_provenance(
            model="auto-model",
            agent_id="auto-agent",
            explicit={"source": "user", "model": "explicit-model", "note": "keep"},
        )
        # 显式键不被覆盖；自动键只补缺
        assert prov == {
            "source": "user",
            "model": "explicit-model",
            "agent_id": "auto-agent",
            "note": "keep",
        }


class TestProposePayloadsCarryProvenance:
    def test_propose_instance_request_body_contains_provenance(self) -> None:
        transport = _CapturingTransport()
        repo = _repo(
            transport,
            ai_provenance={"model": "doubao-pro-32k", "agent_id": "agent-ont"},
        )
        repo.propose_create_instance(
            "ont.tenant-acme.obj.order.v1",
            {"order-id": "o1"},
            "新建订单",
        )
        post = next(c for c in transport.calls if c[0] == "POST")
        assert post[1].endswith("/classes/ont.tenant-acme.obj.order.v1/propose-instance")
        assert post[2]["provenance"] == {
            "source": "ai",
            "model": "doubao-pro-32k",
            "agent_id": "agent-ont",
        }

    def test_propose_instance_without_confidence_omits_key(self) -> None:
        transport = _CapturingTransport()
        repo = _repo(transport, ai_provenance={"model": "m"})
        repo.propose_create_instance("ont.tenant-acme.obj.order.v1", {}, "s")
        post = next(c for c in transport.calls if c[0] == "POST")
        prov = post[2]["provenance"]
        assert prov == {"source": "ai", "model": "m"}
        assert "confidence" not in prov  # 上游无置信度数值——不许编造

    def test_propose_action_legacy_branch_carries_provenance(self) -> None:
        transport = _CapturingTransport(action_type={})  # 无 declarative_edits
        repo = _repo(transport, ai_provenance={"model": "m"})
        repo.propose_action(
            "ont.tenant-acme.act.close-ticket.v1",
            {"resolution": "fixed"},
            None,
            "close ticket",
        )
        posts = [c for c in transport.calls if c[0] == "POST"]
        assert len(posts) == 1
        assert posts[0][1].endswith("/action-types/ont.tenant-acme.act.close-ticket.v1/propose")
        assert posts[0][2]["provenance"] == {"source": "ai", "model": "m"}

    def test_propose_action_edit_set_branch_carries_provenance(self) -> None:
        transport = _CapturingTransport(
            action_type={"declarative_edits": [{"op": "set", "field": "status"}]}
        )
        repo = _repo(transport, ai_provenance={"model": "m"})
        repo.propose_action("ont.tenant-acme.act.approve-leave.v1", {}, None, "approve")
        posts = [c for c in transport.calls if c[0] == "POST"]
        assert len(posts) == 1
        assert posts[0][1].endswith(
            "/action-types/ont.tenant-acme.act.approve-leave.v1/propose-edit-set"
        )
        assert posts[0][2]["provenance"] == {"source": "ai", "model": "m"}

    def test_propose_model_type_carries_provenance(self) -> None:
        transport = _CapturingTransport()
        repo = _repo(transport, ai_provenance={"model": "m"})
        repo.propose_model_type({"rid": "ont.tenant-acme.obj.asset.v1"}, "建模")
        post = next(c for c in transport.calls if c[0] == "POST")
        assert post[1].endswith("/object-types/propose")
        assert post[2]["provenance"] == {"source": "ai", "model": "m"}

    def test_explicit_provenance_not_overwritten_by_auto_context(self) -> None:
        transport = _CapturingTransport()
        repo = _repo(transport, ai_provenance={"model": "auto-model"})
        repo.propose_create_instance(
            "ont.tenant-acme.obj.order.v1",
            {},
            "s",
            provenance={"source": "user", "model": "explicit-model"},
        )
        post = next(c for c in transport.calls if c[0] == "POST")
        assert post[2]["provenance"] == {
            "source": "user",
            "model": "explicit-model",
        }

    def test_no_context_still_marks_source_ai(self) -> None:
        transport = _CapturingTransport()
        repo = _repo(transport)  # 未传任何溯源上下文
        repo.propose_create_instance("ont.tenant-acme.obj.order.v1", {}, "s")
        post = next(c for c in transport.calls if c[0] == "POST")
        assert post[2]["provenance"] == {"source": "ai"}


class _RecordingOntoRepo:
    """替身 OntologyHttpRepo：记录 ai_provenance 构造参数，其余面返回空。"""

    constructed: list[dict[str, Any]] = []

    def __init__(
        self,
        headers: dict[str, str] | None = None,
        base_url: str | None = None,
        timeout: float = 20.0,
        *,
        ai_provenance: dict[str, Any] | None = None,
        transport: Any = None,
    ) -> None:
        self.kwargs: dict[str, Any] = {"headers": headers, "ai_provenance": ai_provenance}
        _RecordingOntoRepo.constructed.append(self.kwargs)

    def list_object_types(self, limit: int = 10000, offset: int = 0) -> list[Any]:
        return []

    def list_link_instances(self) -> list[Any]:
        return []

    def search_objects(
        self,
        text: str,
        class_rid: str | None = None,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        return []


class _StubOrchestratorClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.auth = kwargs.get("auth")

    async def authorized_role_snapshot(
        self,
        *,
        tenant_id: str,
        fallback_token: str | None = None,
    ) -> dict[str, Any]:
        return {
            "items": [
                {"role": "workflow", "name": "Workflow", "capabilities": []},
            ],
            "capability_version": "snapshot-v1",
            "actor_roles_digest": "actor-roles-v1",
        }


async def _fake_run_agent_loop(**_: Any) -> AsyncIterator[dict[str, Any]]:
    yield {"type": "final", "content": "done"}


class TestChatStreamWiring:
    def test_agent_stream_passes_effective_model_into_repo(
        self,
        client: Any,
        auth_headers_acme: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """POST /chat/agent/stream → OntologyHttpRepo 构造带 ai_provenance(model)。"""
        import mate_app_copilot.ontology_http_repo as repo_module
        from mate_app_copilot.api import app as copilot_app_module

        _RecordingOntoRepo.constructed = []
        monkeypatch.setattr(repo_module, "OntologyHttpRepo", _RecordingOntoRepo)
        monkeypatch.setattr(copilot_app_module, "OrchestratorClient", _StubOrchestratorClient)
        monkeypatch.setattr(copilot_app_module, "run_agent_loop", _fake_run_agent_loop)

        resp = client.post(
            "/api/v1/copilot/chat/agent/stream",
            json={
                "messages": [{"role": "user", "content": "帮我新建一个订单对象"}],
                "model": "glm-5.3-flash",
            },
            headers=auth_headers_acme,
        )
        assert resp.status_code == 200, resp.text
        assert "data: [DONE]" in resp.text
        assert _RecordingOntoRepo.constructed, "OntologyHttpRepo 未被构造"
        prov = _RecordingOntoRepo.constructed[-1]["ai_provenance"]
        assert prov == {"model": "glm-5.3-flash"}
