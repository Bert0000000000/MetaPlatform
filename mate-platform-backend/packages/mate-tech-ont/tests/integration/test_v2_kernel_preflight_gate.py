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
