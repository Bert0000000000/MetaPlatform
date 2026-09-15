"""ONT-GATE-01 — proposal 三闸门 HTTP 级 E2E（schema × SHACL × Axiom 联动）。

验证闭环：propose 响应携带预检报告 → violation 级发现 → execute 409
（E409_PREFLIGHT_BLOCKED）；干净提案照常落库。PG repo + TestClient。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

import pytest

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat

PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql://meta:meta@localhost:5432/metaplatform_ont_test",
)


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore

        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(),
    reason=f"PG not reachable at {PG_DSN!r}",
)


@pytest.fixture
def pg_repo() -> Any:
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r.set_embedder(HashEmbedder())
    r._ensure_schema()
    return r


@pytest.fixture(autouse=True)
def _clean_pg(pg_repo) -> None:
    import psycopg2  # type: ignore

    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_link_instance")
            cur.execute("DELETE FROM ont_link_type")
            cur.execute("DELETE FROM ont_interface")
            cur.execute("DELETE FROM ont_property")
            cur.execute("DELETE FROM ont_axiom")
            cur.execute("DELETE FROM ont_function")
            cur.execute("DELETE FROM ont_individual")
            cur.execute("DELETE FROM ont_object_type")
            cur.execute("DELETE FROM ont_action_type")
            cur.execute("DELETE FROM ont_proposal")
        conn.commit()
    finally:
        conn.close()


def _ot(rid: str, display_name: str = "", with_amount: bool = True) -> ObjectType:
    tenant = rid.split(".")[1]
    parts = rid.split(".")
    slug = parts[4] if len(parts) >= 6 and ".obj." in rid else parts[3]
    pk = Property(
        rid=ClassRef(f"ont.{tenant}.prop.{slug}-id.v1"),
        type_id="string",
        nullable=False,
        primary_key=True,
        title="id",
        format=PropertyFormat.STRING,
    )
    name = Property(
        rid=ClassRef(f"ont.{tenant}.prop.{slug}-name.v1"),
        type_id="string",
        nullable=False,
        primary_key=False,
        title="name",
        format=PropertyFormat.STRING,
    )
    props = [pk, name]
    if with_amount:
        props.append(
            Property(
                rid=ClassRef(f"ont.{tenant}.prop.{slug}-amount.v1"),
                type_id="integer",
                nullable=True,
                primary_key=False,
                title="amount",
                format=PropertyFormat.INTEGER,
            )
        )
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(pk.rid,),
        properties=tuple(props),
        display_name=display_name or slug,
    )


@pytest.fixture(scope="module", autouse=True)
def _init_kernel_repo():
    from mate_tech_ont.main import app
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    r = PgOntologyRepository(dsn=PG_DSN)
    r.set_embedder(HashEmbedder())
    app.state.kernel_repo = r
    yield
    app.state.kernel_repo = None


@pytest.fixture
def client_with_ctx(monkeypatch):
    from fastapi.testclient import TestClient

    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId

    async def fake_dispatch(self, request, call_next):
        request.state.ctx = RequestContext(
            request_id="test-req",
            trace_id="test-trace",
            tenant_id=TenantId("acme"),
            user_id=UserId("alice"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    monkeypatch.setattr(auth_mw.AuthMiddleware, "dispatch", fake_dispatch)

    from mate_tech_ont.main import app as _app

    saved_stack = _app.middleware_stack
    _app.middleware_stack = None
    try:
        yield TestClient(_app)
    finally:
        _app.middleware_stack = saved_stack


def _ind(rid: str, class_rid: str, pk: str) -> Individual:
    tenant = rid.split(".")[1]
    parts = class_rid.split(".")
    slug = parts[4] if len(parts) >= 6 and ".obj." in class_rid else parts[3]
    return Individual(
        rid=rid,
        class_rid=ClassRef(class_rid),
        props=((ClassRef(f"ont.{tenant}.prop.{slug}-id.v1"), pk),),
        primary_key=pk,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        tenant_id=tenant,
    )


class TestPreflightGateHttpE2E:
    ORDER = "ont.acme.obj.ops.order.v1"

    def _seed_order(self, pg_repo) -> None:
        pg_repo.upsert_object_type(_ot(self.ORDER, "Order"))

    def test_bad_props_proposal_reports_blocked_and_execute_409(
        self, client_with_ctx, pg_repo
    ):
        self._seed_order(pg_repo)
        # 缺 PK、amount 传字符串 —— schema 闸双错
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={"props": {"name": "O-1", "amount": "not-int"}, "impact_summary": "bad"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["preflight"] is not None
        assert body["preflight"]["blocked"] is True
        assert body["preflight"]["schema"]["errors"]
        assert "预检阻断" in body["preflight"]["summary"]

        pid = body["proposal_id"]
        confirmed = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/confirm",
            json={},
            headers={"Idempotency-Key": "gate-confirm-1"},
        )
        assert confirmed.status_code == 200, confirmed.text

        executed = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/execute",
            headers={"Idempotency-Key": "gate-execute-1"},
        )
        assert executed.status_code == 409, executed.text
        detail = executed.json()["detail"]
        assert detail["code"] == "E409_PREFLIGHT_BLOCKED"
        assert detail["preflight"]["blocked"] is True

        # 未落库：repo 内该类无新实例（提案被闸门拦截在 execute 前）
        from mate_kernel.ontology.identity import ClassRef as _CR

        inds = pg_repo.list_individuals(_CR(self.ORDER))
        assert all("O-1" not in (i.primary_key or "") for i in inds)

    def test_clean_proposal_passes_and_executes(self, client_with_ctx, pg_repo):
        self._seed_order(pg_repo)
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={"props": {"order-id": "O-9", "order-name": "Order Nine"}, "impact_summary": "ok"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["preflight"]["blocked"] is False
        assert body["preflight"]["summary"] == "预检通过"

        pid = body["proposal_id"]
        client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/confirm",
            json={},
            headers={"Idempotency-Key": "gate-confirm-2"},
        )
        executed = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/execute",
            headers={"Idempotency-Key": "gate-execute-2"},
        )
        assert executed.status_code == 200, executed.text

    def test_get_proposal_returns_fresh_preflight(self, client_with_ctx, pg_repo):
        self._seed_order(pg_repo)
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={"props": {"name": "no-pk"}, "impact_summary": "x"},
        )
        pid = r.json()["proposal_id"]
        got = client_with_ctx.get(f"/api/v1/ont/v2/proposals/{pid}")
        assert got.status_code == 200
        assert got.json()["preflight"]["blocked"] is True

    def test_disjoint_axiom_dry_run_blocks_execute(self, client_with_ctx, pg_repo):
        """SHACL×Axiom 联动：注册互斥公理 + 层级 —— 提案类经继承落入互斥对双侧。"""
        order = self.ORDER
        base = "ont.acme.obj.ops.base.v1"
        pg_repo.upsert_object_type(_ot(order, "Order"))
        pg_repo.upsert_object_type(_ot(base, "Base"))
        # ORDER ⊑ BASE + disjoint(ORDER, BASE) —— 层级∧互斥矛盾
        for kind, ops in (
            ("subclass", [order, base]),
            ("disjoint", [order, base]),
        ):
            rr = client_with_ctx.post(
                "/api/v1/ont/v2/reasoning/axioms",
                json={"rid": f"ont.acme.ax.{kind}-gate.v1", "kind": kind, "operands": ops},
            )
            assert rr.status_code == 200, rr.text

        r = client_with_ctx.post(
            f"/api/v1/ont/v2/classes/{order}/propose-instance",
            json={"props": {"id": "O-D", "name": "D"}, "impact_summary": "disjoint"},
        )
        assert r.status_code == 200, r.text
        pre = r.json()["preflight"]
        assert pre["blocked"] is True
        assert any(a["rule"] == "disjoint" and a["severity"] == "violation" for a in pre["axioms"])

        pid = r.json()["proposal_id"]
        client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/confirm",
            json={},
            headers={"Idempotency-Key": "gate-confirm-3"},
        )
        executed = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/execute",
            headers={"Idempotency-Key": "gate-execute-3"},
        )
        assert executed.status_code == 409
        assert executed.json()["detail"]["code"] == "E409_PREFLIGHT_BLOCKED"

    def test_action_proposal_parameter_gate(self, client_with_ctx, pg_repo):
        from mate_kernel.ontology.types import ActionType

        order = self.ORDER
        action_rid = "ont.acme.act.ops.close-order.v1"
        self._seed_order(pg_repo)
        pg_repo.upsert_action_type(
            ActionType(
                rid=ClassRef(action_rid),
                parameters=(
                    Property(
                        rid=ClassRef("ont.acme.prop.close-reason.v1"),
                        type_id="string",
                        nullable=False,
                        primary_key=False,
                        title="reason",
                        format=PropertyFormat.STRING,
                    ),
                ),
                submission_criteria=(),
                side_effects=(),
                function_ref=ClassRef("ont.acme.fn.ops.close.v1"),
                on=(ClassRef(order),),
            )
        )
        target = _ind("ont.acme.ind.order.77", order, "77")
        pg_repo.create_individual(target)

        # 缺必填参数 reason → 闸门阻断
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/action-types/{action_rid}/propose",
            json={"target_iid": "ont.acme.ind.order.77", "parameters": {},
                  "impact_summary": "missing reason"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["preflight"]["blocked"] is True
        assert any("必填" in e for e in r.json()["preflight"]["schema"]["errors"])

        # 参数齐 → 通过
        r2 = client_with_ctx.post(
            f"/api/v1/ont/v2/action-types/{action_rid}/propose",
            json={"target_iid": "ont.acme.ind.order.77",
                  "parameters": {"reason": "done"}, "impact_summary": "ok"},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["preflight"]["blocked"] is False


class TestPostflightHttpE2E:
    """ONT-POSTFLIGHT-01：execute 后不变式后验 + 自动补偿（create_instance）。"""

    ORDER = "ont.acme.obj.ops.order.v1"

    def _propose_confirm(self, client, pk: str) -> str:
        r = client.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={"props": {"order-id": pk, "order-name": f"N-{pk}"}, "impact_summary": "pf"},
        )
        assert r.status_code == 200, r.text
        pid = r.json()["proposal_id"]
        c = client.post(
            f"/api/v1/ont/v2/proposals/{pid}/confirm",
            json={},
            headers={"Idempotency-Key": f"pf-c-{pk}"},
        )
        assert c.status_code == 200, c.text
        return pid

    def test_clean_execute_reports_postflight_pass(self, client_with_ctx, pg_repo):
        pg_repo.upsert_object_type(_ot(self.ORDER, "Order"))
        pid = self._propose_confirm(client_with_ctx, "PF-1")
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/execute",
            headers={"Idempotency-Key": "pf-e-1"},
        )
        assert r.status_code == 200, r.text
        pf = r.json()["postflight"]
        assert pf["checked"] is True
        assert pf["blocked"] is False
        assert pf["action_taken"] == "none"

    def test_postflight_violation_auto_reverts_create_instance(
        self, client_with_ctx, pg_repo, monkeypatch
    ):
        """后验违约 → create_instance 自动补偿（I1≃等价）：实例删除 + reverted。

        用 monkeypatch 把后验用的 preflight_create_instance 固定为 blocked 报告
        （预检闸与后验同引擎，正常流走到后验时已绿；此测试验证的是违约处置接线）。
        """
        pg_repo.upsert_object_type(_ot(self.ORDER, "Order"))
        pid = self._propose_confirm(client_with_ctx, "PF-2")

        import mate_kernel.ontology.preflight as pf_mod
        import mate_tech_ont.v2_kernel.api as api_mod

        real_fn = pf_mod.preflight_create_instance

        def fake_blocked(ot, props, **kw):
            real = real_fn(ot, props, **kw)
            from dataclasses import replace

            return replace(real, blocked=True, summary="后验注入：模拟并发违约")

        monkeypatch.setattr(pf_mod, "preflight_create_instance", fake_blocked)

        # 预检闸与后验同引擎：闸走通过桩（本次只测后验处置接线），后验吃注入
        async def fake_preflight_pass(request, prop):
            return {"blocked": False, "schema": {"checked": True, "errors": [], "warnings": []},
                    "shacl": {"checked": False, "conforms": True, "violations": []},
                    "axioms": [], "summary": "预检通过（桩）"}

        monkeypatch.setattr(api_mod, "_proposal_preflight", fake_preflight_pass)

        r = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/execute",
            headers={"Idempotency-Key": "pf-e-2"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["postflight"]["blocked"] is True
        assert body["postflight"]["action_taken"] == "auto_reverted"
        assert body["postflight"]["revert_receipt"]

        # I1≃等价：实例已删；proposal 终态 reverted
        from mate_kernel.ontology.identity import ClassRef as _CR2

        inds = [i.primary_key for i in pg_repo.list_individuals(_CR2(self.ORDER))]
        assert "PF-2" not in inds
        assert pg_repo.get_proposal(pid).status.value == "reverted"


class TestProvenanceHttpE2E:
    """ONT-PROV-01：提案级溯源 → 实例记录级 provenance 落库 + 查询透出。"""

    ORDER = "ont.acme.obj.ops.order.v1"

    def test_proposal_provenance_lands_on_instance(self, client_with_ctx, pg_repo):
        pg_repo.upsert_object_type(_ot(self.ORDER, "Order"))
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={
                "props": {"order-id": "PV-1", "order-name": "Provenance One"},
                "impact_summary": "prov",
                "provenance": {
                    "source": "ai",
                    "confidence": 0.87,
                    "model": "glm-5.3-flash",
                    "agent_id": "ontology-modeler",
                },
            },
        )
        assert r.status_code == 200, r.text
        pid = r.json()["proposal_id"]
        c = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/confirm",
            json={},
            headers={"Idempotency-Key": "prov-c-1"},
        )
        assert c.status_code == 200
        e = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/execute",
            headers={"Idempotency-Key": "prov-e-1"},
        )
        assert e.status_code == 200, e.text

        # 落库实例带记录级 provenance（调用方溯源 + 平台执行链证据合并）
        ind = pg_repo.get_individual("ont.acme.ind.order.PV-1")
        prov = ind.provenance
        assert prov is not None
        assert prov["source"] == "ai"
        assert prov["confidence"] == 0.87
        assert prov["model"] == "glm-5.3-flash"
        assert prov["proposal_id"] == pid
        assert prov["executed_at"]

        # 查询透出：list individuals 响应携带 provenance

        got = client_with_ctx.get(
            f"/api/v1/ont/v2/individuals?class_rid={self.ORDER}"
        )
        assert got.status_code == 200, got.text
        rows = got.json() if isinstance(got.json(), list) else got.json().get("items", [])
        row = next(x for x in rows if x.get("primary_key") == "PV-1")
        assert row["provenance"]["source"] == "ai"
        assert row["provenance"]["proposal_id"] == pid

    def test_no_provenance_still_works_backward_compatible(self, client_with_ctx, pg_repo):
        """不带 provenance 的提案照常（字段可选，旧行为零影响）。"""
        pg_repo.upsert_object_type(_ot(self.ORDER, "Order"))
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={"props": {"order-id": "PV-2", "order-name": "Plain"}, "impact_summary": "x"},
        )
        assert r.status_code == 200, r.text
        pid = r.json()["proposal_id"]
        assert r.json()["preflight"]["blocked"] is False
