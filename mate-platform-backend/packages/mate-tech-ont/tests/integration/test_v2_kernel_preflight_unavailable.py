"""ONT-GATE-01 续：预检报告状态词汇 + 校验不可用时 **fail-closed**。

本批（校验异常放行）先落地失败用例，再修实现。旧代码上本文件应大面积红：

- ``_proposal_preflight`` 在数据不可得（KeyError）/ 计算异常（Exception）时返回
  ``blocked: False, checked: False``，``execute_proposal`` 只拦 ``blocked is True``
  → **校验不可用 = 静默放行**（可提交、可落库）。
- 报告只有 ``blocked`` 布尔，无法区分「通过 / 违规 / 不适用 / 部分完成 / 不可用」。

验收点：
1. 干净提案 ``status="passed"``；违规 ``status="violation"``；
2. 类型/公理/SHACL 读取或计算异常 → ``status ∈ {partial, unavailable}`` 且 ``blocked=True``；
3. 上述异常下 ``execute`` 必须 409（``E409_PREFLIGHT_UNAVAILABLE``）且**零业务写入**、
   提案停在 ``confirmed``（未执行）；
4. ``GET /proposals/{id}`` 仍可展示故障（预览可见），但**不能据此授权执行**；
5. 不设闸的 kind（``merge_suggestion``）``preflight is None``（不适用）。
"""

from __future__ import annotations

import os
from typing import Any

import pytest

from mate_kernel.ontology.identity import ClassRef
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
            for t in (
                "ont_link_instance",
                "ont_link_type",
                "ont_interface",
                "ont_property",
                "ont_axiom",
                "ont_function",
                "ont_individual",
                "ont_object_type",
                "ont_action_type",
                "ont_proposal",
            ):
                cur.execute(f"DELETE FROM {t}")
        conn.commit()
    finally:
        conn.close()


def _ot(rid: str, display_name: str = "") -> ObjectType:
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
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(pk.rid,),
        properties=(pk, name),
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


class TestPreflightStatusVocabulary:
    ORDER = "ont.acme.obj.ops.order.v1"

    # ── helpers ──

    def _seed(self, pg_repo) -> None:
        pg_repo.upsert_object_type(_ot(self.ORDER, "Order"))

    def _propose(self, client, pk: str = "O-1") -> dict:
        r = client.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={"props": {"order-id": pk, "order-name": f"N-{pk}"}, "impact_summary": "x"},
        )
        assert r.status_code == 200, r.text
        return r.json()

    def _confirm(self, client, pid: str, key: str) -> None:
        c = client.post(
            f"/api/v1/ont/v2/proposals/{pid}/confirm",
            json={},
            headers={"Idempotency-Key": key},
        )
        assert c.status_code == 200, c.text

    def _execute(self, client, pid: str, key: str):
        return client.post(
            f"/api/v1/ont/v2/proposals/{pid}/execute",
            headers={"Idempotency-Key": key},
        )

    def _individual_pks(self, pg_repo) -> set[str]:
        return {str(i.primary_key or "") for i in pg_repo.list_individuals(ClassRef(self.ORDER))}

    def _assert_blocked_without_write(self, client, pg_repo, pid: str, pk: str) -> None:
        """异常态下：execute 必须 409，且零业务写入 + 提案停在 confirmed。"""
        confirmed_before = pg_repo.get_proposal(pid).status.value
        assert confirmed_before == "confirmed", confirmed_before
        executed = self._execute(client, pid, f"exec-{pid}")
        assert executed.status_code == 409, executed.text
        assert executed.json()["detail"]["code"] == "E409_PREFLIGHT_UNAVAILABLE"
        assert pk not in self._individual_pks(pg_repo), "校验不可用时不得有业务写入"
        assert pg_repo.get_proposal(pid).status.value == "confirmed", "提案不得被执行"

    # ── tests ──

    def test_clean_proposal_status_passed_and_executes(self, client_with_ctx, pg_repo):
        self._seed(pg_repo)
        body = self._propose(client_with_ctx, "OK-1")
        pre = body["preflight"]
        assert pre["status"] == "passed"
        assert pre["blocked"] is False
        pid = body["proposal_id"]
        self._confirm(client_with_ctx, pid, f"c-{pid}")
        executed = self._execute(client_with_ctx, pid, f"e-{pid}")
        assert executed.status_code == 200, executed.text
        assert "OK-1" in self._individual_pks(pg_repo)

    def test_violation_reports_violation_status(self, client_with_ctx, pg_repo):
        self._seed(pg_repo)
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/classes/{self.ORDER}/propose-instance",
            json={"props": {"order-name": "no-pk"}, "impact_summary": "bad"},
        )
        assert r.status_code == 200, r.text
        pre = r.json()["preflight"]
        assert pre["status"] == "violation"
        assert pre["blocked"] is True

    def test_axiom_read_failure_is_partial_and_blocks_execute(
        self, client_with_ctx, pg_repo, monkeypatch
    ):
        self._seed(pg_repo)
        body = self._propose(client_with_ctx, "AX-1")
        pid = body["proposal_id"]

        def _boom(*_a, **_k):
            raise RuntimeError("axiom store down")

        monkeypatch.setattr(client_with_ctx.app.state.kernel_repo, "list_axiom_records", _boom)

        # 预览路径：故障可见（GET 重算），但**不授权**
        got = client_with_ctx.get(f"/api/v1/ont/v2/proposals/{pid}")
        assert got.status_code == 200, got.text
        pre = got.json()["preflight"]
        assert pre["status"] == "partial"
        assert pre["blocked"] is True
        assert "axioms" in pre["unavailable"]

        self._confirm(client_with_ctx, pid, f"c-{pid}")
        self._assert_blocked_without_write(client_with_ctx, pg_repo, pid, "AX-1")

    def test_type_read_failure_is_unavailable_and_blocks_execute(
        self, client_with_ctx, pg_repo, monkeypatch
    ):
        self._seed(pg_repo)
        body = self._propose(client_with_ctx, "TY-1")
        pid = body["proposal_id"]

        def _boom(*_a, **_k):
            raise RuntimeError("type store down")

        monkeypatch.setattr(client_with_ctx.app.state.kernel_repo, "get_object_type", _boom)

        got = client_with_ctx.get(f"/api/v1/ont/v2/proposals/{pid}")
        assert got.status_code == 200, got.text
        pre = got.json()["preflight"]
        assert pre["status"] == "unavailable"
        assert pre["blocked"] is True

        self._confirm(client_with_ctx, pid, f"c-{pid}")
        self._assert_blocked_without_write(client_with_ctx, pg_repo, pid, "TY-1")

    def test_shacl_compute_failure_is_partial_and_blocks_execute(
        self, client_with_ctx, pg_repo, monkeypatch
    ):
        self._seed(pg_repo)
        body = self._propose(client_with_ctx, "SH-1")
        pid = body["proposal_id"]

        import mate_kernel.ontology.shacl as shacl_mod

        def _boom(*_a, **_k):
            raise RuntimeError("shacl engine down")

        monkeypatch.setattr(shacl_mod, "validate_shacl", _boom)

        got = client_with_ctx.get(f"/api/v1/ont/v2/proposals/{pid}")
        assert got.status_code == 200, got.text
        pre = got.json()["preflight"]
        assert pre["status"] == "partial"
        assert pre["blocked"] is True
        assert "shacl" in pre["unavailable"]

        self._confirm(client_with_ctx, pid, f"c-{pid}")
        self._assert_blocked_without_write(client_with_ctx, pg_repo, pid, "SH-1")

    def test_merge_proposal_preflight_not_applicable(self, client_with_ctx, pg_repo):
        src = "ont.acme.obj.ops.order.v1"
        dst = "ont.acme.obj.ops.purchase.v1"
        pg_repo.upsert_object_type(_ot(src, "Order"))
        pg_repo.upsert_object_type(_ot(dst, "Purchase"))
        r = client_with_ctx.post(
            "/api/v1/ont/v2/object-types/propose-merge",
            json={"source_rid": src, "target_rid": dst, "similarity": 0.9},
        )
        assert r.status_code == 200, r.text
        assert r.json()["preflight"] is None, "不设闸的 kind = 不适用"
