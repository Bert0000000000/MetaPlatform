"""G44 Scenario 租户隔离 —— 双租户覆盖全部 Scenario 操作 + 生产禁用边界。

本批（Scenario 隔离）先落地失败用例，再修实现。旧代码上本文件应大面积红：

- ``_SCENARIOS`` 是进程内 dict，所有操作仅按 ``sid`` 查找，**不校验资源归属**；
- ``list_scenarios`` 返回**全部租户**的会话（跨租户泄露 title/edits）；
- view / append-edit / merge / discard 对他人 ``sid`` 照常成功。

验收点：
1. ``list`` 只返回当前认证租户的 Scenario；
2. ``view`` / ``append-edit`` / ``merge`` / ``discard`` 对**他人** ``sid`` 一律 404
   （不泄露存在性，也不产生副作用）；
3. 生产 profile 默认禁用 Scenario（内存态不支持多副本），显式 opt-in 才放行；
4. 创建响应显式标注实验态（不把内存状态冒充正式草稿）。
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

_K = os.path.join(os.path.dirname(__file__), "..", "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "..", "src")
for _p in (_K, _O):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import mate_tech_ont.v2_kernel.api as ont_api
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

BASE = "/api/v1/ont/v2"
T_A = "acme"
T_B = "globex"
OBJ = f"ont.{T_A}.obj.crm.deal.v1"
P_ID = f"ont.{T_A}.prop.deal-id.v1"
P_STAGE = f"ont.{T_A}.prop.stage.v1"
ACT = f"ont.{T_A}.act.crm.advance-deal.v1"
DEAL = f"ont.{T_A}.ind.deal.dd1"


def _seed(repo: InMemoryOntologyRepository) -> None:
    repo.upsert_object_type(
        ObjectType(
            rid=ClassRef(OBJ),
            primary_key=(ClassRef(P_ID),),
            properties=(
                Property(
                    rid=ClassRef(P_ID),
                    type_id="string",
                    nullable=False,
                    primary_key=True,
                    title="id",
                    format=PropertyFormat.STRING,
                ),
                Property(
                    rid=ClassRef(P_STAGE),
                    type_id="string",
                    nullable=True,
                    primary_key=False,
                    title="stage",
                    format=PropertyFormat.STRING,
                ),
            ),
            display_name="deal",
        )
    )
    repo.upsert_action_type(
        ActionType(
            rid=ClassRef(ACT),
            parameters=(),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(f"ont.{T_A}.fn.x.v1"),
            on=(ClassRef(OBJ),),
            title="Advance Deal",
            declarative_edits=(
                {
                    "op": "set_property",
                    "target": "$target",
                    "property_rid": P_STAGE,
                    "value": "$param.stage",
                },
            ),
        )
    )
    repo.create_individual(
        Individual(
            rid=DEAL,
            class_rid=ClassRef(OBJ),
            props=((ClassRef(P_ID), "dd1"), (ClassRef(P_STAGE), "open")),
            primary_key="dd1",
            tenant_id=T_A,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )


@pytest.fixture()
def repo() -> InMemoryOntologyRepository:
    return InMemoryOntologyRepository()


@pytest.fixture()
def client(repo: InMemoryOntologyRepository) -> TestClient:
    _seed(repo)
    ont_api._SCENARIOS.clear()
    app = FastAPI()

    @app.middleware("http")
    async def _fake_auth(request, call_next):
        from mate_platform.tenancy.context import (
            AuthMethod,
            RequestContext,
            TenantId,
            UserId,
        )

        tenant = request.headers.get("X-Test-Tenant", T_A)
        request.state.ctx = RequestContext(
            request_id="scn-iso-req",
            trace_id="scn-iso-trace",
            tenant_id=TenantId(tenant),
            user_id=UserId(f"user-{tenant}"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset(),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    app.state.kernel_repo = repo
    app.include_router(ont_api.router)
    return TestClient(app)


def _as(client: TestClient, tenant: str) -> dict[str, str]:
    return {"X-Test-Tenant": tenant}


def _new_scenario(client: TestClient, tenant: str, title: str = "Q4 试算") -> str:
    r = client.post(f"{BASE}/scenarios", json={"title": title}, headers=_as(client, tenant))
    assert r.status_code == 200, r.text
    return r.json()["scenario_id"]


def _add_deal_edit(client: TestClient, tenant: str, sid: str) -> None:
    r = client.post(
        f"{BASE}/scenarios/{sid}/edits",
        json={
            "op": "set_property",
            "target": DEAL,
            "property_rid": P_STAGE,
            "value": "won",
        },
        headers=_as(client, tenant),
    )
    assert r.status_code == 200, r.text


class TestScenarioTenantIsolation:
    def test_list_scoped_to_authenticated_tenant(self, client: TestClient) -> None:
        sid_a = _new_scenario(client, T_A, "A 的会话")
        sid_b = _new_scenario(client, T_B, "B 的会话")

        listed_a = client.get(f"{BASE}/scenarios", headers=_as(client, T_A)).json()
        ids_a = {row["scenario_id"] for row in listed_a}
        assert ids_a == {sid_a}, "租户 A 只应看到自己的 Scenario"

        listed_b = client.get(f"{BASE}/scenarios", headers=_as(client, T_B)).json()
        assert {row["scenario_id"] for row in listed_b} == {sid_b}

    def test_foreign_scenario_ops_are_hidden(self, client: TestClient) -> None:
        sid = _new_scenario(client, T_A)
        _add_deal_edit(client, T_A, sid)

        # B 对 A 的 sid：view / edit / merge / discard 全部 404（不泄露存在性）
        view = client.get(f"{BASE}/scenarios/{sid}/view", headers=_as(client, T_B))
        assert view.status_code == 404, view.text

        edit = client.post(
            f"{BASE}/scenarios/{sid}/edits",
            json={
                "op": "set_property",
                "target": DEAL,
                "property_rid": P_STAGE,
                "value": "lost",
            },
            headers=_as(client, T_B),
        )
        assert edit.status_code == 404, edit.text

        before = client.app.state.kernel_repo.get_individual(DEAL).get(ClassRef(P_STAGE))
        merge = client.post(
            f"{BASE}/scenarios/{sid}/merge",
            json={"action_rid": ACT, "actor": "intruder"},
            headers=_as(client, T_B),
        )
        assert merge.status_code == 404, merge.text
        after = client.app.state.kernel_repo.get_individual(DEAL).get(ClassRef(P_STAGE))
        assert after == before == "open", "他人 merge 不得产生任何业务写入"

        discard = client.delete(f"{BASE}/scenarios/{sid}", headers=_as(client, T_B))
        assert discard.status_code == 404, discard.text

        # A 的会话仍在（未被他人丢弃），且归 A 所有
        still = client.get(f"{BASE}/scenarios", headers=_as(client, T_A)).json()
        assert {row["scenario_id"] for row in still} == {sid}

    def test_owner_flow_still_works(self, client: TestClient) -> None:
        sid = _new_scenario(client, T_A)
        _add_deal_edit(client, T_A, sid)
        view = client.get(
            f"{BASE}/scenarios/{sid}/view",
            params={"class_rid": OBJ},
            headers=_as(client, T_A),
        )
        assert view.status_code == 200
        merge = client.post(
            f"{BASE}/scenarios/{sid}/merge",
            json={"action_rid": ACT, "actor": "ceo-1"},
            headers=_as(client, T_A),
        )
        assert merge.status_code == 200, merge.text
        assert client.app.state.kernel_repo.get_individual(DEAL).get(ClassRef(P_STAGE)) == "won"

    def test_create_marks_experimental_not_a_draft(self, client: TestClient) -> None:
        r = client.post(f"{BASE}/scenarios", json={"title": "x"}, headers=_as(client, T_A))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["persistence"] == "in_memory", "内存态必须显式标注，不冒充正式草稿"
        assert body["status"] == "experimental"

    def test_production_profile_disables_scenarios(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("MATE_PROFILE", "production")
        monkeypatch.delenv("ONT_SCENARIOS_ENABLED", raising=False)

        r = client.post(f"{BASE}/scenarios", json={"title": "prod"}, headers=_as(client, T_A))
        assert r.status_code == 503, r.text
        assert r.json()["detail"]["code"] == "E503_SCENARIO_DISABLED"
        assert client.get(f"{BASE}/scenarios", headers=_as(client, T_A)).status_code == 503

    def test_production_profile_opt_in_allows_scenarios(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("MATE_PROFILE", "production")
        monkeypatch.setenv("ONT_SCENARIOS_ENABLED", "1")
        r = client.post(f"{BASE}/scenarios", json={"title": "prod-on"}, headers=_as(client, T_A))
        assert r.status_code == 200, r.text
