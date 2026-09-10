"""G44 —— Scenario 会话 API：建沙盒 / 试改 / 合并视图 / 受治理合并 / 丢弃。

TestClient e2e（InMemory repo）：试改不落主库；view 带 _sandbox_ 标记；
merge 走 apply-edit-set 审计管道落库；discard 主库原样。
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime

_K = os.path.join(os.path.dirname(__file__), "..", "..", "mate-kernel", "src")
_O = os.path.join(os.path.dirname(__file__), "..", "src")
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

T = "g44"
OBJ = f"ont.{T}.obj.crm.deal.v1"
P_ID = f"ont.{T}.prop.deal-id.v1"
P_STAGE = f"ont.{T}.prop.stage.v1"
ACT = f"ont.{T}.act.crm.advance-deal.v1"


@pytest.fixture()
def client() -> TestClient:
    r = InMemoryOntologyRepository()
    r.upsert_object_type(
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
    r.upsert_action_type(
        ActionType(
            rid=ClassRef(ACT),
            parameters=(),
            submission_criteria=(),
            side_effects=(),
            function_ref=ClassRef(f"ont.{T}.fn.x.v1"),
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
    r.create_individual(
        Individual(
            rid=f"ont.{T}.ind.deal.dd1",
            class_rid=ClassRef(OBJ),
            props=((ClassRef(P_ID), "dd1"), (ClassRef(P_STAGE), "open")),
            primary_key="dd1",
            tenant_id=T,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
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

        request.state.ctx = RequestContext(
            request_id="g44-req",
            trace_id="g44-trace",
            tenant_id=TenantId(T),
            user_id=UserId("tester"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset(),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    app.state.kernel_repo = r
    app.include_router(ont_api.router)
    return TestClient(app)


BASE = "/api/v1/ont/v2"


class TestScenarioSession:
    def test_full_flow(self, client: TestClient) -> None:
        # 1) 建沙盒
        resp = client.post(f"{BASE}/scenarios", json={"title": "Q4 试算"})
        assert resp.status_code == 200
        sid = resp.json()["scenario_id"]
        # 2) 试改（set_property）+ 新建
        e1 = client.post(
            f"{BASE}/scenarios/{sid}/edits",
            json={
                "op": "set_property",
                "target": f"ont.{T}.ind.deal.dd1",
                "property_rid": P_STAGE,
                "value": "won",
            },
        )
        assert e1.status_code == 200, e1.text
        e2 = client.post(
            f"{BASE}/scenarios/{sid}/edits",
            json={
                "op": "create_object",
                "class_rid": OBJ,
                "primary_key": "dd2",
                "props": {P_ID: "dd2", P_STAGE: "new"},
            },
        )
        assert e2.status_code == 200, e2.text
        # 3) 视图：合并视图带 _sandbox_ 标记
        view = client.get(f"{BASE}/scenarios/{sid}/view", params={"class_rid": OBJ})
        assert view.status_code == 200
        rows = {r["deal-id"]: r for r in view.json()["rows"]}
        assert rows["dd1"]["stage"] == "won"
        assert rows["dd1"]["_sandbox_"] == "changed"
        assert rows["dd2"]["_sandbox_"] == "new"
        # 主库未动（直接查 repo）
        app_repo = client.app.state.kernel_repo
        base_ind = app_repo.get_individual(f"ont.{T}.ind.deal.dd1")
        assert base_ind.get(ClassRef(P_STAGE)) == "open"
        # 4) 合并（审计管道）
        m = client.post(f"{BASE}/scenarios/{sid}/merge", json={"action_rid": ACT, "actor": "ceo-1"})
        assert m.status_code == 200, m.text
        assert m.json()["merged"] is True
        # 主库生效
        assert app_repo.get_individual(f"ont.{T}.ind.deal.dd1").get(ClassRef(P_STAGE)) == "won"
        assert app_repo.get_individual(f"ont.{T}.ind.deal.dd2").get(ClassRef(P_STAGE)) == "new"
        # 会话已清
        assert client.get(f"{BASE}/scenarios").json() == []

    def test_discard_keeps_base(self, client: TestClient) -> None:
        sid = client.post(f"{BASE}/scenarios", json={}).json()["scenario_id"]
        client.post(
            f"{BASE}/scenarios/{sid}/edits",
            json={
                "op": "set_property",
                "target": f"ont.{T}.ind.deal.dd1",
                "property_rid": P_STAGE,
                "value": "lost",
            },
        )
        d = client.delete(f"{BASE}/scenarios/{sid}")
        assert d.status_code == 200 and d.json()["discarded"] is True
        app_repo = client.app.state.kernel_repo
        assert app_repo.get_individual(f"ont.{T}.ind.deal.dd1").get(ClassRef(P_STAGE)) == "open"

    def test_bad_edit_rejected(self, client: TestClient) -> None:
        sid = client.post(f"{BASE}/scenarios", json={}).json()["scenario_id"]
        bad = client.post(
            f"{BASE}/scenarios/{sid}/edits",
            json={
                "op": "set_property",
                "target": "ont.g44.ind.deal.ghost",
                "property_rid": P_STAGE,
                "value": "x",
            },
        )
        assert bad.status_code == 422

    def test_unknown_scenario_404(self, client: TestClient) -> None:
        assert client.get(f"{BASE}/scenarios/scn-ghost/view").status_code == 404
